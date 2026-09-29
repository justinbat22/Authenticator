import { decryptBytes, encryptBytes, importAesKey, randomBytes, toBase64, fromBase64 } from '../crypto/encryption'
import type { VaultMeta } from '../types/vault'
import { asBufferSource } from '../utils/binary'

/**
 * WebAuthn unlock in this app is PRF-only. The PRF ("pseudo-random
 * function") extension lets an authenticator return a deterministic,
 * secret-derived byte string — that byte string is used as key material for
 * wrapping the Vault Master Key.
 *
 * Without PRF, WebAuthn can only tell you "user verification succeeded",
 * which is a device gate, not key material — it would not actually protect
 * the encrypted data, only gate a UI screen. We deliberately do not
 * implement that weaker mode and pretend it's equivalent encryption, since
 * that would overstate the app's security. If the authenticator/browser
 * doesn't support PRF, the WebAuthn unlock option is simply unavailable.
 */

const RP_NAME = 'sAuth Authenticator'
const PRF_SALT_BYTES = 32
const PRF_INFO = new TextEncoder().encode('sAuth-vault-unlock-v1')

/** The authenticator created the credential but exposes no PRF key material. */
export class PrfUnsupportedError extends Error {
  constructor() {
    super(
      'This authenticator did not return the key material device unlock needs. ' +
        'It supports passkeys, but not the WebAuthn PRF extension on top of them.',
    )
    this.name = 'PrfUnsupportedError'
  }
}

/** The user dismissed the fingerprint / screen-lock prompt. */
export class WebAuthnCancelledError extends Error {
  constructor() {
    super('Device verification was cancelled.')
    this.name = 'WebAuthnCancelledError'
  }
}

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator.credentials?.create === 'function'
  )
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuffer(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (b64.length % 4)) % 4
  return fromBase64(b64 + '='.repeat(padding))
}

interface PrfExtensionResults {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer; second?: ArrayBuffer } }
}

interface ClientExtensionCapable {
  getClientExtensionResults(): AuthenticationExtensionsClientOutputs
}

/**
 * Reads the PRF output out of a credential's extension results.
 *
 * Deliberately does NOT look at `prf.enabled`. That flag describes whether PRF
 * is available *for a future assertion* and is only populated on the
 * authentication ceremony. On a registration result the object is simply
 * `{ prf: { results: { first } } }`, so requiring `enabled` there would
 * discard a perfectly valid key and report a supported device as unsupported.
 * The presence of real key material is the only trustworthy signal.
 */
function readPrfOutput(credential: PublicKeyCredential): ArrayBuffer | null {
  const results = (credential as unknown as ClientExtensionCapable).getClientExtensionResults() as
    | PrfExtensionResults
    | undefined
  return results?.prf?.results?.first ?? null
}

function isCancellation(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'AbortError')
}

/**
 * Best-effort probe for whether this browser advertises PRF support, so the
 * UI can warn before the user enters their passphrase and runs a ceremony
 * that will fail at the very end.
 *
 * `getClientCapabilities()` is not universally shipped, so an unknown result
 * is reported as "supported" — a guess of "unsupported" would wrongly block
 * working devices. The real check still happens against the actual credential
 * during enrollment.
 */
export async function isPrfSupported(): Promise<boolean> {
  const staticClass = (typeof PublicKeyCredential !== 'undefined'
    ? PublicKeyCredential
    : undefined) as unknown as {
    getClientCapabilities?: () => Promise<Record<string, unknown>>
  } | undefined

  if (typeof staticClass?.getClientCapabilities !== 'function') return true
  try {
    const capabilities = await staticClass.getClientCapabilities()
    if (typeof capabilities?.prf === 'boolean') return capabilities.prf
  } catch {
    // Capability reporting can fail in cross-origin iframes; treat unknown
    // as supported and let the enrollment ceremony decide for real.
  }
  return true
}

/**
 * Registers a WebAuthn credential and wraps the VMK under a key derived from
 * the authenticator's PRF output.
 *
 * Authenticators fall into two groups here, and the flow handles both:
 *
 *  1. Those that return the first PRF value during `create()` — Google
 *     Password Manager, iCloud Keychain and other synced/CTAP 2.2
 *     authenticators. This is the common phone case, and it costs the user a
 *     single fingerprint prompt.
 *  2. Those that only expose PRF during `get()` — some security keys, Samsung
 *     Pass. For these we fall back to a follow-up assertion, which costs one
 *     extra prompt.
 *
 * So we always *ask* for the value at creation, and only prompt a second time
 * if the authenticator didn't produce one.
 *
 * Throws `WebAuthnCancelledError` if the user backs out, and
 * `PrfUnsupportedError` if the authenticator never yields key material.
 */
export async function registerWebAuthnUnlock(
  vmkBytes: Uint8Array,
  accountLabel: string,
): Promise<NonNullable<VaultMeta['webAuthn']>> {
  if (!isWebAuthnSupported()) throw new PrfUnsupportedError()

  const userId = randomBytes(16)
  const prfSalt = randomBytes(PRF_SALT_BYTES)

  let credential: PublicKeyCredential | null
  try {
    credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: RP_NAME },
        user: { id: asBufferSource(userId), name: accountLabel, displayName: accountLabel },
        challenge: asBufferSource(randomBytes(32)),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256 fallback
        ],
        authenticatorSelection: { userVerification: 'required' },
        // Ask for the first PRF value right here. Authenticators that support
        // PRF-on-create answer immediately and the user is prompted once.
        extensions: { prf: { eval: { first: asBufferSource(prfSalt) } } } as AuthenticationExtensionsClientInputs,
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
  } catch (err) {
    if (isCancellation(err)) throw new WebAuthnCancelledError()
    throw err
  }

  if (!credential) throw new WebAuthnCancelledError()
  const created = credential

  let prfOutput = readPrfOutput(created)

  if (!prfOutput) {
    // The authenticator created the credential but did not evaluate the PRF
    // during registration. Ask once more as an assertion, which is the only
    // point at which the other group of authenticators exposes it.
    prfOutput = await evaluatePrfViaAssertion(created.rawId, prfSalt)
  }

  if (!prfOutput) throw new PrfUnsupportedError()

  const kek = await derivePrfKek(prfOutput)
  const wrappedVmk = await encryptBytes(kek, vmkBytes)

  return {
    credentialId: bufferToBase64Url(created.rawId),
    prfSaltB64: toBase64(prfSalt),
    wrappedVmk,
  }
}

/**
 * Runs an assertion scoped to one credential and returns its PRF output, or
 * null if the authenticator has nothing to give. Cancellation propagates so
 * the caller can tell "user said no" apart from "not supported".
 */
async function evaluatePrfViaAssertion(
  credentialId: ArrayBuffer,
  prfSalt: Uint8Array,
): Promise<ArrayBuffer | null> {
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: asBufferSource(randomBytes(32)),
        allowCredentials: [{ id: asBufferSource(new Uint8Array(credentialId)), type: 'public-key' }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: asBufferSource(prfSalt) } } } as AuthenticationExtensionsClientInputs,
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null

    return assertion ? readPrfOutput(assertion) : null
  } catch (err) {
    if (isCancellation(err)) throw new WebAuthnCancelledError()
    return null
  }
}

/**
 * Prompts for a WebAuthn assertion and, on success, unwraps and returns the
 * VMK as a usable CryptoKey. Throws if the assertion fails or the
 * authenticator can't reproduce the enrolled key material.
 */
export async function unlockWithWebAuthn(meta: VaultMeta): Promise<CryptoKey> {
  if (!meta.webAuthn) {
    throw new Error('WebAuthn unlock is not set up for this vault.')
  }
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not available in this browser.')
  }

  const prfSalt = fromBase64(meta.webAuthn.prfSaltB64)
  const credentialId = base64UrlToBuffer(meta.webAuthn.credentialId)

  let assertion: PublicKeyCredential | null
  try {
    assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: asBufferSource(randomBytes(32)),
        allowCredentials: [{ id: asBufferSource(credentialId), type: 'public-key' }],
        userVerification: 'required',
        extensions: { prf: { eval: { first: asBufferSource(prfSalt) } } } as AuthenticationExtensionsClientInputs,
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
  } catch (err) {
    if (isCancellation(err)) throw new WebAuthnCancelledError()
    throw err
  }

  if (!assertion) throw new WebAuthnCancelledError()

  const prfOutput = readPrfOutput(assertion)
  if (!prfOutput) {
    throw new PrfUnsupportedError()
  }

  const kek = await derivePrfKek(prfOutput)
  const vmkBytes = await decryptBytes(kek, meta.webAuthn.wrappedVmk)
  return importAesKey(vmkBytes)
}

/** Derives a non-extractable AES-GCM KEK from raw PRF output bytes via HKDF. */
async function derivePrfKek(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: asBufferSource(new Uint8Array(0)), info: asBufferSource(PRF_INFO) },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}
