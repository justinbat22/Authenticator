import { describe, expect, it } from 'vitest'
import type { AuthenticatorAccount } from '../../types/account'
import { BackupError, createBackup, MIN_BACKUP_PASSWORD_LENGTH, readBackup } from './backupService'

function makeAccount(overrides: Partial<AuthenticatorAccount> = {}): AuthenticatorAccount {
  return {
    id: crypto.randomUUID(),
    issuer: 'Example',
    accountName: 'alice@example.com',
    secret: 'JBSWY3DPEHPK3PXP',
    algorithm: 'SHA-1',
    digits: 6,
    period: 30,
    type: 'totp',
    favorite: false,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('backupService', () => {
  it('round-trips accounts through create/read', async () => {
    const accounts = [makeAccount(), makeAccount({ issuer: 'Other', order: 1 })]
    const backup = await createBackup(accounts, 'backup password 123')
    const restored = await readBackup(JSON.stringify(backup), 'backup password 123')

    expect(restored).toHaveLength(2)
    expect(restored.map((a) => a.issuer).sort()).toEqual(['Example', 'Other'])
    expect(restored[0].secret).toBe('JBSWY3DPEHPK3PXP')
  })

  it('rejects a too-short backup password', async () => {
    await expect(createBackup([makeAccount()], 'short')).rejects.toThrow()
    expect(MIN_BACKUP_PASSWORD_LENGTH).toBeGreaterThanOrEqual(8)
  })

  it('rejects the wrong backup password', async () => {
    const backup = await createBackup([makeAccount()], 'correct password')
    await expect(readBackup(JSON.stringify(backup), 'wrong password')).rejects.toThrow(BackupError)
  })

  it('rejects non-JSON input', async () => {
    await expect(readBackup('not json at all {{{', 'password123')).rejects.toThrow(BackupError)
  })

  it('rejects JSON that is not a recognized backup', async () => {
    await expect(readBackup(JSON.stringify({ hello: 'world' }), 'password123')).rejects.toThrow(
      BackupError,
    )
  })

  it('rejects an unsupported backup version', async () => {
    const backup = await createBackup([makeAccount()], 'password123')
    const tampered = { ...backup, version: 999 }
    await expect(readBackup(JSON.stringify(tampered), 'password123')).rejects.toThrow(
      /version/i,
    )
  })

  it('rejects a corrupted payload (tampered ciphertext)', async () => {
    const backup = await createBackup([makeAccount()], 'password123')
    const tampered = {
      ...backup,
      payload: { ...backup.payload, ciphertextB64: backup.payload.ciphertextB64.slice(0, -8) + 'AAAAAAAA' },
    }
    await expect(readBackup(JSON.stringify(tampered), 'password123')).rejects.toThrow(BackupError)
  })

  it('skips individually corrupt account entries instead of aborting the whole restore', async () => {
    const good = makeAccount({ issuer: 'GoodOne' })
    const mixed = await createBackup(
      [good, makeAccount({ issuer: 'BadOne', secret: 'not-valid-base32!!!' })],
      'password123',
    )
    const restored = await readBackup(JSON.stringify(mixed), 'password123')
    expect(restored).toHaveLength(1)
    expect(restored[0].issuer).toBe('GoodOne')
  })

  it('rejects a backup whose accounts are entirely unreadable', async () => {
    const backup = await createBackup(
      [makeAccount({ secret: 'not-valid-base32!!!' })],
      'password123',
    )
    await expect(readBackup(JSON.stringify(backup), 'password123')).rejects.toThrow(BackupError)
  })

  it('accepts a backup with zero accounts', async () => {
    const backup = await createBackup([], 'password123')
    const restored = await readBackup(JSON.stringify(backup), 'password123')
    expect(restored).toEqual([])
  })
})
