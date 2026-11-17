import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialVoiceGate, reduceVoiceGate } from './gate'
import { decodeFloat32Le } from './pcm'
import {
  isConversationDictation,
  startSpeechDictation,
  suppressConversationTranscript
} from './dictation-bridge'

function step(
  gate: ReturnType<typeof initialVoiceGate>,
  event: Parameters<typeof reduceVoiceGate>[1]
) {
  return reduceVoiceGate(gate, event)
}

describe('voice playback gate', () => {
  it('plays pcm until cancel, then drops the rest of that turn', () => {
    let gate = initialVoiceGate()
    gate = step(gate, { type: 'state', state: 'speaking', meterSpeaking: false }).gate
    expect(step(gate, { type: 'audio' }).play).toBe(true)
    const cancelled = step(gate, { type: 'cancel' })
    expect(cancelled.stop).toBe(true)
    expect(step(cancelled.gate, { type: 'audio' }).play).toBe(false)
  })

  it('arms barge-in only after the mic is quiet, then stops on new speech', () => {
    let gate = initialVoiceGate()
    gate = step(gate, { type: 'state', state: 'speaking', meterSpeaking: true }).gate
    expect(gate.armed).toBe(false)
    expect(step(gate, { type: 'meter', isSpeaking: true }).stop).toBe(false)
    gate = step(gate, { type: 'meter', isSpeaking: false }).gate
    expect(gate.armed).toBe(true)
    const barge = step(gate, { type: 'meter', isSpeaking: true })
    expect(barge.stop).toBe(true)
    expect(barge.gate.suppressed).toBe(true)
    expect(step(barge.gate, { type: 'audio' }).play).toBe(false)
  })

  it('clears suppression when a new speaking turn starts', () => {
    let gate = initialVoiceGate()
    gate = step(gate, { type: 'state', state: 'speaking', meterSpeaking: false }).gate
    gate = step(gate, { type: 'cancel' }).gate
    gate = step(gate, { type: 'state', state: 'thinking', meterSpeaking: false }).gate
    gate = step(gate, { type: 'state', state: 'speaking', meterSpeaking: false }).gate
    expect(gate.suppressed).toBe(false)
    expect(step(gate, { type: 'audio' }).play).toBe(true)
  })
})

describe('decodeFloat32Le', () => {
  it('decodes little-endian float32 samples already in range', () => {
    const bytes = new Uint8Array(12)
    const view = new DataView(bytes.buffer)
    view.setFloat32(0, 0, true)
    view.setFloat32(4, 0.5, true)
    view.setFloat32(8, -1, true)
    const pcm = Buffer.from(bytes).toString('base64')
    expect(Array.from(decodeFloat32Le(pcm) ?? [])).toEqual([0, 0.5, -1])
  })

  it('drops a trailing partial sample', () => {
    const bytes = new Uint8Array(6)
    const view = new DataView(bytes.buffer)
    view.setFloat32(0, 0.25, true)
    const pcm = Buffer.from(bytes).toString('base64')
    expect(Array.from(decodeFloat32Le(pcm) ?? [])).toEqual([0.25])
  })

  it('rejects malformed base64', () => {
    expect(decodeFloat32Le('****')).toBeNull()
  })
})

describe('startSpeechDictation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes conversation only when voice mode is on', async () => {
    const startDictation = vi.fn(async () => undefined)
    const cancelConversation = vi.fn(async () => undefined)
    vi.stubGlobal('window', { api: { speech: { startDictation, cancelConversation } } })
    await startSpeechDictation('model', '1', true)
    expect(startDictation).toHaveBeenCalledWith('model', undefined, '1', { conversation: true })
    expect(isConversationDictation()).toBe(true)
    const received = { current: false }
    const setPartialTranscript = vi.fn()
    expect(suppressConversationTranscript(setPartialTranscript, received)).toBe(true)
    expect(received.current).toBe(true)
    await startSpeechDictation('model', '2', false)
    expect(cancelConversation).toHaveBeenCalledWith('1')
    expect(startDictation).toHaveBeenLastCalledWith('model', undefined, '2')
    expect(isConversationDictation()).toBe(false)
  })
})
