import {
  createKdfParams,
  derivePassphraseKey,
  encryptBytes,
  generateVmkBytes,
  importAesKey,
  tryDecryptBytes,
} from '../crypto/encryption'
import { loadVaultMeta, saveVaultMeta } from '../storage/vaultRepo'
import type { VaultMeta } from '../types/vault'
import { ENCRYPTION_FORMAT_VERSION } from '../types/vault'

export const DEFAULT_AUTO_LOCK_MINUTES = 5
export const MIN_PASSPHRASE_LENGTH = 8

export class WeakPassphraseError extends Error {
  constructor() {
    super(`Your passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
    this.name = 'WeakPassphraseError'
  }
}

export class IncorrectPassphraseError extends Error {
  constructor() {
    super('That passphrase is incorrect.')
    this.name = 'IncorrectPassphraseError'
  }
}

/** Creates a brand-new vault (first run). Fails if one already exists. */
export async function initializeVault(
  passphrase: string,
  autoLockMinutes: number = DEFAULT_AUTO_LOCK_MINUTES,
): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new WeakPassphraseError()
  }
  if (await loadVaultMeta()) {
    throw new Error('A vault already exists on this device.')
  }

  const kdf = createKdfParams()
  const kek = await derivePassphraseKey(passphrase, kdf)
  const vmkBytes = generateVmkBytes()
  const wrappedVmk = await encryptBytes(kek, vmkBytes)
  const key = await importAesKey(vmkBytes)

  const meta: VaultMeta = {
    version: ENCRYPTION_FORMAT_VERSION,
    kdf,
    wrappedVmk,
    autoLockMinutes,
    createdAt: Date.now(),
  }

  await saveVaultMeta(meta)
  return { meta, key }
}

/**
 * Attempts to unlock an existing vault with a passphrase. Returns the
 * Vault Master Key (ready to use for account encryption) on success.
 */
export async function unlockVault(passphrase: string, meta: VaultMeta): Promise<CryptoKey> {
  const kek = await derivePassphraseKey(passphrase, meta.kdf)
  const vmkBytes = await tryDecryptBytes(kek, meta.wrappedVmk)
  if (!vmkBytes) {
    throw new IncorrectPassphraseError()
  }
  return importAesKey(vmkBytes)
}

/**
 * Changes the vault passphrase. Because account data is encrypted under
 * the VMK (not the passphrase-derived key directly), this only needs to
 * re-wrap the VMK under a new KEK — no account re-encryption required.
 */
export async function changePassphrase(
  currentKey: CryptoKey,
  meta: VaultMeta,
  currentPassphrase: string,
  newPassphrase: string,
): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  if (newPassphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new WeakPassphraseError()
  }

  // Re-verify the current passphrase against the stored KDF params rather
  // than trusting the caller's in-memory key, so a stale/forged key can't
  // be used to silently rewrap the vault.
  const currentKek = await derivePassphraseKey(currentPassphrase, meta.kdf)
  const vmkBytes = await tryDecryptBytes(currentKek, meta.wrappedVmk)
  if (!vmkBytes) {
    throw new IncorrectPassphraseError()
  }

  const newKdf = createKdfParams()
  const newKek = await derivePassphraseKey(newPassphrase, newKdf)
  const wrappedVmk = await encryptBytes(newKek, vmkBytes)

  const newMeta: VaultMeta = {
    ...meta,
    kdf: newKdf,
    wrappedVmk,
    // A WebAuthn-wrapped copy of the VMK is still valid — it wraps the
    // same VMK bytes, which have not changed — so it is intentionally
    // preserved across a passphrase change.
  }
  await saveVaultMeta(newMeta)

  // currentKey (unchanged VMK) remains valid for the rest of this session.
  void currentKey
  return { meta: newMeta, key: await importAesKey(vmkBytes) }
}

export async function updateAutoLockMinutes(meta: VaultMeta, minutes: number): Promise<VaultMeta> {
  const updated: VaultMeta = { ...meta, autoLockMinutes: minutes }
  await saveVaultMeta(updated)
  return updated
}
