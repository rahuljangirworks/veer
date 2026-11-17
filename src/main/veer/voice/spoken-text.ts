export class VoiceFailure extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VoiceFailure'
  }
}

export const MAX_SPOKEN_CHARS = 400
export const MAX_USER_CHARS = 2000
export const MAX_VOICE_HISTORY = 8

export const VOICE_SYSTEM_PROMPT = 'Reply in one or two short spoken sentences. No markdown.'

export function clipUserText(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length <= MAX_USER_CHARS) {
    return trimmed
  }
  return trimmed.slice(0, MAX_USER_CHARS)
}

export function capSpokenReply(text: string): string {
  const cleaned = text
    .replace(/[*_`#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= MAX_SPOKEN_CHARS) {
    return cleaned
  }
  const slice = cleaned.slice(0, MAX_SPOKEN_CHARS)
  const boundary = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'))
  if (boundary > 40) {
    return slice.slice(0, boundary + 1).trim()
  }
  return slice.trim()
}

export function encodePcmBase64(samples: Float32Array): string {
  return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength).toString('base64')
}
