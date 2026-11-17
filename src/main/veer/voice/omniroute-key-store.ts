import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAppEnvironment } from '../../../shared/app-environment'
import { getSecretStore } from '../../../shared/secret-store'

function keyPath(): string {
  return join(getAppEnvironment().getPath('userData'), 'veer-voice', 'omniroute-key.enc')
}

export function hasOmniRouteKey(): boolean {
  return hasSavedOmniRouteKey() || Boolean(process.env.OMNIROUTE_API_KEY?.trim())
}

export function hasSavedOmniRouteKey(): boolean {
  return existsSync(keyPath())
}

export function readOmniRouteKey(): string {
  const path = keyPath()
  if (existsSync(path)) {
    try {
      return getSecretStore().decryptString(readFileSync(path))
    } catch {
      throw new Error('Saved OmniRoute key cannot be decrypted. Save it again in Voice settings.')
    }
  }
  const environmentKey = process.env.OMNIROUTE_API_KEY?.trim()
  if (!environmentKey) {
    throw new Error('OmniRoute API key is not set. Add it in Voice settings.')
  }
  return environmentKey
}

export function saveOmniRouteKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) {
    throw new Error('OmniRoute API key is required.')
  }
  const secrets = getSecretStore()
  if (!secrets.isEncryptionAvailable() || secrets.describeProtectionGap()) {
    throw new Error('Secure key storage is unavailable on this device.')
  }
  const path = keyPath()
  mkdirSync(join(getAppEnvironment().getPath('userData'), 'veer-voice'), { recursive: true })
  writeFileSync(path, secrets.encryptString(trimmed), { mode: 0o600 })
}

export function clearOmniRouteKey(): void {
  rmSync(keyPath(), { force: true })
}
