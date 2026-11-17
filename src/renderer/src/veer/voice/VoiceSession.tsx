import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { useDictationMeter } from '@/components/dictation/dictation-meter-store'
import {
  endConversationDictation,
  getConversationDictationSessionId,
  isConversationDictation
} from './dictation-bridge'
import { initialVoiceGate, reduceVoiceGate, type VoiceGate } from './gate'
import {
  subscribeVoiceAudio,
  subscribeVoiceAudioEnd,
  subscribeVoiceCancel,
  subscribeVoiceState
} from './ipc'
import { PcmPlayer } from './playback'
import { publishVoiceLoop } from './session-store'

function applyGate(
  gate: VoiceGate,
  event: Parameters<typeof reduceVoiceGate>[1],
  player: PcmPlayer
): { gate: VoiceGate; play: boolean; stop: boolean } {
  const result = reduceVoiceGate(gate, event)
  if (result.stop) {
    player.stop()
  }
  return result
}

export function VoiceSession(): null {
  const conversation = useAppStore((state) => state.settings?.voice?.conversation === true)
  const meterSpeaking = useDictationMeter().isSpeaking
  const conversationRef = useRef(conversation)
  conversationRef.current = conversation
  const meterSpeakingRef = useRef(meterSpeaking)
  meterSpeakingRef.current = meterSpeaking
  const gateRef = useRef(initialVoiceGate())
  const playerRef = useRef<PcmPlayer | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const turnIdRef = useRef<number | null>(null)

  useEffect(() => {
    const player = new PcmPlayer()
    playerRef.current = player
    const unsubscribeState = subscribeVoiceState((event) => {
      if (event.sessionId !== getConversationDictationSessionId()) {
        return
      }
      if (event.sessionId && event.sessionId !== sessionIdRef.current) {
        if (event.state !== 'listening' || !isConversationDictation()) {
          return
        }
        player.stop()
        gateRef.current = initialVoiceGate()
        sessionIdRef.current = event.sessionId
        turnIdRef.current = null
      }
      if (!conversationRef.current || !isConversationDictation()) {
        return
      }
      if (event.turnId !== undefined) {
        turnIdRef.current = event.turnId
      }
      const applied = applyGate(
        gateRef.current,
        { type: 'state', state: event.state, meterSpeaking: meterSpeakingRef.current },
        player
      )
      gateRef.current = applied.gate
      publishVoiceLoop({ state: event.state, text: event.text, error: event.error })
      if (event.error) {
        toast.error(event.error)
      }
    })
    const unsubscribeAudio = subscribeVoiceAudio((event) => {
      if (
        !conversationRef.current ||
        !isConversationDictation() ||
        event.sessionId !== getConversationDictationSessionId()
      ) {
        return
      }
      if (event.sessionId !== sessionIdRef.current || event.turnId !== turnIdRef.current) {
        return
      }
      const applied = applyGate(gateRef.current, { type: 'audio' }, player)
      gateRef.current = applied.gate
      if (!applied.play) {
        return
      }
      void player.playEncoded(event.pcm, event.sampleRate).catch(() => undefined)
    })
    const unsubscribeAudioEnd = subscribeVoiceAudioEnd((event) => {
      if (event.sessionId !== getConversationDictationSessionId()) {
        return
      }
      if (event.sessionId !== sessionIdRef.current || event.turnId !== turnIdRef.current) {
        return
      }
      void player.whenDrained().then((played) => {
        if (
          event.sessionId === sessionIdRef.current &&
          event.turnId === turnIdRef.current &&
          (played || !gateRef.current.suppressed)
        ) {
          void window.api.speech
            .playbackComplete(event.sessionId, event.turnId, played)
            .catch(() => toast.error('Voice playback could not be confirmed.'))
        }
      })
    })
    const unsubscribeCancel = subscribeVoiceCancel((event) => {
      if (event.sessionId !== sessionIdRef.current) {
        return
      }
      const applied = applyGate(gateRef.current, { type: 'cancel' }, player)
      gateRef.current = applied.gate
    })
    return () => {
      unsubscribeState()
      unsubscribeAudio()
      unsubscribeAudioEnd()
      unsubscribeCancel()
      player.close()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    const player = playerRef.current
    if (!conversation) {
      const sessionId = sessionIdRef.current
      if (sessionId) {
        void window.api.speech.cancelConversation(sessionId).catch(() => undefined)
      }
      endConversationDictation()
      sessionIdRef.current = null
      turnIdRef.current = null
      gateRef.current = initialVoiceGate()
      player?.stop()
      publishVoiceLoop({ state: 'idle' })
      return
    }
    if (!player) {
      return
    }
    const applied = applyGate(gateRef.current, { type: 'meter', isSpeaking: meterSpeaking }, player)
    gateRef.current = applied.gate
    if (applied.stop && sessionIdRef.current) {
      const sessionId = sessionIdRef.current
      void window.api.speech.bargeIn(sessionId).catch(() => {
        void window.api.speech.cancelConversation(sessionId).catch(() => undefined)
        toast.error('Voice interruption failed.')
      })
    }
  }, [conversation, meterSpeaking])

  return null
}
