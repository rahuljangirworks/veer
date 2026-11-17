import { statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { hasAppEnvironment, getAppEnvironment } from '../../../shared/app-environment'
import { getSherpaModulePath } from '../../speech/stt-worker-paths'
import { VoiceFailure } from './spoken-text'
import type { VoiceSynth } from './turn-machine'

// Expected Piper model directory (not vendored in git):
//   $VEER_PIPER_MODEL_DIR, or <userData>/veer-voice/piper when that env var is unset.
// Required contents, from the sherpa-onnx vits-piper-en_US-lessac-medium bundle:
//   en_US-lessac-medium.onnx
//   tokens.txt
//   espeak-ng-data/
// Missing files fail closed. This module never synthesizes placeholder audio.

const PIPER_MODEL_FILENAME = 'en_US-lessac-medium.onnx'
const PIPER_TOKENS_FILENAME = 'tokens.txt'
const PIPER_DATA_DIRNAME = 'espeak-ng-data'
const FRAME_SECONDS = 0.2

const requireFromMain = createRequire(__filename)

export class PiperTtsError extends VoiceFailure {}

type PiperPaths = {
  model: string
  tokens: string
  dataDir: string
}

type PiperConfig = {
  model: {
    vits: { model: string; tokens: string; dataDir: string }
    numThreads: number
    debug: boolean
    provider: string
  }
  maxNumSentences: number
}

type SherpaProgress = {
  samples?: unknown
}

type SherpaTtsAddon = {
  createOfflineTts: (config: PiperConfig) => object
  getOfflineTtsSampleRate: (handle: object) => number
  offlineTtsGenerateAsync: (
    handle: object,
    request: {
      text: string
      sid: number
      speed: number
      callback: (info: SherpaProgress) => number
    }
  ) => Promise<{ samples?: unknown }>
}

export type PiperTtsOptions = {
  modelDir?: string
  userDataDir?: string
  env?: NodeJS.ProcessEnv
  loadAddon?: () => unknown
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function resolvePiperModelDir(options: PiperTtsOptions = {}): string {
  if (options.modelDir) {
    return options.modelDir
  }
  const env = options.env ?? process.env
  const override = env.VEER_PIPER_MODEL_DIR?.trim()
  if (override) {
    return override
  }
  if (options.userDataDir) {
    return join(options.userDataDir, 'veer-voice', 'piper')
  }
  if (hasAppEnvironment()) {
    return join(getAppEnvironment().getPath('userData'), 'veer-voice', 'piper')
  }
  return join('veer-voice', 'piper')
}

function piperPaths(modelDir: string): PiperPaths {
  return {
    model: join(modelDir, PIPER_MODEL_FILENAME),
    tokens: join(modelDir, PIPER_TOKENS_FILENAME),
    dataDir: join(modelDir, PIPER_DATA_DIRNAME)
  }
}

export function isPiperModelInstalled(options: PiperTtsOptions = {}): boolean {
  const paths = piperPaths(resolvePiperModelDir(options))
  return isFile(paths.model) && isFile(paths.tokens) && isDir(paths.dataDir)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSherpaTtsAddon(value: unknown): value is SherpaTtsAddon {
  if (!isRecord(value)) {
    return false
  }
  return (
    typeof value.createOfflineTts === 'function' &&
    typeof value.getOfflineTtsSampleRate === 'function' &&
    typeof value.offlineTtsGenerateAsync === 'function'
  )
}

function readSamples(value: unknown): Float32Array | null {
  return value instanceof Float32Array && value.length > 0 ? value : null
}

function emitFrames(
  samples: Float32Array,
  sampleRate: number,
  signal: AbortSignal,
  onChunk: (samples: Float32Array, sampleRate: number) => void
): boolean {
  const frame = Math.max(1, Math.round(sampleRate * FRAME_SECONDS))
  for (let offset = 0; offset < samples.length; offset += frame) {
    if (signal.aborted) {
      return false
    }
    onChunk(samples.subarray(offset, Math.min(samples.length, offset + frame)), sampleRate)
  }
  return !signal.aborted
}

export class PiperTts implements VoiceSynth {
  private handle: object | null = null
  private addon: SherpaTtsAddon | null = null
  private sampleRate = 0
  private generationTail: Promise<void> = Promise.resolve()

  constructor(private readonly options: PiperTtsOptions = {}) {}

  async preload(): Promise<void> {
    this.load()
  }

  async speak(input: {
    text: string
    signal: AbortSignal
    onChunk: (samples: Float32Array, sampleRate: number) => void
  }): Promise<void> {
    const generation = this.generationTail.then(() => this.generate(input))
    this.generationTail = generation.catch(() => undefined)
    await generation
  }

  private async generate(input: {
    text: string
    signal: AbortSignal
    onChunk: (samples: Float32Array, sampleRate: number) => void
  }): Promise<void> {
    if (!input.text.trim() || input.signal.aborted) {
      return
    }
    const addon = this.load()
    const sampleRate = this.sampleRate
    let streamed = false
    const audio = await addon.offlineTtsGenerateAsync(this.requireHandle(), {
      text: input.text,
      sid: 0,
      speed: 1,
      callback: (info) => {
        if (input.signal.aborted) {
          return 0
        }
        const samples = readSamples(info.samples)
        if (!samples) {
          return 1
        }
        streamed = true
        return emitFrames(samples, sampleRate, input.signal, input.onChunk) ? 1 : 0
      }
    })
    if (streamed || input.signal.aborted) {
      return
    }
    const samples = readSamples(audio.samples)
    if (!samples) {
      throw new PiperTtsError('Piper voice model is not installed.')
    }
    emitFrames(samples, sampleRate, input.signal, input.onChunk)
  }

  private requireHandle(): object {
    if (!this.handle) {
      throw new PiperTtsError('Local Piper TTS is unavailable.')
    }
    return this.handle
  }

  private load(): SherpaTtsAddon {
    if (this.addon && this.handle) {
      return this.addon
    }
    const paths = piperPaths(resolvePiperModelDir(this.options))
    if (!isFile(paths.model) || !isFile(paths.tokens) || !isDir(paths.dataDir)) {
      throw new PiperTtsError('Piper voice model is not installed.')
    }
    const loaded = this.options.loadAddon
      ? this.options.loadAddon()
      : requireFromMain(getSherpaModulePath())
    if (!isSherpaTtsAddon(loaded)) {
      throw new PiperTtsError('Local Piper TTS is unavailable.')
    }
    let handle: object
    try {
      handle = loaded.createOfflineTts({
        model: {
          vits: paths,
          numThreads: 1,
          debug: false,
          provider: 'cpu'
        },
        maxNumSentences: 1
      })
    } catch {
      throw new PiperTtsError('Piper voice model is not installed.')
    }
    const sampleRate = loaded.getOfflineTtsSampleRate(handle)
    if (typeof sampleRate !== 'number' || !Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new PiperTtsError('Local Piper TTS is unavailable.')
    }
    this.addon = loaded
    this.handle = handle
    this.sampleRate = sampleRate
    return loaded
  }
}
