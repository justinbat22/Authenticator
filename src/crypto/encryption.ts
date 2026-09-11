import type { EncryptedBlob, KdfParams } from '../types/vault'
import { asBufferSource } from '../utils/binary'

/**
 * Default PBKDF2 iteration count. OWASP (2023) recommends 600,000 for
 * PBKDF2-HMAC-SHA256. New vaults use this; existing vaults keep whatever
 * count they were created with (stored in KdfParams) so unlocking never
 * silently changes behavior underneath an existing user.
 */
export const DEFAULT_PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const AES_KEY_LENGTH = 256
const GCM_IV_BYTES = 12
export const VMK_BYTES = 32 // 256-bit AES key material

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/** Generates fresh KDF parameters (new random salt) for a brand-new vault. */
export function createKdfParams(iterations = DEFAULT_PBKDF2_ITERATIONS): KdfParams {
  return {
    algorithm: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    saltB64: toBase64(randomBytes(SALT_BYTES)),
  }
}

/**
 * Derives a non-extractable AES-GCM Key-Encryption-Key (KEK) from a
 * passphrase using PBKDF2. This key is used ONLY to wrap/unwrap the Vault
 * Master Key — never to encrypt account data directly — and can never be
 * read back out of Web Crypto once derived.
 */
export async function derivePassphraseKey(
  passphrase: string,
  kdf: KdfParams,
): Promise<CryptoKey> {
  const passphraseBytes = new TextEncoder().encode(passphrase.normalize('NFKC'))
  const baseKey = await crypto.subtle.importKey('raw', asBufferSource(passphraseBytes), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(fromBase64(kdf.saltB64)),
      iterations: kdf.iterations,
      hash: kdf.hash,
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Imports raw bytes as an AES-GCM CryptoKey. Non-extractable by default. */
export async function importAesKey(rawKey: Uint8Array, extractable = false): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBufferSource(new Uint8Array(rawKey)), 'AES-GCM', extractable, [
    'encrypt',
    'decrypt',
  ])
}

/** Generates fresh random Vault Master Key bytes (256-bit). */
export function generateVmkBytes(): Uint8Array {
  return randomBytes(VMK_BYTES)
}

export async function encryptBytes(key: CryptoKey, plaintext: Uint8Array): Promise<EncryptedBlob> {
  const iv = randomBytes(GCM_IV_BYTES)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(new Uint8Array(plaintext)),
  )
  return { ivB64: toBase64(iv), ciphertextB64: toBase64(new Uint8Array(ciphertext)) }
}

/**
 * Decrypts an AES-256-GCM blob. Throws if the key is wrong or the data was
 * tampered with — GCM's authentication tag makes wrong-key and corrupted
 * data indistinguishable from each other, by design. Callers that want a
 * "was this the right key?" boolean should use tryDecryptBytes instead.
 */
export async function decryptBytes(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  const iv = fromBase64(blob.ivB64)
  const ciphertext = fromBase64(blob.ciphertextB64)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    key,
    asBufferSource(ciphertext),
  )
  return new Uint8Array(plaintext)
}

/** Like decryptBytes, but returns null instead of throwing on failure (wrong key / tampered data). */
export async function tryDecryptBytes(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array | null> {
  try {
    return await decryptBytes(key, blob)
  } catch {
    return null
  }
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  return encryptBytes(key, asBufferSource(new TextEncoder().encode(plaintext)))
}

export async function decryptString(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
  return new TextDecoder().decode(await decryptBytes(key, blob))
}

export async function encryptJson<T>(key: CryptoKey, value: T): Promise<EncryptedBlob> {
  return encryptString(key, JSON.stringify(value))
}

export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  return JSON.parse(await decryptString(key, blob)) as T
}
