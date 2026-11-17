// Why: preload `startDictation` must forward the fourth argument to
// `speech:startDictation`. Normal dictation keeps the existing three arguments.
type DictationStarter = (
  modelId: string,
  hotwords: string[] | undefined,
  sessionId: string,
  options?: { conversation: true }
) => Promise<void>

let conversationSession = false
let conversationSessionId: string | null = null

export function isConversationDictation(): boolean {
  return conversationSession
}

export function getConversationDictationSessionId(): string | null {
  return conversationSessionId
}

export function endConversationDictation(): void {
  conversationSession = false
  conversationSessionId = null
}

export function suppressConversationTranscript(
  setPartialTranscript: (text: string) => void,
  received: { current: boolean }
): boolean {
  if (!conversationSession) {
    return false
  }
  setPartialTranscript('')
  received.current = true
  return true
}

export function startSpeechDictation(
  modelId: string,
  sessionId: string,
  conversation: boolean
): Promise<void> {
  const previousSessionId = conversationSessionId
  conversationSession = conversation
  conversationSessionId = conversation ? sessionId : null
  if (previousSessionId && previousSessionId !== sessionId) {
    void window.api.speech.cancelConversation(previousSessionId).catch(() => undefined)
  }
  const start = window.api.speech.startDictation as DictationStarter
  if (!conversation) {
    return start(modelId, undefined, sessionId)
  }
  return start(modelId, undefined, sessionId, { conversation: true })
}
