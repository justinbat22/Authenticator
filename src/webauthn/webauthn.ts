import { decryptBytes, encryptBytes, importAesKey, randomBytes, toBase64, fromBase64 } from '../crypto/encryption'
import type { VaultMeta } from '../types/vault'
import { asBufferSource } from '../utils/binary'

/**
 * WebAuthn unlock in this app is PRF-only. The PRF ("pseudo-random
 * function") extension lets an authenticator return a deterministic,
 * secret-derived byte string during an assertion — that byte string is
 * used as key material for wrapping the Vault Master Key.
 *
 * Without PRF, WebAuthn can only tell you "user verification succeeded",
 * which is a device gate, not key material — it would not actually protect
 * the encrypted data, only gate a UI screen. We deliberately do not
 * implement that weaker mode and pretend it's equivalent encryption, since
 * that would overstate the app's security. If the authenticator/browser
 * doesn't support PRF, the WebAuthn unlock option is simply unavailable.
 */

const RP_NAME = 'Web Authenticator'
const PRF_SALT_BYTES = 32
const PRF_INFO = new TextEncoder().encode('web-authenticator-vault-unlock-v1')

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
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    '=',
  )
  return fromBase64(b64)
}

interface PrfExtensionResults {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } }
}

/**
 * Registers a new WebAuthn credential and, if the authenticator supports
 * PRF, wraps the provided VMK bytes under a key derived from its output.
 * Returns null (rather than throwing) if PRF isn't available, so the
 * caller can show "not supported on this device" instead of an error.
 */
export async function registerWebAuthnUnlock(
  vmkBytes: Uint8Array,
  accountLabel: string,
): Promise<VaultMeta['webAuthn'] | null> {
  if (!isWebAuthnSupported()) return null

  const userId = randomBytes(16)
  const prfSalt = randomBytes(PRF_SALT_BYTES)
  const challenge = randomBytes(32)

  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME },
      user: { id: asBufferSource(userId), name: accountLabel, displayName: accountLabel },
      challenge: asBufferSource(challenge),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256 fallback
      ],
      authenticatorSelection: { userVerification: 'required' },
      extensions: { prf: { eval: { first: asBufferSource(prfSalt) } } } as AuthenticationExtensionsClientInputs,
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!credential) return null

  const extensionResults = credential.getClientExtensionResults() as PrfExtensionResults
  const prfOutput = extensionResults.prf?.results?.first
  if (!extensionResults.prf?.enabled || !prfOutput) {
    // Authenticator/browser doesn't actually support PRF, despite creating
    // a credential. Nothing left to wrap with — report unsupported.
    return null
  }

  const kek = await derivePrfKek(prfOutput)
  const wrappedVmk = await encryptBytes(kek, vmkBytes)

  return {
    credentialId: bufferToBase64Url(credential.rawId),
    prfSaltB64: toBase64(prfSalt),
    wrappedVmk,
  }
}

/**
 * Prompts for a WebAuthn assertion and, on success, unwraps and returns
 * the VMK bytes as a usable CryptoKey. Throws if the assertion fails or
 * PRF output can't be obtained.
 */
export async function unlockWithWebAuthn(meta: VaultMeta): Promise<CryptoKey> {
  if (!meta.webAuthn) {
    throw new Error('WebAuthn unlock is not set up for this vault.')
  }
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not available in this browser.')
  }

  const challenge = randomBytes(32)
  const prfSalt = fromBase64(meta.webAuthn.prfSaltB64)
  const credentialId = base64UrlToBuffer(meta.webAuthn.credentialId)

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: asBufferSource(challenge),
      allowCredentials: [{ id: asBufferSource(credentialId), type: 'public-key' }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: asBufferSource(prfSalt) } } } as AuthenticationExtensionsClientInputs,
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!assertion) {
    throw new Error('WebAuthn unlock was cancelled.')
  }

  const extensionResults = assertion.getClientExtensionResults() as PrfExtensionResults
  const prfOutput = extensionResults.prf?.results?.first
  if (!prfOutput) {
    throw new Error('This authenticator did not return the expected key material.')
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
