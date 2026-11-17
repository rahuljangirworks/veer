import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import type {
  VeerDictationOptions,
  VoiceAudioPayload,
  VoiceAudioEndPayload,
  VoiceCancelPlaybackPayload,
  VoiceStatePayload
} from '../../shared/personal-fork-voice'
import type {
  SpeechErrorEvent,
  SpeechLifecycleEvent,
  SpeechModelManifest,
  SpeechModelState,
  SpeechTranscriptEvent
} from '../../shared/speech-types'

export type SpeechApi = {
  getCatalog: () => Promise<SpeechModelManifest[]>
  getModelStates: () => Promise<SpeechModelState[]>
  getOpenAiApiKeyStatus: () => Promise<{
    configured: boolean
    protection: SecretAtRestProtection | null
  }>
  saveOpenAiApiKey: (apiKey: string) => Promise<{ configured: boolean }>
  clearOpenAiApiKey: () => Promise<{ configured: boolean }>
  getVoiceSetupStatus: () => Promise<{
    voiceSetupVersion: number
    keyConfigured: boolean
    savedKeyConfigured: boolean
    piperInstalled: boolean
    piperModelDir: string
    endpointError: string | null
  }>
  saveVoiceKey: (key: string) => Promise<void>
  clearVoiceKey: () => Promise<void>
  installPiperModel: () => Promise<void>
  onPiperInstallProgress: (callback: (progress: number) => void) => () => void
  downloadModel: (modelId: string) => Promise<void>
  cancelDownload: (modelId: string) => Promise<void>
  deleteModel: (modelId: string) => Promise<void>
  startDictation: (
    modelId: string,
    hotwords: string[] | undefined,
    sessionId: string,
    options?: VeerDictationOptions
  ) => Promise<void>
  feedAudio: (samples: Float32Array, sampleRate: number, sessionId?: string) => Promise<void>
  stopDictation: (sessionId?: string) => Promise<void>
  bargeIn: (sessionId?: string) => Promise<void>
  playbackComplete: (sessionId: string, turnId: number, played: boolean) => Promise<void>
  cancelConversation: (sessionId: string) => Promise<void>
  onVoiceState: (callback: (data: VoiceStatePayload) => void) => () => void
  onVoiceAudio: (callback: (data: VoiceAudioPayload) => void) => () => void
  onVoiceAudioEnd: (callback: (data: VoiceAudioEndPayload) => void) => () => void
  onVoiceCancelPlayback: (callback: (data: VoiceCancelPlaybackPayload) => void) => () => void
  onPartialTranscript: (callback: (data: SpeechTranscriptEvent) => void) => () => void
  onFinalTranscript: (callback: (data: SpeechTranscriptEvent) => void) => () => void
  onDownloadProgress: (
    callback: (data: { modelId: string; progress: number }) => void
  ) => () => void
  onReady: (callback: (data: SpeechLifecycleEvent) => void) => () => void
  onStopped: (callback: (data: SpeechLifecycleEvent) => void) => () => void
  onError: (callback: (data: SpeechErrorEvent) => void) => () => void
}
