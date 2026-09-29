import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptString, encryptString, randomBytes } from '../crypto/encryption'
import {
  isPrfSupported,
  PrfUnsupportedError,
  registerWebAuthnUnlock,
  unlockWithWebAuthn,
  WebAuthnCancelledError,
} from './webauthn'
import type { VaultMeta } from '../types/vault'

/**
 * These tests pin down how PRF key material is obtained.
 *
 * The original bug: registration asked for the PRF value via
 * `prf: { eval: ... }` during `create()` — which is right, and is what
 * Google Password Manager / iCloud Keychain answer immediately — but then
 * required `prf.enabled` to be truthy. That flag is only populated on an
 * *assertion*, so at registration it was `undefined`, the guard fired, and a
 * perfectly valid key was thrown away. A supported phone was reported as
 * unsupported.
 *
 * The flow now accepts the value from `create()` (one prompt), and only runs
 * a follow-up `get()` for authenticators that expose PRF at auth time only.
 */

const PRF_OUTPUT = new Uint8Array(32).fill(7)

/** What the authenticator returns for the create() ceremony. */
type CreateMode = 'prf-on-create' | 'prf-on-create-no-enabled' | 'no-prf' | 'null'
/** What the authenticator returns for a get() ceremony. */
type GetMode = 'prf' | 'no-prf' | 'null' | 'cancelled'

type CredentialOptions = { publicKey?: unknown }

function makeCreateCredential(prf: Record<string, unknown> | undefined) {
  return {
    rawId: randomBytes(16).buffer,
    id: 'fake-id',
    type: 'public-key',
    // Note: no `prf.enabled`. That is exactly what a real registration
    // result looks like, and it used to be treated as "unsupported".
    getClientExtensionResults: () => (prf ? { prf } : {}),
  }
}

function makeGetCredential(prf: Record<string, unknown> | undefined) {
  return {
    rawId: randomBytes(16).buffer,
    id: 'fake-id',
    type: 'public-key',
    getClientExtensionResults: () => (prf ? { prf } : {}),
  }
}

const PRF_WITH_OUTPUT = {
  enabled: true,
  results: { first: PRF_OUTPUT.buffer as ArrayBuffer },
}

/**
 * The real shape of a registration result from Google Password Manager /
 * iCloud Keychain: the key material is present, but there is no `enabled`
 * field at all. The original bug required `prf.enabled`, so this exact shape
 * was rejected even though the key was right there and valid.
 */
const PRF_ON_CREATE_NO_ENABLED = {
  results: { first: PRF_OUTPUT.buffer as ArrayBuffer },
}

function installWebAuthnMocks(createMode: CreateMode, getMode: GetMode) {
  const create = vi.fn(async (_options: CredentialOptions) => {
    switch (createMode) {
      case 'prf-on-create':
        return makeCreateCredential(PRF_WITH_OUTPUT)
      case 'prf-on-create-no-enabled':
        return makeCreateCredential(PRF_ON_CREATE_NO_ENABLED)
      case 'no-prf':
        return makeCreateCredential({ enabled: true })
      case 'null':
        return null
    }
  })

  const get = vi.fn(async (_options: CredentialOptions) => {
    switch (getMode) {
      case 'prf':
        return makeGetCredential(PRF_WITH_OUTPUT)
      case 'no-prf':
        return makeGetCredential({ enabled: false })
      case 'null':
        return null
      case 'cancelled':
        throw new DOMException('cancelled', 'NotAllowedError')
    }
  })

  Object.defineProperty(globalThis, 'PublicKeyCredential', {
    configurable: true,
    value: function PublicKeyCredentialStub() {},
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { PublicKeyCredential: globalThis.PublicKeyCredential },
  })
  Object.defineProperty(navigator, 'credentials', { configurable: true, value: { create, get } })

  return { create, get }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('registerWebAuthnUnlock', () => {
  it('accepts PRF output returned by create() even when prf.enabled is absent', async () => {
    // This is the regression: a real registration returns
    // `{ prf: { results: { first } } }` with no `enabled` key. The old code
    // required `enabled`, so it discarded this valid key and reported the
    // device as unsupported.
    installWebAuthnMocks('prf-on-create-no-enabled', 'no-prf')

    const result = await registerWebAuthnUnlock(randomBytes(32), 'sAuth test')
    expect(result).not.toBeNull()
    expect(result.credentialId).toBeTruthy()
    expect(result.prfSaltB64).toBeTruthy()
    expect(result.wrappedVmk.ciphertextB64).toBeTruthy()
  })

  it('accepts PRF output returned by create() when prf.enabled is present', async () => {
    installWebAuthnMocks('prf-on-create', 'no-prf')
    const result = await registerWebAuthnUnlock(randomBytes(32), 'sAuth test')
    expect(result).not.toBeNull()
    expect(result.wrappedVmk.ciphertextB64).toBeTruthy()
  })

  it('asks for the PRF value during create()', async () => {
    const { create, get } = installWebAuthnMocks('prf-on-create', 'no-prf')
    await registerWebAuthnUnlock(randomBytes(32), 'sAuth test')

    const publicKey = create.mock.calls[0][0].publicKey as {
      extensions: { prf: { eval: { first: Uint8Array } } }
    }
    expect(publicKey.extensions.prf.eval.first).toBeInstanceOf(Uint8Array)
    expect(publicKey.extensions.prf.eval.first.length).toBe(32)

    // One fingerprint prompt on a PRF-on-create authenticator.
    expect(create).toHaveBeenCalledTimes(1)
    expect(get).not.toHaveBeenCalled()
  })

  it('falls back to a follow-up assertion when create() returns no PRF value', async () => {
    // Authenticators that only expose PRF at authentication time.
    const { create, get } = installWebAuthnMocks('no-prf', 'prf')
    const result = await registerWebAuthnUnlock(randomBytes(32), 'sAuth test')

    expect(result).not.toBeNull()
    expect(create).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledTimes(1)

    const requestKey = get.mock.calls[0][0].publicKey as {
      allowCredentials: Array<{ id: Uint8Array }>
      extensions: { prf: { eval: { first: Uint8Array } } }
    }
    // The assertion must reuse the credential we just created...
    expect(requestKey.allowCredentials).toHaveLength(1)
    // ...and the same salt, so unlock can reproduce the key later.
    const createSalt = (create.mock.calls[0][0].publicKey as {
      extensions: { prf: { eval: { first: Uint8Array } } }
    }).extensions.prf.eval.first
    expect(Array.from(requestKey.extensions.prf.eval.first)).toEqual(Array.from(createSalt))
  })

  it('uses the same PRF salt at enrollment and at unlock', async () => {
    const { create, get } = installWebAuthnMocks('no-prf', 'prf')
    const enrolled = await registerWebAuthnUnlock(randomBytes(32), 'sAuth test')
    await unlockWithWebAuthn({ webAuthn: enrolled } as VaultMeta)

    const saltOf = (call: CredentialOptions) =>
      Array.from(
        (call.publicKey as { extensions: { prf: { eval: { first: Uint8Array } } } }).extensions.prf
          .eval.first,
      )
    expect(saltOf(get.mock.calls[1][0])).toEqual(saltOf(create.mock.calls[0][0]))
  })

  it('throws PrfUnsupportedError when neither ceremony yields key material', async () => {
    installWebAuthnMocks('no-prf', 'no-prf')
    await expect(registerWebAuthnUnlock(randomBytes(32), 'sAuth test')).rejects.toThrow(
      PrfUnsupportedError,
    )
  })

  it('reports cancellation separately from lack of support', async () => {
    // User backed out of the very first prompt.
    installWebAuthnMocks('null', 'prf')
    await expect(registerWebAuthnUnlock(randomBytes(32), 'sAuth test')).rejects.toThrow(
      WebAuthnCancelledError,
    )
  })

  it('reports cancellation of the follow-up assertion', async () => {
    installWebAuthnMocks('no-prf', 'cancelled')
    await expect(registerWebAuthnUnlock(randomBytes(32), 'sAuth test')).rejects.toThrow(
      WebAuthnCancelledError,
    )
  })

  it('surfaces unexpected authenticator errors rather than swallowing them', async () => {
    const { create } = installWebAuthnMocks('no-prf', 'no-prf')
    create.mockRejectedValueOnce(new DOMException('something went wrong', 'InvalidStateError'))
    await expect(registerWebAuthnUnlock(randomBytes(32), 'sAuth test')).rejects.toThrow(
      /something went wrong/,
    )
  })
})

describe('unlockWithWebAuthn', () => {
  it('unwraps the same VMK bytes that were enrolled', async () => {
    installWebAuthnMocks('prf-on-create', 'prf')
    const vmk = randomBytes(32)
    const enrolled = await registerWebAuthnUnlock(vmk, 'sAuth test')

    const key = await unlockWithWebAuthn({ webAuthn: enrolled } as VaultMeta)
    const blob = await encryptString(key, 'round trip')
    await expect(decryptString(key, blob)).resolves.toBe('round trip')
  })

  it('rejects when the vault has no WebAuthn enrollment', async () => {
    installWebAuthnMocks('prf-on-create', 'prf')
    await expect(unlockWithWebAuthn({} as VaultMeta)).rejects.toThrow(/not set up/i)
  })

  it('reports a cancelled unlock', async () => {
    installWebAuthnMocks('prf-on-create', 'cancelled')
    const enrolled = await registerWebAuthnUnlock(randomBytes(32), 'sAuth test')
    await expect(unlockWithWebAuthn({ webAuthn: enrolled } as VaultMeta)).rejects.toThrow(
      WebAuthnCancelledError,
    )
  })
})

describe('isPrfSupported', () => {
  it('reports the advertised capability when the browser exposes one', async () => {
    ;(
      globalThis.PublicKeyCredential as unknown as {
        getClientCapabilities: () => Promise<Record<string, boolean>>
      }
    ).getClientCapabilities = async () => ({ prf: true })
    await expect(isPrfSupported()).resolves.toBe(true)
  })

  it('reports unsupported when the browser advertises no PRF', async () => {
    ;(
      globalThis.PublicKeyCredential as unknown as {
        getClientCapabilities: () => Promise<Record<string, boolean>>
      }
    ).getClientCapabilities = async () => ({ prf: false })
    await expect(isPrfSupported()).resolves.toBe(false)
  })

  it('optimistically reports supported when the browser cannot tell us', async () => {
    delete (
      globalThis.PublicKeyCredential as unknown as { getClientCapabilities?: unknown }
    ).getClientCapabilities
    await expect(isPrfSupported()).resolves.toBe(true)
  })
})
