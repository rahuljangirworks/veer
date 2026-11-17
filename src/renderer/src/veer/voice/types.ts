export const VOICE_STATE_CHANNEL = 'voice:state'
export const VOICE_AUDIO_CHANNEL = 'voice:audio'
export const VOICE_CANCEL_PLAYBACK_CHANNEL = 'voice:cancel-playback'

export type VoiceLoopState = 'idle' | 'listening' | 'thinking' | 'speaking'

export type VoiceStateEvent = {
  state: VoiceLoopState
  text?: string
  error?: string
  turnId?: number
  sessionId?: string
}

export type VoiceAudioEvent = {
  pcm: string
  sampleRate: number
  turnId: number
  sessionId?: string
}

export type VoiceAudioEndEvent = { turnId: number; sessionId: string }
export type VoiceCancelEvent = { sessionId?: string }

const VOICE_LOOP_STATES = new Set<VoiceLoopState>(['idle', 'listening', 'thinking', 'speaking'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseVoiceState(payload: unknown): VoiceStateEvent | null {
  if (!isRecord(payload) || typeof payload.state !== 'string') {
    return null
  }
  if (!VOICE_LOOP_STATES.has(payload.state as VoiceLoopState)) {
    return null
  }
  const text = typeof payload.text === 'string' ? payload.text : undefined
  const error = typeof payload.error === 'string' ? payload.error : undefined
  const turnId = typeof payload.turnId === 'number' ? payload.turnId : undefined
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined
  return { state: payload.state as VoiceLoopState, text, error, turnId, sessionId }
}

export function parseVoiceAudio(payload: unknown): VoiceAudioEvent | null {
  if (!isRecord(payload) || typeof payload.pcm !== 'string') {
    return null
  }
  if (typeof payload.sampleRate !== 'number' || !Number.isFinite(payload.sampleRate)) {
    return null
  }
  if (payload.sampleRate <= 0) {
    return null
  }
  if (typeof payload.turnId !== 'number' || !Number.isSafeInteger(payload.turnId)) {
    return null
  }
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined
  return { pcm: payload.pcm, sampleRate: payload.sampleRate, turnId: payload.turnId, sessionId }
}

export function parseVoiceAudioEnd(payload: unknown): VoiceAudioEndEvent | null {
  if (!isRecord(payload) || typeof payload.sessionId !== 'string') {
    return null
  }
  return typeof payload.turnId === 'number' && Number.isSafeInteger(payload.turnId)
    ? { turnId: payload.turnId, sessionId: payload.sessionId }
    : null
}

export function parseVoiceCancel(payload: unknown): VoiceCancelEvent | null {
  if (!isRecord(payload)) {
    return null
  }
  return { sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : undefined }
}
