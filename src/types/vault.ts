/** Current on-disk schema versions. Bump on any breaking format change. */
export const DB_SCHEMA_VERSION = 1
export const BACKUP_FORMAT_VERSION = 1
export const ENCRYPTION_FORMAT_VERSION = 1

export type LockState = 'uninitialized' | 'locked' | 'unlocked'

/** Parameters needed to re-derive the vault key from a passphrase. */
export interface KdfParams {
  algorithm: 'PBKDF2'
  hash: 'SHA-256'
  iterations: number
  saltB64: string
}

/**
 * Stored (unencrypted) vault metadata.
 *
 * Key architecture: account data is encrypted under a random 256-bit Vault
 * Master Key (VMK) generated once at vault creation. The VMK itself is
 * never stored in the clear — only wrapped (encrypted) copies of it are
 * stored, one per unlock method:
 *
 *   - `wrappedVmk`: VMK encrypted under a PBKDF2 key derived from the
 *     passphrase. This also doubles as the passphrase check: if it fails
 *     to decrypt, the passphrase was wrong (AES-GCM's auth tag makes this
 *     safe — no separate canary value is needed).
 *   - `webAuthn.wrappedVmk`: VMK encrypted under a key derived from a
 *     WebAuthn PRF extension output, present only if the user opted in.
 *
 * This means changing the passphrase only requires re-wrapping the VMK
 * (cheap, instant) rather than re-encrypting every account.
 */
export interface VaultMeta {
  version: number
  kdf: KdfParams
  wrappedVmk: EncryptedBlob
  webAuthn?: {
    credentialId: string
    /** App-chosen salt fed into the PRF extension to get deterministic output. */
    prfSaltB64: string
    wrappedVmk: EncryptedBlob
  }
  autoLockMinutes: number
  createdAt: number
}

export interface EncryptedBlob {
  ivB64: string
  ciphertextB64: string
}

/** Encrypted backup file structure written to disk on export. */
export interface BackupFile {
  format: 'web-authenticator-backup'
  version: number
  createdAt: number
  kdf: KdfParams
  payload: EncryptedBlob
}

/** Decrypted contents of a backup, before being merged/replaced into the vault. */
export interface BackupPayload {
  version: number
  accounts: Array<{
    issuer: string
    accountName: string
    secret: string
    algorithm: string
    digits: number
    period: number
    type: 'totp'
    favorite: boolean
    order: number
  }>
}
