import type { Store } from '../../persistence'
import {
  closeVeerVoiceSession,
  closeVeerVoiceSessionsForSender,
  createWindowVoiceSender,
  finishVeerVoiceInput,
  notifyVeerVoiceFinal,
  syncVeerVoiceSession,
  type VoiceWindow
} from './session'

type ReleaseVeerDictation = {
  kind: 'release'
  owner: string
  preserveVoice: boolean
}

type FinalVeerDictation = {
  kind: 'final'
  owner: string
  text: string
}

type AcceptVeerDictation = {
  kind: 'accept'
  store: Store
  owner: string
  senderId: number
  conversation: boolean
  window: VoiceWindow
  sessionId: string
  windowClosed: boolean
  attach: boolean
}

export type VeerDictationVoiceEvent =
  | ReleaseVeerDictation
  | FinalVeerDictation
  | AcceptVeerDictation

export function attachVeerVoiceDictation(event: VeerDictationVoiceEvent): void {
  switch (event.kind) {
    case 'release':
      if (event.preserveVoice) {
        finishVeerVoiceInput(event.owner)
        return
      }
      closeVeerVoiceSession(event.owner)
      return
    case 'final':
      notifyVeerVoiceFinal(event.owner, event.text)
      return
    case 'accept':
      closeVeerVoiceSessionsForSender(event.senderId)
      if (!event.attach || event.windowClosed || event.window.isDestroyed()) {
        return
      }
      syncVeerVoiceSession(
        event.owner,
        event.conversation,
        createWindowVoiceSender(event.window, event.sessionId),
        event.conversation
          ? event.store.getSettings()?.voice?.conversationEndpoint ||
              process.env.OMNIROUTE_CHAT_URL ||
              ''
          : '',
        event.store.getSettings()?.voice?.conversationAllowPrivateHttp === true
      )
  }
}
