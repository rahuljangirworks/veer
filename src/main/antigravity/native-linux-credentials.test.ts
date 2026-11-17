import { afterEach, describe, expect, it, vi } from 'vitest'
import { runProcess, runProcessSync } from '@orca/process-host'
import type { ProcessResult } from '@orca/process-host/process-spec'
import { credential } from './native-account-test-fixtures'
import {
  antigravityLinuxCollectionPath,
  createAntigravityLinuxCredentialBackend
} from './native-linux-credentials'

vi.mock('@orca/process-host', () => ({
  runProcess: vi.fn(),
  runProcessSync: vi.fn()
}))

const LOGIN = '/org/freedesktop/secrets/collection/login'
const collections: ProcessResult = {
  code: 0,
  signal: null,
  stdout: `([objectpath '${LOGIN}'],)`,
  stderr: '',
  timedOut: false
}
const unlocked: ProcessResult = {
  code: 0,
  signal: null,
  stdout: '(<false>,)',
  stderr: '',
  timedOut: false
}

function pythonResult(code: number, stdout = ''): ProcessResult {
  return { code, signal: null, stdout, stderr: '', timedOut: false }
}

function unlockLoginCollection(): void {
  vi.mocked(runProcessSync).mockImplementation((spec) => {
    const args = spec.args ?? []
    return args.includes('Locked') ? unlocked : collections
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(runProcess).mockReset()
  vi.mocked(runProcessSync).mockReset()
})

describe('Antigravity Linux Secret Service collection', () => {
  it('does not start a session bus when none is present', () => {
    vi.stubEnv('DBUS_SESSION_BUS_ADDRESS', '')
    expect(antigravityLinuxCollectionPath()).toBeNull()
    expect(runProcessSync).not.toHaveBeenCalled()
  })

  it('selects the unlocked login collection agy uses', () => {
    vi.stubEnv('DBUS_SESSION_BUS_ADDRESS', 'unix:path=/tmp/bus')
    unlockLoginCollection()
    expect(antigravityLinuxCollectionPath()).toBe(LOGIN)
  })

  it('refuses a locked collection instead of waiting for an unlock prompt', () => {
    vi.stubEnv('DBUS_SESSION_BUS_ADDRESS', 'unix:path=/tmp/bus')
    vi.mocked(runProcessSync)
      .mockReturnValueOnce(collections)
      .mockReturnValueOnce({ ...unlocked, stdout: '(<true>,)' })
    expect(antigravityLinuxCollectionPath()).toBeNull()
  })
})

describe('Antigravity Linux credential item', () => {
  it('reads the gemini/antigravity item as raw JSON', async () => {
    vi.stubEnv('DBUS_SESSION_BUS_ADDRESS', 'unix:path=/tmp/bus')
    const stored = credential('agy-user')
    unlockLoginCollection()
    vi.mocked(runProcess).mockResolvedValue(pythonResult(0, stored))
    const backend = createAntigravityLinuxCredentialBackend('/tmp/missing-marker')
    expect((await backend.read())?.identity?.subject).toBe('agy-user')
    const input = JSON.parse(String(vi.mocked(runProcess).mock.calls[0][0].input))
    expect(input).toMatchObject({
      op: 'read',
      collection: LOGIN,
      service: 'gemini',
      username: 'antigravity'
    })
    expect(vi.mocked(runProcess).mock.calls[0][0].args?.join(' ')).not.toContain(stored)
  })

  it('treats a missing item as signed out', async () => {
    vi.stubEnv('DBUS_SESSION_BUS_ADDRESS', 'unix:path=/tmp/bus')
    unlockLoginCollection()
    vi.mocked(runProcess).mockResolvedValue(pythonResult(2))
    const backend = createAntigravityLinuxCredentialBackend('/tmp/missing-marker')
    expect(await backend.read()).toBeNull()
  })

  it('replaces the login item and verifies the readback', async () => {
    vi.stubEnv('DBUS_SESSION_BUS_ADDRESS', 'unix:path=/tmp/bus')
    const before = credential('agy-user', 1)
    const after = credential('agy-user', 2)
    unlockLoginCollection()
    vi.mocked(runProcess)
      .mockResolvedValueOnce(pythonResult(0, before))
      .mockResolvedValueOnce(pythonResult(0))
      .mockResolvedValueOnce(pythonResult(0, after))
    const backend = createAntigravityLinuxCredentialBackend('/tmp/missing-marker')
    await backend.write(after, before)
    const write = JSON.parse(String(vi.mocked(runProcess).mock.calls[1][0].input))
    expect(write.op).toBe('write')
    expect(write.contents).toBe(after)
    expect(write.service).toBe('gemini')
    expect(write.username).toBe('antigravity')
  })
})
