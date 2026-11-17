import {
  VEER_VOICE_CHANNELS,
  type VeerDictationOptions,
  type VoiceAudioPayload,
  type VoiceStatePayload
} from '../../../shared/personal-fork-voice'
import { OmniRouteChatClient } from './omniroute-client'
import { PiperTts } from './piper-tts'
import { VoiceTurnMachine, type VoiceTurnSink } from './turn-machine'

export type VoiceIpcSender = {
  sendState(payload: VoiceStatePayload): void
  sendAudio(payload: VoiceAudioPayload): void
  sendAudioEnd(turnId: number): void
  sendCancelPlayback(): void
}

export type VoiceWindow = {
  isDestroyed(): boolean
  webContents: {
    send(channel: string, payload?: unknown): void
  }
}

const sessions = new Map<string, VoiceTurnMachine>()
let sharedSynth: PiperTts | null = null

function getSharedSynth(): PiperTts {
  sharedSynth ??= new PiperTts()
  return sharedSynth
}

export function readVeerDictationArgs(
  sessionOrOptions?: string | VeerDictationOptions,
  options?: VeerDictationOptions
): { sessionId: string; conversation: boolean } {
  if (typeof sessionOrOptions === 'object' && sessionOrOptions !== null) {
    return { sessionId: 'desktop', conversation: sessionOrOptions.conversation === true }
  }
  return {
    sessionId: sessionOrOptions ?? 'desktop',
    conversation: options?.conversation === true
  }
}

export function createWindowVoiceSender(window: VoiceWindow, sessionId: string): VoiceIpcSender {
  const send = (channel: string, payload: unknown): void => {
    if (window.isDestroyed()) {
      return
    }
    window.webContents.send(channel, payload)
  }
  return {
    sendState: (payload) => send(VEER_VOICE_CHANNELS.state, { ...payload, sessionId }),
    sendAudio: (payload) => send(VEER_VOICE_CHANNELS.audio, { ...payload, sessionId }),
    sendAudioEnd: (turnId) => send(VEER_VOICE_CHANNELS.audioEnd, { turnId, sessionId }),
    sendCancelPlayback: () => send(VEER_VOICE_CHANNELS.cancelPlayback, { sessionId })
  }
}

function toSink(sender: VoiceIpcSender): VoiceTurnSink {
  return {
    state: (payload) => sender.sendState(payload),
    audio: (payload) => sender.sendAudio(payload),
    audioEnd: (turnId) => sender.sendAudioEnd(turnId),
    cancelPlayback: () => sender.sendCancelPlayback()
  }
}

export function syncVeerVoiceSession(
  owner: string,
  conversation: boolean,
  sender: VoiceIpcSender,
  endpoint = '',
  allowPrivateHttp = false
): void {
  closeVeerVoiceSession(owner)
  if (!conversation) {
    return
  }
  const synth = getSharedSynth()
  const machine = new VoiceTurnMachine(
    new OmniRouteChatClient({ endpoint, allowPrivateHttp }),
    synth,
    toSink(sender),
    () => {
      if (sessions.get(owner) === machine) {
        sessions.delete(owner)
      }
    }
  )
  sessions.set(owner, machine)
  machine.start()
  void synth.preload().catch(() => undefined)
}

export function finishVeerVoiceInput(owner: string): void {
  sessions.get(owner)?.finishInput()
}

export function completeVeerVoicePlayback(owner: string, turnId: number, played: boolean): void {
  sessions.get(owner)?.onPlaybackComplete(turnId, played)
}

export function closeVeerVoiceSessionsForSender(senderId: number): void {
  const prefix = `desktop:${senderId}:`
  for (const owner of sessions.keys()) {
    if (owner.startsWith(prefix)) {
      closeVeerVoiceSession(owner)
    }
  }
}

export function notifyVeerVoiceFinal(owner: string, text: string): void {
  sessions.get(owner)?.onFinal(text)
}

export function bargeInVeerVoiceSession(owner: string): void {
  sessions.get(owner)?.bargeIn()
}

export function closeVeerVoiceSession(owner: string): void {
  const machine = sessions.get(owner)
  if (!machine) {
    return
  }
  sessions.delete(owner)
  machine.stop()
}
