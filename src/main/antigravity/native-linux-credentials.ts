import { existsSync } from 'node:fs'
import { runProcess, runProcessSync } from '@orca/process-host'
import {
  decodeAntigravityKeychainValue,
  parseAntigravityNativeCredential,
  type AntigravityNativeCredential
} from './native-credential-codec'
import type { AntigravityCredentialBackend } from './native-account-service'

const SERVICE = 'gemini'
const ACCOUNT = 'antigravity'
const LOGIN_COLLECTION = '/org/freedesktop/secrets/collection/login'
const DEFAULT_COLLECTION = '/org/freedesktop/secrets/aliases/default'
const SECRET_SERVICE = 'org.freedesktop.secrets'
const PROBE_TIMEOUT_MS = 1_500
const STORE_TIMEOUT_MS = 5_000

const ADAPTER_UNAVAILABLE =
  'Native Antigravity account switching is not supported on this host yet. Windows Credential Manager and Linux Secret Service need a verified adapter.'
const KEYRING_MARKER =
  'Antigravity has a keyring fallback marker; Orca cannot verify which credential store agy will use.'

const SECRET_SCRIPT = `
import json, sys, dbus
req = json.load(sys.stdin)
bus = dbus.SessionBus()
props = dbus.Interface(
    bus.get_object(${JSON.stringify(SECRET_SERVICE)}, req["collection"]),
    "org.freedesktop.DBus.Properties",
)
if props.Get("org.freedesktop.Secret.Collection", "Locked"):
    sys.exit(4)
service = dbus.Interface(
    bus.get_object(${JSON.stringify(SECRET_SERVICE)}, "/org/freedesktop/secrets"),
    "org.freedesktop.Secret.Service",
)
_output, session_path = service.OpenSession("plain", dbus.String(""))
try:
    collection = dbus.Interface(
        bus.get_object(${JSON.stringify(SECRET_SERVICE)}, req["collection"]),
        "org.freedesktop.Secret.Collection",
    )
    items = collection.SearchItems({"service": req["service"], "username": req["username"]})
    if req["op"] == "read":
        if not items:
            sys.exit(2)
        item = dbus.Interface(
            bus.get_object(${JSON.stringify(SECRET_SERVICE)}, items[0]),
            "org.freedesktop.Secret.Item",
        )
        secret = item.GetSecret(session_path)
        sys.stdout.buffer.write(bytes(secret[2]))
    else:
        label = "Password for '%s' on '%s'" % (req["username"], req["service"])
        properties = {
            "org.freedesktop.Secret.Item.Label": dbus.String(label, variant_level=1),
            "org.freedesktop.Secret.Item.Attributes": dbus.Dictionary(
                {"service": req["service"], "username": req["username"]},
                signature="ss",
                variant_level=1,
            ),
        }
        value = req["contents"].encode("utf-8")
        secret = dbus.Struct(
            (
                dbus.ObjectPath(session_path),
                dbus.ByteArray(b""),
                dbus.ByteArray(value),
                "text/plain; charset=utf-8",
            )
        )
        _item, prompt = collection.CreateItem(properties, secret, True)
        if str(prompt) != "/":
            sys.exit(4)
finally:
    dbus.Interface(
        bus.get_object(${JSON.stringify(SECRET_SERVICE)}, session_path),
        "org.freedesktop.Secret.Session",
    ).Close()
`

type SecretOp = { op: 'read' } | { op: 'write'; contents: string }

function dbusProperty(objectPath: string, interfaceName: string, property: string): string | null {
  try {
    const result = runProcessSync({
      program: 'gdbus',
      args: [
        'call',
        '--session',
        '--timeout',
        '1',
        '--dest',
        SECRET_SERVICE,
        '--object-path',
        objectPath,
        '--method',
        'org.freedesktop.DBus.Properties.Get',
        interfaceName,
        property
      ],
      timeoutMs: PROBE_TIMEOUT_MS,
      maxOutputBytes: 8_192
    })
    if (result.timedOut || result.code !== 0) {
      return null
    }
    return result.stdout
  } catch {
    return null
  }
}

/** Login collection when agy's go-keyring would use it, otherwise the default alias. */
export function antigravityLinuxCollectionPath(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if ((env.DBUS_SESSION_BUS_ADDRESS?.trim() ?? '') === '') {
    return null
  }
  const collections = dbusProperty(
    '/org/freedesktop/secrets',
    'org.freedesktop.Secret.Service',
    'Collections'
  )
  if (!collections) {
    return null
  }
  const path = collections.includes(LOGIN_COLLECTION) ? LOGIN_COLLECTION : DEFAULT_COLLECTION
  const locked = dbusProperty(path, 'org.freedesktop.Secret.Collection', 'Locked')
  return locked?.includes('<false>') ? path : null
}

export function isAntigravityLinuxSecretServiceReady(): boolean {
  return antigravityLinuxCollectionPath() !== null
}

async function invoke(
  collection: string,
  request: SecretOp
): Promise<{ code: number; stdout: string }> {
  let result: { code: number | null; stdout: string; timedOut: boolean; outputTruncated?: boolean }
  try {
    result = await runProcess({
      program: 'python3',
      args: ['-c', SECRET_SCRIPT],
      input: JSON.stringify({
        ...request,
        collection,
        service: SERVICE,
        username: ACCOUNT
      }),
      timeoutMs: STORE_TIMEOUT_MS,
      maxOutputBytes: 64 * 1024
    })
  } catch {
    throw new Error('The Antigravity Linux credential store could not be accessed.')
  }
  if (result.timedOut || result.outputTruncated || result.code === null) {
    throw new Error('The Antigravity Linux credential store could not be accessed.')
  }
  return { code: result.code, stdout: result.stdout }
}

export function createAntigravityLinuxCredentialBackend(
  markerPath: string
): AntigravityCredentialBackend {
  function requireStore(): string {
    if (existsSync(markerPath)) {
      throw new Error(KEYRING_MARKER)
    }
    const collection = antigravityLinuxCollectionPath()
    if (!collection) {
      throw new Error(ADAPTER_UNAVAILABLE)
    }
    return collection
  }
  async function read(): Promise<AntigravityNativeCredential | null> {
    const collection = requireStore()
    const result = await invoke(collection, { op: 'read' })
    if (result.code === 2) {
      return null
    }
    if (result.code !== 0) {
      throw new Error('The Antigravity Linux credential store could not be read.')
    }
    return parseAntigravityNativeCredential(decodeAntigravityKeychainValue(result.stdout))
  }
  return {
    read,
    async write(contents, expected) {
      parseAntigravityNativeCredential(contents)
      const current = await read()
      if (current?.contents !== (expected ?? undefined)) {
        throw new Error(
          'The native Antigravity credential changed during selection; refresh before retrying.'
        )
      }
      const collection = requireStore()
      const written = await invoke(collection, { op: 'write', contents })
      if (written.code !== 0) {
        throw new Error('The Antigravity Linux credential store could not be updated.')
      }
      const actual = await read()
      if (actual?.contents !== contents) {
        throw new Error('The Antigravity Linux credential update could not be verified.')
      }
    }
  }
}
