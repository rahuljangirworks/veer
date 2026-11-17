export const VEER_VOICE_CHANNELS = {
  state: 'voice:state',
  audio: 'voice:audio',
  audioEnd: 'voice:audio-end',
  cancelPlayback: 'voice:cancel-playback',
  bargeIn: 'voice:barge-in',
  playbackComplete: 'voice:playback-complete',
  cancelConversation: 'voice:cancel-conversation'
} as const

export type VoiceLoopState = 'idle' | 'listening' | 'thinking' | 'speaking'

export type VoiceStatePayload = {
  state: VoiceLoopState
  text?: string
  error?: string
  turnId?: number
  sessionId?: string
}

/** Little-endian float32 mono PCM, base64-encoded. */
export type VoiceAudioPayload = {
  pcm: string
  sampleRate: number
  turnId: number
  sessionId?: string
}

export type VoiceAudioEndPayload = { turnId: number; sessionId: string }

export type VoiceCancelPlaybackPayload = { turnId?: number; sessionId?: string }

export type VeerDictationOptions = {
  conversation?: boolean
}
