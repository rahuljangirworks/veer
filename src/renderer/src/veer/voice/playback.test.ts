import { afterEach, describe, expect, it, vi } from 'vitest'
import { PcmPlayer } from './playback'

type Source = {
  onended: (() => void) | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function installAudioContext(resumeFails = false): Source[] {
  const sources: Source[] = []
  class FakeAudioContext {
    state = resumeFails ? 'suspended' : 'running'
    currentTime = 0
    destination = {}
    createBuffer(_channels: number, frames: number, sampleRate: number) {
      return {
        duration: frames / sampleRate,
        getChannelData: () => new Float32Array(frames)
      }
    }
    createBufferSource(): Source {
      const source: Source = {
        onended: null,
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn()
      }
      sources.push(source)
      return source
    }
    async resume(): Promise<void> {
      if (resumeFails) {
        throw new Error('audio device unavailable')
      }
      this.state = 'running'
    }
    close(): Promise<void> {
      this.state = 'closed'
      return Promise.resolve()
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return sources
}

afterEach(() => vi.unstubAllGlobals())

describe('PcmPlayer playback receipt', () => {
  it('resolves only after every scheduled chunk ends', async () => {
    const sources = installAudioContext()
    const player = new PcmPlayer()
    await Promise.all([
      player.play(Float32Array.of(0.1), 10),
      player.play(Float32Array.of(0.2), 10)
    ])
    const receipt = player.whenDrained()
    let settled = false
    void receipt.then(() => {
      settled = true
    })
    sources[0]?.onended?.()
    await Promise.resolve()
    expect(settled).toBe(false)
    sources[1]?.onended?.()
    await expect(receipt).resolves.toBe(true)
    player.close()
  })

  it('rejects the pending receipt when playback is interrupted', async () => {
    installAudioContext()
    const player = new PcmPlayer()
    await player.play(Float32Array.of(0.1), 10)
    const receipt = player.whenDrained()
    await Promise.resolve()
    player.stop()
    await expect(receipt).resolves.toBe(false)
    player.close()
  })

  it('reports a device scheduling failure instead of acknowledging sound', async () => {
    installAudioContext(true)
    const player = new PcmPlayer()
    await expect(player.play(Float32Array.of(0.1), 10)).rejects.toThrow('audio device unavailable')
    await expect(player.whenDrained()).resolves.toBe(false)
    player.close()
  })
})
