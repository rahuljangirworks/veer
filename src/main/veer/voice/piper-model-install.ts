import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { runProcess } from '@orca/process-host'
import { getMainHttpClient } from '../../network/http-client'
import { downloadVerifiedArchive } from '../../node-runtime/runtime-archive-download'
import { isPiperModelInstalled, resolvePiperModelDir } from './piper-tts'

const PIPER_ARCHIVE = {
  label: 'Piper voice model',
  url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-lessac-medium.tar.bz2',
  archiveSha256: '9e3febfacf0abf4270172d2958bcec246032b7e88efc2720840cc80c93de334e',
  maxArchiveBytes: 80 * 1024 * 1024
} as const
const ARCHIVE_BYTES = 67_230_653

let activeInstall: Promise<void> | null = null

async function install(onProgress?: (progress: number) => void): Promise<void> {
  const modelDir = resolvePiperModelDir()
  if (isPiperModelInstalled()) {
    onProgress?.(1)
    return
  }
  const parent = dirname(modelDir)
  await mkdir(parent, { recursive: true })
  const workDir = await mkdtemp(join(parent, '.piper-install-'))
  const archivePath = join(workDir, 'model.tar.bz2')
  const extractedDir = join(workDir, 'extracted')
  const backupDir = join(workDir, 'previous')
  let backedUp = false
  let promoted = false
  try {
    await mkdir(extractedDir)
    await downloadVerifiedArchive(
      PIPER_ARCHIVE,
      archivePath,
      getMainHttpClient().fetch,
      undefined,
      undefined,
      (bytes) => onProgress?.(Math.min(0.9, (bytes / ARCHIVE_BYTES) * 0.9))
    )
    const extraction = await runProcess({
      program: 'tar',
      args: ['-xjf', archivePath, '-C', extractedDir],
      timeoutMs: 120_000
    })
    if (extraction.code !== 0) {
      throw new Error('Could not extract the Piper voice model.')
    }
    const candidate = join(extractedDir, 'vits-piper-en_US-lessac-medium')
    if (!isPiperModelInstalled({ modelDir: candidate })) {
      throw new Error('Downloaded Piper model is incomplete.')
    }
    try {
      await rename(modelDir, backupDir)
      backedUp = true
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
        throw error
      }
    }
    await rename(candidate, modelDir)
    promoted = true
    onProgress?.(1)
  } finally {
    if (backedUp && !promoted) {
      await rename(backupDir, modelDir)
    }
    await rm(workDir, { recursive: true, force: true })
  }
}

export function installPiperModel(onProgress?: (progress: number) => void): Promise<void> {
  if (!activeInstall) {
    activeInstall = install(onProgress).finally(() => {
      activeInstall = null
    })
  }
  return activeInstall
}
