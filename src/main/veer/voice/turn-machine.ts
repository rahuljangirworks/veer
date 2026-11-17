import type {
  VoiceAudioPayload,
  VoiceLoopState,
  VoiceStatePayload
} from '../../../shared/personal-fork-voice'
import {
  capSpokenReply,
  clipUserText,
  encodePcmBase64,
  MAX_VOICE_HISTORY,
  VoiceFailure
} from './spoken-text'

export type VoiceChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type VoiceChatClient = {
  complete(input: {
    messages: VoiceChatMessage[]
    signal: AbortSignal
    onFirstSentence?: (text: string) => void
  }): Promise<string>
}

export type VoiceSynth = {
  speak(input: {
    text: string
    signal: AbortSignal
    onChunk: (samples: Float32Array, sampleRate: number) => void
  }): Promise<void>
}

export type VoiceTurnSink = {
  state(payload: VoiceStatePayload): void
  audio(payload: VoiceAudioPayload): void
  audioEnd(turnId: number): void
  cancelPlayback(): void
}

function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError'
}

export class VoiceTurnMachine {
  private mode: VoiceLoopState = 'idle'
  private generation = 0
  private abortController: AbortController | null = null
  private activeUserText = ''
  private history: VoiceChatMessage[] = []
  private inputEnded = false
  private pendingPlayback: { turnId: number; finish: (played: boolean) => void } | null = null

  constructor(
    private readonly chat: VoiceChatClient,
    private readonly synth: VoiceSynth,
    private readonly sink: VoiceTurnSink,
    private readonly onFinished: () => void = () => undefined
  ) {}

  start(): void {
    this.halt(false)
    this.inputEnded = false
    this.publish('listening')
  }

  stop(): void {
    this.halt(true)
    this.publish('idle')
  }

  finishInput(): void {
    this.inputEnded = true
    if (this.mode === 'listening') {
      this.publish('idle')
      this.onFinished()
    }
  }

  onPlaybackComplete(turnId: number, played = true): void {
    if (this.pendingPlayback?.turnId === turnId) {
      this.pendingPlayback.finish(played)
    }
  }

  bargeIn(): void {
    if (this.mode !== 'speaking' && this.mode !== 'thinking') {
      return
    }
    this.halt(true)
    this.publish(this.inputEnded ? 'idle' : 'listening')
    if (this.inputEnded) {
      this.onFinished()
    }
  }

  onFinal(text: string): void {
    const trimmed = clipUserText(text)
    if (!trimmed || this.mode === 'idle' || this.mode === 'speaking' || this.inputEnded) {
      return
    }
    if (this.mode === 'thinking' && trimmed === this.activeUserText) {
      return
    }
    void this.beginTurn(trimmed)
  }

  private halt(cancelPlayback: boolean): void {
    if (cancelPlayback) {
      this.sink.cancelPlayback()
    }
    this.generation += 1
    this.pendingPlayback?.finish(false)
    this.abortController?.abort()
    this.abortController = null
    this.activeUserText = ''
  }

  private publish(state: VoiceLoopState, text?: string): void {
    this.mode = state
    this.sink.state(text ? { state, text } : { state })
  }

  private isCurrent(generation: number, controller: AbortController): boolean {
    return generation === this.generation && !controller.signal.aborted
  }

  private fail(generation: number, text: string): void {
    if (generation !== this.generation) {
      return
    }
    if (this.mode === 'speaking') {
      this.sink.cancelPlayback()
    }
    this.abortController?.abort()
    this.activeUserText = ''
    this.mode = this.inputEnded ? 'idle' : 'listening'
    this.sink.state({ state: this.mode, error: text })
    if (this.inputEnded) {
      this.onFinished()
    }
  }

  private waitForPlayback(turnId: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => finish(false), 60_000)
      timeout.unref()
      const finish = (played: boolean): void => {
        clearTimeout(timeout)
        if (this.pendingPlayback?.turnId === turnId) {
          this.pendingPlayback = null
        }
        resolve(played)
      }
      this.pendingPlayback = { turnId, finish }
    })
  }

  private async beginTurn(text: string): Promise<void> {
    this.pendingPlayback?.finish(false)
    this.abortController?.abort()
    const controller = new AbortController()
    this.abortController = controller
    this.generation += 1
    const generation = this.generation
    this.activeUserText = text
    const startedAt = Date.now()
    let firstAudioAt = 0
    this.mode = 'thinking'
    this.sink.state({ state: 'thinking', text, turnId: generation })
    try {
      let firstSentence = ''
      let earlySpeech: Promise<void> | null = null
      let earlyError: unknown = null
      let started = false
      let speechText = ''
      const emitChunk = (samples: Float32Array, sampleRate: number): void => {
        if (!this.isCurrent(generation, controller) || samples.length === 0) {
          return
        }
        if (!started) {
          started = true
          firstAudioAt = Date.now()
          this.mode = 'speaking'
          this.sink.state({ state: 'speaking', text: speechText, turnId: generation })
        }
        this.sink.audio({ pcm: encodePcmBase64(samples), sampleRate, turnId: generation })
      }
      const reply = await this.chat.complete({
        messages: this.history.concat({ role: 'user', content: text }),
        signal: controller.signal,
        onFirstSentence: (sentence) => {
          if (!this.isCurrent(generation, controller) || firstSentence) {
            return
          }
          firstSentence = capSpokenReply(sentence)
          if (firstSentence) {
            speechText = firstSentence
            earlySpeech = this.synth
              .speak({ text: firstSentence, signal: controller.signal, onChunk: emitChunk })
              .catch((error: unknown) => {
                earlyError = error
              })
          }
        }
      })
      if (!this.isCurrent(generation, controller)) {
        return
      }
      const spoken = capSpokenReply(reply)
      speechText = spoken
      if (!spoken) {
        this.fail(generation, 'OmniRoute returned an empty reply.')
        return
      }
      if (earlySpeech) {
        await earlySpeech
      }
      if (earlyError) {
        throw earlyError
      }
      const remaining =
        firstSentence && spoken.startsWith(firstSentence)
          ? spoken.slice(firstSentence.length).trim()
          : spoken
      if (remaining) {
        await this.synth.speak({ text: remaining, signal: controller.signal, onChunk: emitChunk })
      }
      if (!this.isCurrent(generation, controller)) {
        return
      }
      if (!started) {
        this.fail(generation, 'Piper voice model is not installed.')
        return
      }
      const playback = this.waitForPlayback(generation)
      this.sink.audioEnd(generation)
      if (!(await playback)) {
        if (this.isCurrent(generation, controller)) {
          this.fail(generation, 'Voice playback did not finish.')
        }
        return
      }
      if (!this.isCurrent(generation, controller)) {
        return
      }
      const nextHistory = this.history.concat(
        { role: 'user', content: text },
        { role: 'assistant', content: spoken }
      )
      this.history =
        nextHistory.length > MAX_VOICE_HISTORY
          ? nextHistory.slice(nextHistory.length - MAX_VOICE_HISTORY)
          : nextHistory
      this.activeUserText = ''
      console.debug('[voice] reply timing', {
        firstAudioMs: firstAudioAt - startedAt,
        completeMs: Date.now() - startedAt
      })
      if (this.inputEnded) {
        this.publish('idle')
        this.onFinished()
      } else {
        this.publish('listening')
      }
    } catch (err) {
      if (!this.isCurrent(generation, controller) || isAbortError(err)) {
        return
      }
      const message = err instanceof VoiceFailure ? err.message : 'Voice reply failed.'
      this.fail(generation, message)
    }
  }
}
