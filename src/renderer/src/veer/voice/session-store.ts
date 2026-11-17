import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { VoiceLoopState } from './types'

export type VoiceLoopSnapshot = {
  state: VoiceLoopState
  text?: string
  error?: string
}

const voiceSessionStore = createStore<VoiceLoopSnapshot>(() => ({ state: 'idle' }))

export function publishVoiceLoop(snapshot: VoiceLoopSnapshot): void {
  voiceSessionStore.setState(snapshot, true)
}

export function useVoiceLoopSnapshot(): VoiceLoopSnapshot {
  return useStore(voiceSessionStore, (state) => state)
}
