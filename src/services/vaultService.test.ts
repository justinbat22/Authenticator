import { beforeEach, describe, expect, it } from 'vitest'
import { closeDb } from '../storage/db'
import { loadVaultMeta } from '../storage/vaultRepo'
import { createAccount, loadAllAccounts } from '../storage/accountsRepo'
import {
  changePassphrase,
  IncorrectPassphraseError,
  initializeVault,
  unlockVault,
  WeakPassphraseError,
} from './vaultService'

beforeEach(async () => {
  // Each test starts from a completely fresh IndexedDB so vault-existence
  // checks and account data never leak across tests.
  await closeDb()
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('web-authenticator')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
})

describe('vaultService', () => {
  it('initializes a new vault and derives a usable key', async () => {
    const { meta, key } = await initializeVault('correct horse battery staple')
    expect(meta.version).toBe(1)
    expect(meta.wrappedVmk.ciphertextB64).toBeTruthy()
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' })

    const stored = await loadVaultMeta()
    expect(stored).not.toBeNull()
  })

  it('rejects a too-short passphrase', async () => {
    await expect(initializeVault('short')).rejects.toThrow(WeakPassphraseError)
  })

  it('refuses to initialize a second vault on the same device', async () => {
    await initializeVault('correct horse battery staple')
    await expect(initializeVault('another passphrase entirely')).rejects.toThrow()
  })

  it('unlocks with the correct passphrase and rejects the wrong one', async () => {
    const { meta } = await initializeVault('correct horse battery staple')
    const key = await unlockVault('correct horse battery staple', meta)
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' })

    await expect(unlockVault('totally wrong', meta)).rejects.toThrow(IncorrectPassphraseError)
  })

  it('lets accounts created under the initial key be read back after a fresh unlock', async () => {
    const { meta, key } = await initializeVault('correct horse battery staple')
    await createAccount(key, {
      issuer: 'Example',
      accountName: 'alice@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
      type: 'totp',
    })

    const reUnlockedKey = await unlockVault('correct horse battery staple', meta)
    const accounts = await loadAllAccounts(reUnlockedKey)
    expect(accounts).toHaveLength(1)
    expect(accounts[0].issuer).toBe('Example')
    expect(accounts[0].secret).toBe('JBSWY3DPEHPK3PXP')
  })

  it('changes the passphrase without needing to touch account ciphertext', async () => {
    const { meta, key } = await initializeVault('old passphrase here')
    await createAccount(key, {
      issuer: 'Example',
      accountName: 'alice@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
      type: 'totp',
    })

    const { meta: newMeta, key: newKey } = await changePassphrase(
      key,
      meta,
      'old passphrase here',
      'brand new passphrase',
    )

    // Old passphrase no longer works.
    await expect(unlockVault('old passphrase here', newMeta)).rejects.toThrow(
      IncorrectPassphraseError,
    )
    // New passphrase works and sees the same accounts under the same VMK.
    const unlockedWithNew = await unlockVault('brand new passphrase', newMeta)
    const accounts = await loadAllAccounts(unlockedWithNew)
    expect(accounts).toHaveLength(1)
    expect(accounts[0].secret).toBe('JBSWY3DPEHPK3PXP')

    // The key returned directly from changePassphrase also works immediately.
    const accountsFromReturnedKey = await loadAllAccounts(newKey)
    expect(accountsFromReturnedKey).toHaveLength(1)
  })

  it('rejects a passphrase change when the current passphrase is wrong', async () => {
    const { meta, key } = await initializeVault('old passphrase here')
    await expect(
      changePassphrase(key, meta, 'not the real passphrase', 'brand new passphrase'),
    ).rejects.toThrow(IncorrectPassphraseError)
  })
})
