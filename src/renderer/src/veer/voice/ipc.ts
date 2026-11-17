// Why: preload exposes onVoiceState, onVoiceAudio, and onVoiceCancelPlayback.
import type {
  VoiceAudioEndEvent,
  VoiceAudioEvent,
  VoiceCancelEvent,
  VoiceStateEvent
} from './types'
import { parseVoiceAudio, parseVoiceAudioEnd, parseVoiceCancel, parseVoiceState } from './types'

type Unsubscribe = () => void

type SpeechVoiceBridge = {
  onVoiceState?: (listener: (event: VoiceStateEvent) => void) => Unsubscribe
  onVoiceAudio?: (listener: (event: VoiceAudioEvent) => void) => Unsubscribe
  onVoiceAudioEnd?: (listener: (event: VoiceAudioEndEvent) => void) => Unsubscribe
  onVoiceCancelPlayback?: (listener: (event: VoiceCancelEvent) => void) => Unsubscribe
}

function bridge(): SpeechVoiceBridge | null {
  const speech = window.api?.speech as SpeechVoiceBridge | undefined
  return speech ?? null
}

function noop(): Unsubscribe {
  return () => undefined
}

export function subscribeVoiceState(listener: (event: VoiceStateEvent) => void): Unsubscribe {
  const onVoiceState = bridge()?.onVoiceState
  if (!onVoiceState) {
    return noop()
  }
  return onVoiceState((event) => {
    const parsed = parseVoiceState(event)
    if (parsed) {
      listener(parsed)
    }
  })
}

export function subscribeVoiceAudio(listener: (event: VoiceAudioEvent) => void): Unsubscribe {
  const onVoiceAudio = bridge()?.onVoiceAudio
  if (!onVoiceAudio) {
    return noop()
  }
  return onVoiceAudio((event) => {
    const parsed = parseVoiceAudio(event)
    if (parsed) {
      listener(parsed)
    }
  })
}

export function subscribeVoiceAudioEnd(listener: (event: VoiceAudioEndEvent) => void): Unsubscribe {
  const onVoiceAudioEnd = bridge()?.onVoiceAudioEnd
  if (!onVoiceAudioEnd) {
    return noop()
  }
  return onVoiceAudioEnd((event) => {
    const parsed = parseVoiceAudioEnd(event)
    if (parsed) {
      listener(parsed)
    }
  })
}

export function subscribeVoiceCancel(listener: (event: VoiceCancelEvent) => void): Unsubscribe {
  const onVoiceCancelPlayback = bridge()?.onVoiceCancelPlayback
  if (!onVoiceCancelPlayback) {
    return noop()
  }
  return onVoiceCancelPlayback((event) => {
    const parsed = parseVoiceCancel(event)
    if (parsed) {
      listener(parsed)
    }
  })
}
