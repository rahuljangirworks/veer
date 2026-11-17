import type { VoiceLoopState } from './types'

export type VoiceGate = {
  loopState: VoiceLoopState
  armed: boolean
  suppressed: boolean
}

export type VoiceGateEvent =
  | { type: 'state'; state: VoiceLoopState; meterSpeaking: boolean }
  | { type: 'meter'; isSpeaking: boolean }
  | { type: 'cancel' }
  | { type: 'audio' }

export type VoiceGateResult = {
  gate: VoiceGate
  stop: boolean
  play: boolean
}

export function initialVoiceGate(): VoiceGate {
  return { loopState: 'idle', armed: false, suppressed: false }
}

function unchanged(gate: VoiceGate): VoiceGateResult {
  return { gate, stop: false, play: false }
}

function reduceState(
  gate: VoiceGate,
  event: { state: VoiceLoopState; meterSpeaking: boolean }
): VoiceGateResult {
  const enteredSpeaking = event.state === 'speaking' && gate.loopState !== 'speaking'
  const leftSpeaking = gate.loopState === 'speaking' && event.state !== 'speaking'
  if (!enteredSpeaking && !leftSpeaking) {
    return unchanged({ ...gate, loopState: event.state })
  }
  return {
    gate: {
      loopState: event.state,
      armed: enteredSpeaking ? !event.meterSpeaking : false,
      suppressed: false
    },
    stop: leftSpeaking,
    play: false
  }
}

function reduceMeter(gate: VoiceGate, isSpeaking: boolean): VoiceGateResult {
  if (gate.loopState !== 'speaking' || gate.suppressed) {
    return unchanged(gate)
  }
  if (!gate.armed) {
    return isSpeaking ? unchanged(gate) : unchanged({ ...gate, armed: true })
  }
  if (!isSpeaking) {
    return unchanged(gate)
  }
  return {
    gate: { ...gate, suppressed: true, armed: false },
    stop: true,
    play: false
  }
}

export function reduceVoiceGate(gate: VoiceGate, event: VoiceGateEvent): VoiceGateResult {
  if (event.type === 'cancel') {
    return { gate: { ...gate, suppressed: true }, stop: true, play: false }
  }
  if (event.type === 'audio') {
    return { gate, stop: false, play: gate.loopState === 'speaking' && !gate.suppressed }
  }
  if (event.type === 'state') {
    return reduceState(gate, event)
  }
  return reduceMeter(gate, event.isSpeaking)
}
