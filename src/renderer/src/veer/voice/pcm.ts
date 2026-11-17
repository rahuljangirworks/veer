const FLOAT32_BYTES = 4

/** Base64 little-endian float32 mono. Each sample is 4 bytes and already in -1..1. */
export function decodeFloat32Le(pcm: string): Float32Array | null {
  let binary: string
  try {
    binary = atob(pcm)
  } catch {
    return null
  }
  const byteLength = binary.length - (binary.length % FLOAT32_BYTES)
  if (byteLength < FLOAT32_BYTES) {
    return null
  }
  const bytes = new Uint8Array(byteLength)
  for (let index = 0; index < byteLength; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  const view = new DataView(bytes.buffer)
  const samples = new Float32Array(byteLength / FLOAT32_BYTES)
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getFloat32(index * FLOAT32_BYTES, true)
  }
  return samples
}
