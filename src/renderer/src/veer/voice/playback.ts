import { decodeFloat32Le } from './pcm'

export class PcmPlayer {
  private context: AudioContext | null = null
  private nextTime = 0
  private generation = 0
  private readonly sources = new Set<AudioBufferSourceNode>()
  private scheduleTail: Promise<void> = Promise.resolve()
  private drainWaiters = new Set<(played: boolean) => void>()
  private failed = false

  stop(): void {
    this.generation += 1
    this.failed = false
    for (const resolve of this.drainWaiters) {
      resolve(false)
    }
    this.drainWaiters.clear()
    for (const source of this.sources) {
      source.onended = null
      try {
        source.stop()
      } catch {
        // Why: stop() throws if the buffer never started.
      }
      source.disconnect()
    }
    this.sources.clear()
    if (this.context) {
      this.nextTime = this.context.currentTime
    }
  }

  async playEncoded(pcm: string, sampleRate: number): Promise<void> {
    const samples = decodeFloat32Le(pcm)
    if (!samples) {
      this.failed = true
      return
    }
    await this.play(samples, sampleRate)
  }

  async play(samples: Float32Array, sampleRate: number): Promise<void> {
    if (samples.length === 0) {
      return
    }
    const generation = this.generation
    const scheduled = this.scheduleTail.then(() => this.schedule(samples, sampleRate, generation))
    this.scheduleTail = scheduled.catch(() => {
      if (generation === this.generation) {
        this.failed = true
      }
    })
    await scheduled
  }

  async whenDrained(): Promise<boolean> {
    const generation = this.generation
    await this.scheduleTail
    if (generation !== this.generation) {
      return false
    }
    if (this.sources.size === 0) {
      return !this.failed
    }
    return new Promise((resolve) => {
      this.drainWaiters.add(resolve)
    })
  }

  private async schedule(
    samples: Float32Array,
    sampleRate: number,
    generation: number
  ): Promise<void> {
    if (generation !== this.generation) {
      return
    }
    const context = this.ensureContext()
    if (context.state === 'suspended') {
      await context.resume()
    }
    if (generation !== this.generation || this.context !== context) {
      return
    }
    const buffer = context.createBuffer(1, samples.length, sampleRate)
    // Why: chunks are already float32 in -1..1. Copy them unchanged.
    buffer.getChannelData(0).set(samples)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    const startAt = Math.max(context.currentTime, this.nextTime)
    source.start(startAt)
    this.nextTime = startAt + buffer.duration
    this.sources.add(source)
    source.onended = () => {
      this.sources.delete(source)
      source.disconnect()
      if (this.sources.size === 0) {
        for (const resolve of this.drainWaiters) {
          resolve(!this.failed)
        }
        this.drainWaiters.clear()
      }
    }
  }

  close(): void {
    this.stop()
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') {
      void context.close()
    }
  }

  private ensureContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext()
      this.nextTime = 0
    }
    return this.context
  }
}
