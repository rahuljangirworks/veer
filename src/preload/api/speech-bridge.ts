import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import { ipcRenderer } from 'electron'
import {
  VEER_VOICE_CHANNELS,
  type VeerDictationOptions,
  type VoiceAudioPayload,
  type VoiceAudioEndPayload,
  type VoiceCancelPlaybackPayload,
  type VoiceStatePayload
} from '../../shared/personal-fork-voice'
import type {
  SpeechErrorEvent,
  SpeechLifecycleEvent,
  SpeechModelManifest,
  SpeechModelState,
  SpeechTranscriptEvent
} from '../../shared/speech-types'
import type { PreloadApi } from '../api-types'

function subscribe<T>(channel: string, callback: (data: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T): void => callback(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

export const speechApi = {
  getCatalog: (): Promise<SpeechModelManifest[]> => ipcRenderer.invoke('speech:getCatalog'),
  getModelStates: (): Promise<SpeechModelState[]> => ipcRenderer.invoke('speech:getModelStates'),
  getOpenAiApiKeyStatus: (): Promise<{
    configured: boolean
    protection: SecretAtRestProtection | null
  }> => ipcRenderer.invoke('speech:getOpenAiApiKeyStatus'),
  saveOpenAiApiKey: (apiKey: string): Promise<{ configured: boolean }> =>
    ipcRenderer.invoke('speech:saveOpenAiApiKey', apiKey),
  clearOpenAiApiKey: (): Promise<{ configured: boolean }> =>
    ipcRenderer.invoke('speech:clearOpenAiApiKey'),
  getVoiceSetupStatus: (): Promise<{
    voiceSetupVersion: number
    keyConfigured: boolean
    savedKeyConfigured: boolean
    piperInstalled: boolean
    piperModelDir: string
    endpointError: string | null
  }> => ipcRenderer.invoke('voice:get-setup-status'),
  saveVoiceKey: (key: string): Promise<void> => ipcRenderer.invoke('voice:save-key', key),
  clearVoiceKey: (): Promise<void> => ipcRenderer.invoke('voice:clear-key'),
  installPiperModel: (): Promise<void> => ipcRenderer.invoke('voice:install-piper'),
  onPiperInstallProgress: (callback: (progress: number) => void): (() => void) =>
    subscribe('voice:piper-install-progress', callback),
  downloadModel: (modelId: string): Promise<void> =>
    ipcRenderer.invoke('speech:downloadModel', modelId),
  cancelDownload: (modelId: string): Promise<void> =>
    ipcRenderer.invoke('speech:cancelDownload', modelId),
  deleteModel: (modelId: string): Promise<void> =>
    ipcRenderer.invoke('speech:deleteModel', modelId),
  startDictation: (
    modelId: string,
    hotwords: string[] | undefined,
    sessionId: string,
    options?: VeerDictationOptions
  ): Promise<void> =>
    ipcRenderer.invoke('speech:startDictation', modelId, hotwords, sessionId, options),
  feedAudio: (samples: Float32Array, sampleRate: number, sessionId = 'desktop'): Promise<void> =>
    // Why: Float32Array is zeroed crossing the contextBridge/IPC boundary; wrap in a Buffer to preserve bytes.
    ipcRenderer.invoke(
      'speech:feedAudio',
      Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength),
      sampleRate,
      sessionId
    ),
  stopDictation: (sessionId = 'desktop'): Promise<void> =>
    ipcRenderer.invoke('speech:stopDictation', sessionId),
  bargeIn: (sessionId = 'desktop'): Promise<void> =>
    ipcRenderer.invoke(VEER_VOICE_CHANNELS.bargeIn, sessionId),
  playbackComplete: (sessionId: string, turnId: number, played: boolean): Promise<void> =>
    ipcRenderer.invoke(VEER_VOICE_CHANNELS.playbackComplete, sessionId, turnId, played),
  cancelConversation: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(VEER_VOICE_CHANNELS.cancelConversation, sessionId),
  onVoiceState: (callback: (data: VoiceStatePayload) => void): (() => void) =>
    subscribe(VEER_VOICE_CHANNELS.state, callback),
  onVoiceAudio: (callback: (data: VoiceAudioPayload) => void): (() => void) =>
    subscribe(VEER_VOICE_CHANNELS.audio, callback),
  onVoiceAudioEnd: (callback: (data: VoiceAudioEndPayload) => void): (() => void) =>
    subscribe(VEER_VOICE_CHANNELS.audioEnd, callback),
  onVoiceCancelPlayback: (callback: (data: VoiceCancelPlaybackPayload) => void): (() => void) =>
    subscribe(VEER_VOICE_CHANNELS.cancelPlayback, callback),

  onPartialTranscript: (callback: (data: SpeechTranscriptEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SpeechTranscriptEvent): void =>
      callback(data)
    ipcRenderer.on('speech:partial', listener)
    return () => ipcRenderer.removeListener('speech:partial', listener)
  },
  onFinalTranscript: (callback: (data: SpeechTranscriptEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SpeechTranscriptEvent): void =>
      callback(data)
    ipcRenderer.on('speech:final', listener)
    return () => ipcRenderer.removeListener('speech:final', listener)
  },
  onDownloadProgress: (
    callback: (data: { modelId: string; progress: number }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { modelId: string; progress: number }
    ): void => callback(data)
    ipcRenderer.on('speech:downloadProgress', listener)
    return () => ipcRenderer.removeListener('speech:downloadProgress', listener)
  },
  onReady: (callback: (data: SpeechLifecycleEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SpeechLifecycleEvent): void =>
      callback(data)
    ipcRenderer.on('speech:ready', listener)
    return () => ipcRenderer.removeListener('speech:ready', listener)
  },
  onStopped: (callback: (data: SpeechLifecycleEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SpeechLifecycleEvent): void =>
      callback(data)
    ipcRenderer.on('speech:stopped', listener)
    return () => ipcRenderer.removeListener('speech:stopped', listener)
  },
  onError: (callback: (data: SpeechErrorEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: SpeechErrorEvent): void =>
      callback(data)
    ipcRenderer.on('speech:error', listener)
    return () => ipcRenderer.removeListener('speech:error', listener)
  }
} satisfies PreloadApi['speech']
