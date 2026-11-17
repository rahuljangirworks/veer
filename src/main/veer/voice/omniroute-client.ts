import { capSpokenReply, MAX_SPOKEN_CHARS, VOICE_SYSTEM_PROMPT, VoiceFailure } from './spoken-text'
import type { VoiceChatClient, VoiceChatMessage } from './turn-machine'
import { readOmniRouteKey } from './omniroute-key-store'
import {
  normalizeVoiceChatEndpoint,
  type VoiceChatEndpointOptions
} from '../../../shared/voice-chat-endpoint'

export const OMNIROUTE_MODEL = 'auto/fast'
const OMNIROUTE_MAX_TOKENS = 80
const OMNIROUTE_TIMEOUT_MS = 20_000

export class OmniRouteError extends VoiceFailure {}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>

type ChatClientOptions = {
  env?: NodeJS.ProcessEnv
  fetchImpl?: FetchLike
  endpoint?: string
  allowPrivateHttp?: boolean
  readKey?: () => string
}

export function resolveOmniRouteUrl(value: string, options: VoiceChatEndpointOptions = {}): string {
  try {
    return normalizeVoiceChatEndpoint(value, options)
  } catch (error) {
    throw new OmniRouteError(error instanceof Error ? error.message : 'Invalid OmniRoute URL.')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function abortError(): Error {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

function readContentDelta(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    return ''
  }
  const choice = value.choices[0]
  if (!isRecord(choice) || !isRecord(choice.delta)) {
    return ''
  }
  return typeof choice.delta.content === 'string' ? choice.delta.content : ''
}

function parseSseLine(line: string): { done: true } | { done: false; text: string } | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) {
    return null
  }
  const data = trimmed.slice(5).trim()
  if (data === '[DONE]') {
    return { done: true }
  }
  try {
    return { done: false, text: readContentDelta(JSON.parse(data)) }
  } catch {
    return null
  }
}

async function readChatStream(
  response: Response,
  signal: AbortSignal,
  onFirstSentence?: (text: string) => void
): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new OmniRouteError('OmniRoute is unavailable.')
  }
  const decoder = new TextDecoder()
  const parts: string[] = []
  let pending = ''
  let length = 0
  let finished = false
  let firstSentenceSent = false
  while (!finished && length < MAX_SPOKEN_CHARS) {
    if (signal.aborted) {
      await reader.cancel()
      throw abortError()
    }
    const chunk = await reader.read()
    if (chunk.done) {
      pending += decoder.decode()
      finished = true
    } else {
      pending += decoder.decode(chunk.value, { stream: true })
    }
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      const parsed = parseSseLine(line)
      if (!parsed) {
        continue
      }
      if (parsed.done) {
        finished = true
        break
      }
      if (!parsed.text) {
        continue
      }
      parts.push(parsed.text)
      length += parsed.text.length
      if (!firstSentenceSent && onFirstSentence) {
        const current = capSpokenReply(parts.join(''))
        const match = current.match(/^(.{20,}?[.!?])(?:\s|$)/)
        if (match?.[1]) {
          firstSentenceSent = true
          onFirstSentence(match[1])
        }
      }
      if (length >= MAX_SPOKEN_CHARS) {
        finished = true
        break
      }
    }
  }
  const tail = parseSseLine(pending)
  if (tail && !tail.done && tail.text) {
    parts.push(tail.text)
  }
  await reader.cancel().catch(() => undefined)
  return capSpokenReply(parts.join(''))
}

export class OmniRouteChatClient implements VoiceChatClient {
  private readonly env: NodeJS.ProcessEnv
  private readonly fetchImpl: FetchLike
  private readonly endpoint: string
  private readonly allowPrivateHttp: boolean
  private readonly readKey: () => string

  constructor(options: ChatClientOptions = {}) {
    this.env = options.env ?? process.env
    this.fetchImpl = options.fetchImpl ?? fetch
    this.endpoint = options.endpoint ?? this.env.OMNIROUTE_CHAT_URL ?? ''
    this.allowPrivateHttp = options.allowPrivateHttp === true
    this.readKey =
      options.readKey ??
      (options.env ? () => options.env?.OMNIROUTE_API_KEY?.trim() ?? '' : readOmniRouteKey)
  }

  async complete(input: {
    messages: VoiceChatMessage[]
    signal: AbortSignal
    onFirstSentence?: (text: string) => void
  }): Promise<string> {
    const url = resolveOmniRouteUrl(this.endpoint, { allowPrivateHttp: this.allowPrivateHttp })
    let key: string
    try {
      key = this.readKey().trim()
    } catch (error) {
      throw new OmniRouteError(
        error instanceof Error ? error.message : 'OmniRoute API key is not set.'
      )
    }
    if (!key) {
      throw new OmniRouteError('OmniRoute API key is not set.')
    }
    const request = new AbortController()
    const abort = (): void => request.abort()
    input.signal.addEventListener('abort', abort, { once: true })
    if (input.signal.aborted) {
      abort()
    }
    const timeout = setTimeout(abort, OMNIROUTE_TIMEOUT_MS)
    timeout.unref()
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: OMNIROUTE_MODEL,
          stream: true,
          max_tokens: OMNIROUTE_MAX_TOKENS,
          messages: [{ role: 'system', content: VOICE_SYSTEM_PROMPT }, ...input.messages]
        }),
        redirect: 'error',
        signal: request.signal
      })
      if (!response.ok) {
        throw new OmniRouteError('OmniRoute is unavailable.')
      }
      const reply = await readChatStream(response, request.signal, input.onFirstSentence)
      if (!reply) {
        throw new OmniRouteError('OmniRoute returned an empty reply.')
      }
      return reply
    } catch (err) {
      if (input.signal.aborted) {
        throw abortError()
      }
      if (request.signal.aborted) {
        throw new OmniRouteError('OmniRoute timed out.')
      }
      if (err instanceof OmniRouteError) {
        throw err
      }
      throw new OmniRouteError('OmniRoute is unavailable.')
    } finally {
      clearTimeout(timeout)
      input.signal.removeEventListener('abort', abort)
    }
  }
}
