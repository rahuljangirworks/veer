export type VoiceChatEndpointOptions = { allowPrivateHttp?: boolean }

function ipv4Octets(hostname: string): number[] | null {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return null
  }
  const octets = hostname.split('.').map(Number)
  return octets.every((octet) => octet <= 255) ? octets : null
}

function isLoopback(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') {
    return true
  }
  return ipv4Octets(hostname)?.[0] === 127
}

export function isPrivateHttpVoiceEndpoint(value: string): boolean {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'http:') {
    return false
  }
  const octets = ipv4Octets(url.hostname)
  if (!octets) {
    return false
  }
  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  )
}

export function normalizeVoiceChatEndpoint(
  value: string,
  options: VoiceChatEndpointOptions = {}
): string {
  if (!value.trim()) {
    throw new Error('Set the OmniRoute URL in Voice settings.')
  }
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter a valid OmniRoute URL in Voice settings.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Remove credentials, query parameters, and fragments from the OmniRoute URL.')
  }
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      (isLoopback(url.hostname) || (options.allowPrivateHttp && isPrivateHttpVoiceEndpoint(value)))
    )
  ) {
    throw new Error(
      isPrivateHttpVoiceEndpoint(value)
        ? 'Allow private-network HTTP for this OmniRoute gateway, or use HTTPS.'
        : 'Use an HTTPS OmniRoute URL (HTTP is allowed on localhost).'
    )
  }
  const path = url.pathname.replace(/\/$/, '')
  if (path === '' || path.endsWith('/v1')) {
    url.pathname = `${path || '/v1'}/chat/completions`
  } else if (!path.endsWith('/v1/chat/completions')) {
    throw new Error('OmniRoute URL must end with /v1/chat/completions, or /v1.')
  } else {
    url.pathname = path
  }
  return url.toString()
}
