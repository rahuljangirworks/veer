import { describe, expect, it, vi } from 'vitest'
import type { VoiceAudioPayload, VoiceStatePayload } from '../../../shared/personal-fork-voice'
import { OMNIROUTE_MODEL, OmniRouteChatClient, resolveOmniRouteUrl } from './omniroute-client'
import { PiperTts, PiperTtsError } from './piper-tts'
import { readVeerDictationArgs } from './session'
import { capSpokenReply, VOICE_SYSTEM_PROMPT } from './spoken-text'
import {
  VoiceTurnMachine,
  type VoiceChatClient,
  type VoiceChatMessage,
  type VoiceSynth
} from './turn-machine'

function abortError(): Error {
  const error = new Error('aborted')
  error.name = 'AbortError'
  return error
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function settle(): Promise<void> {
  for (let step = 0; step < 24; step += 1) {
    await Promise.resolve()
  }
}

function createSink(): {
  states: VoiceStatePayload[]
  audio: VoiceAudioPayload[]
  cancels: { count: number }
  audioEnds: number[]
  sink: ConstructorParameters<typeof VoiceTurnMachine>[2]
} {
  const states: VoiceStatePayload[] = []
  const audio: VoiceAudioPayload[] = []
  const cancels = { count: 0 }
  const audioEnds: number[] = []
  return {
    states,
    audio,
    cancels,
    audioEnds,
    sink: {
      state: (payload) => states.push(payload),
      audio: (payload) => audio.push(payload),
      audioEnd: (turnId) => audioEnds.push(turnId),
      cancelPlayback: () => {
        cancels.count += 1
      }
    }
  }
}

function immediateSynth(): VoiceSynth & { texts: string[] } {
  const texts: string[] = []
  return {
    texts,
    async speak(input) {
      texts.push(input.text)
      input.onChunk(Float32Array.from([0.25, -0.5, 0.75]), 22050)
    }
  }
}

function hangingSynth(): VoiceSynth & { texts: string[] } {
  const texts: string[] = []
  return {
    texts,
    speak(input) {
      texts.push(input.text)
      input.onChunk(Float32Array.from([0.25, -0.5]), 16000)
      return new Promise((_resolve, reject) => {
        const onAbort = (): void => reject(abortError())
        if (input.signal.aborted) {
          onAbort()
          return
        }
        input.signal.addEventListener('abort', onAbort, { once: true })
      })
    }
  }
}

function scriptedChat(
  reply: string | ((messages: VoiceChatMessage[]) => string)
): VoiceChatClient & {
  prompts: VoiceChatMessage[][]
} {
  const prompts: VoiceChatMessage[][] = []
  return {
    prompts,
    async complete({ messages }) {
      prompts.push(messages)
      return typeof reply === 'function' ? reply(messages) : reply
    }
  }
}

describe('personal fork voice turn machine', () => {
  it('waits for audible playback after the microphone stops', async () => {
    const sink = createSink()
    const finished = vi.fn()
    const machine = new VoiceTurnMachine(
      scriptedChat('A complete reply.'),
      immediateSynth(),
      sink.sink,
      finished
    )
    machine.start()
    machine.onFinal('hello')
    machine.finishInput()
    await settle()
    expect(sink.states.at(-1)?.state).toBe('speaking')
    expect(finished).not.toHaveBeenCalled()
    machine.onPlaybackComplete(999)
    await settle()
    expect(finished).not.toHaveBeenCalled()
    machine.onPlaybackComplete(sink.audioEnds[0] ?? -1)
    await settle()
    expect(sink.states.at(-1)).toEqual({ state: 'idle' })
    expect(finished).toHaveBeenCalledOnce()
  })

  it('starts speech on the first streamed sentence and speaks the remainder in order', async () => {
    const sink = createSink()
    const synth = immediateSynth()
    const chat: VoiceChatClient = {
      async complete({ onFirstSentence }) {
        onFirstSentence?.('The first complete sentence.')
        await settle()
        expect(synth.texts).toEqual(['The first complete sentence.'])
        return 'The first complete sentence. Here is the second.'
      }
    }
    const machine = new VoiceTurnMachine(chat, synth, sink.sink)
    machine.start()
    machine.onFinal('hello')
    await vi.waitFor(() => expect(synth.texts).toHaveLength(2))
    expect(synth.texts).toEqual(['The first complete sentence.', 'Here is the second.'])
    machine.onPlaybackComplete(sink.audioEnds[0] ?? -1)
    await settle()
    expect(sink.states.at(-1)).toEqual({ state: 'listening' })
  })

  it('rejects insecure and malformed gateway URLs', () => {
    expect(() => resolveOmniRouteUrl('http://10.0.10.245:20128/v1/chat/completions')).toThrow(
      /Allow private-network HTTP/
    )
    expect(() => resolveOmniRouteUrl('https://voice.example/api')).toThrow(/completions/)
    expect(resolveOmniRouteUrl('http://127.0.0.1:20128/v1')).toBe(
      'http://127.0.0.1:20128/v1/chat/completions'
    )
    expect(resolveOmniRouteUrl('http://10.0.10.245:20128/v1', { allowPrivateHttp: true })).toBe(
      'http://10.0.10.245:20128/v1/chat/completions'
    )
    expect(() => resolveOmniRouteUrl('http://8.8.8.8/v1', { allowPrivateHttp: true })).toThrow(
      /HTTPS/
    )
    expect(() =>
      resolveOmniRouteUrl('http://user:secret@10.0.10.245/v1', { allowPrivateHttp: true })
    ).toThrow(/credentials/)
  })
  it('speaks one capped reply and returns to listening', async () => {
    const chat = scriptedChat('Hello there.')
    const synth = immediateSynth()
    const sink = createSink()
    const machine = new VoiceTurnMachine(chat, synth, sink.sink)
    machine.start()
    machine.onFinal('  hello  ')
    await settle()

    expect(sink.states.at(-1)?.state).toBe('speaking')
    machine.onPlaybackComplete(sink.audioEnds[0] ?? -1)
    await settle()

    expect(sink.states.map((event) => event.state)).toEqual([
      'listening',
      'thinking',
      'speaking',
      'listening'
    ])
    expect(sink.states[1]).toMatchObject({ state: 'thinking', text: 'hello' })
    expect(sink.states[2]).toMatchObject({ state: 'speaking', text: 'Hello there.' })
    expect(synth.texts).toEqual(['Hello there.'])
    expect(sink.audio).toHaveLength(1)
    expect(sink.audio[0]?.sampleRate).toBe(22050)
    const pcm = Buffer.from(sink.audio[0]?.pcm ?? '', 'base64')
    expect(new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4)).toEqual(
      Float32Array.from([0.25, -0.5, 0.75])
    )
    expect(sink.cancels.count).toBe(0)
  })

  it('keeps prior turns in the next OmniRoute request', async () => {
    const chat = scriptedChat((messages) => (messages.length === 1 ? 'First.' : 'Second.'))
    const sink = createSink()
    const machine = new VoiceTurnMachine(chat, immediateSynth(), sink.sink)
    machine.start()
    machine.onFinal('one')
    await settle()
    machine.onPlaybackComplete(sink.audioEnds[0] ?? -1)
    await settle()
    machine.onFinal('two')
    await settle()
    expect(chat.prompts[1]).toEqual([
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'First.' },
      { role: 'user', content: 'two' }
    ])
  })

  it('cancels synthesis and playback on barge-in', async () => {
    const chat = scriptedChat('Talking now.')
    const synth = hangingSynth()
    const sink = createSink()
    const machine = new VoiceTurnMachine(chat, synth, sink.sink)
    machine.start()
    machine.onFinal('hello')
    await settle()
    expect(sink.states.at(-1)?.state).toBe('speaking')

    machine.bargeIn()
    await settle()
    expect(sink.cancels.count).toBe(1)
    expect(sink.states.at(-1)).toEqual({ state: 'listening' })
    expect(chat.prompts).toHaveLength(1)
  })

  it('requires an explicit barge-in before accepting a final during speaking', async () => {
    let calls = 0
    const chat: VoiceChatClient = {
      async complete() {
        calls += 1
        return calls === 1 ? 'Old reply.' : 'New reply.'
      }
    }
    const synth = hangingSynth()
    const sink = createSink()
    const machine = new VoiceTurnMachine(chat, synth, sink.sink)
    machine.start()
    machine.onFinal('first')
    await settle()
    machine.onFinal('first')
    expect(calls).toBe(1)

    machine.onFinal('second')
    await settle()
    expect(calls).toBe(1)
    expect(sink.cancels.count).toBe(0)
    machine.bargeIn()
    machine.onFinal('second')
    await settle()
    expect(sink.cancels.count).toBe(1)
    expect(synth.texts).toEqual(['Old reply.', 'New reply.'])
    expect(sink.states.at(-1)).toMatchObject({ state: 'speaking', text: 'New reply.' })
    expect(calls).toBe(2)
  })

  it('aborts an in-flight reply when another final arrives while thinking', async () => {
    let releaseSecond: (value: string) => void = () => {}
    const signals: AbortSignal[] = []
    const chat: VoiceChatClient = {
      complete({ signal }) {
        signals.push(signal)
        if (signals.length === 1) {
          return new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(abortError()), { once: true })
          })
        }
        return new Promise((resolve) => {
          releaseSecond = resolve
        })
      }
    }
    const synth = immediateSynth()
    const sink = createSink()
    const machine = new VoiceTurnMachine(chat, synth, sink.sink)
    machine.start()
    machine.onFinal('one')
    await settle()
    expect(sink.states.at(-1)).toMatchObject({ state: 'thinking', text: 'one' })
    machine.onFinal('two')
    await settle()
    expect(signals[0]?.aborted).toBe(true)
    releaseSecond('Second reply.')
    await settle()
    expect(synth.texts).toEqual(['Second reply.'])
    machine.onPlaybackComplete(sink.audioEnds[0] ?? -1)
    await settle()
    expect(sink.states.at(-1)).toEqual({ state: 'listening' })
  })

  it('barge-in during thinking cancels the reply and returns to listening', async () => {
    const signalBox: { signal?: AbortSignal } = {}
    const chat: VoiceChatClient = {
      complete({ signal }) {
        signalBox.signal = signal
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(abortError()), { once: true })
        })
      }
    }
    const sink = createSink()
    const machine = new VoiceTurnMachine(chat, immediateSynth(), sink.sink)
    machine.start()
    machine.onFinal('hello')
    await settle()
    machine.bargeIn()
    await settle()
    expect(signalBox.signal?.aborted).toBe(true)
    expect(sink.cancels.count).toBe(1)
    expect(sink.states.at(-1)).toEqual({ state: 'listening' })
  })

  it('caps the spoken reply', async () => {
    const chat = scriptedChat(`${'word '.repeat(200)}**extra**`)
    const synth = immediateSynth()
    const machine = new VoiceTurnMachine(chat, synth, createSink().sink)
    machine.start()
    machine.onFinal('hello')
    await settle()
    expect(synth.texts[0]?.length).toBeLessThanOrEqual(400)
    expect(synth.texts[0]?.includes('*')).toBe(false)
    expect(capSpokenReply('**Hi** there.')).toBe('Hi there.')
  })

  it('does not call OmniRoute when the API key is missing', async () => {
    const fetchImpl = vi.fn()
    const sink = createSink()
    const machine = new VoiceTurnMachine(
      new OmniRouteChatClient({
        endpoint: 'https://voice.example/v1/chat/completions',
        env: {},
        fetchImpl,
        readKey: () => {
          throw new Error('OmniRoute API key is not set.')
        }
      }),
      immediateSynth(),
      sink.sink
    )
    machine.start()
    machine.onFinal('hello')
    await settle()
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(sink.audio).toHaveLength(0)
    expect(sink.states.at(-1)).toEqual({
      state: 'listening',
      error: 'OmniRoute API key is not set.'
    })
  })

  it('reports a gateway failure and does not call another provider', async () => {
    const urls: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url)
      return new Response('down', { status: 503 })
    })
    const sink = createSink()
    const machine = new VoiceTurnMachine(
      new OmniRouteChatClient({
        endpoint: 'https://voice.example/v1/chat/completions',
        env: { OMNIROUTE_API_KEY: 'test-key' },
        fetchImpl
      }),
      immediateSynth(),
      sink.sink
    )
    machine.start()
    machine.onFinal('hello')
    await settle()
    expect(urls).toEqual(['https://voice.example/v1/chat/completions'])
    expect(sink.audio).toHaveLength(0)
    expect(sink.states.at(-1)).toEqual({ state: 'listening', error: 'OmniRoute is unavailable.' })
  })

  it('posts a streaming chat completion to OmniRoute only', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const client = new OmniRouteChatClient({
      endpoint: 'https://voice.example/v1/chat/completions',
      env: { OMNIROUTE_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        const body = [
          'data: {"choices":[{"delta":{"content":"Hi. "}}]}\n',
          'data: {"choices":[{"delta":{"content":"There."}}]}\n',
          'data: [DONE]\n'
        ].join('')
        return new Response(body, { status: 200 })
      }
    })
    const controller = new AbortController()
    await expect(
      client.complete({
        messages: [{ role: 'user', content: 'hello' }],
        signal: controller.signal
      })
    ).resolves.toBe('Hi. There.')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://voice.example/v1/chat/completions')
    expect(calls[0]?.init.headers).toMatchObject({
      authorization: 'Bearer test-key',
      'content-type': 'application/json'
    })
    const raw = calls[0]?.init.body
    const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '')
    if (!isRecord(parsed) || !Array.isArray(parsed.messages)) {
      throw new Error('missing chat body')
    }
    expect(parsed.model).toBe(OMNIROUTE_MODEL)
    expect(parsed.stream).toBe(true)
    expect(parsed.messages[0]).toEqual({ role: 'system', content: VOICE_SYSTEM_PROMPT })
    expect(parsed.messages[1]).toEqual({ role: 'user', content: 'hello' })
  })

  it('fails closed when the Piper model is not installed', async () => {
    const sink = createSink()
    const machine = new VoiceTurnMachine(
      scriptedChat('This should not be spoken.'),
      new PiperTts({ modelDir: '/tmp/veer-piper-missing-model' }),
      sink.sink
    )
    machine.start()
    machine.onFinal('hello')
    await settle()
    expect(sink.audio).toHaveLength(0)
    expect(sink.states.at(-1)).toEqual({
      state: 'listening',
      error: 'Piper voice model is not installed.'
    })
    await expect(
      new PiperTts({ modelDir: '/tmp/veer-piper-missing-model' }).speak({
        text: 'hi',
        signal: new AbortController().signal,
        onChunk: () => undefined
      })
    ).rejects.toBeInstanceOf(PiperTtsError)
  })

  it('reads the conversation flag without changing dictation sessions', () => {
    expect(readVeerDictationArgs('desk')).toEqual({ sessionId: 'desk', conversation: false })
    expect(readVeerDictationArgs(undefined, { conversation: false })).toEqual({
      sessionId: 'desktop',
      conversation: false
    })
    expect(readVeerDictationArgs('desk', { conversation: true })).toEqual({
      sessionId: 'desk',
      conversation: true
    })
    expect(readVeerDictationArgs({ conversation: true })).toEqual({
      sessionId: 'desktop',
      conversation: true
    })
  })

  it('stop returns to idle and ignores later finals', async () => {
    const chat = scriptedChat('nope')
    const sink = createSink()
    const machine = new VoiceTurnMachine(chat, immediateSynth(), sink.sink)
    machine.start()
    machine.stop()
    machine.onFinal('hello')
    await settle()
    expect(chat.prompts).toHaveLength(0)
    expect(sink.states.at(-1)).toEqual({ state: 'idle' })
  })
})
