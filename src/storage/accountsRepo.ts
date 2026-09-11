import { getDb } from './db'
import { decryptJson, encryptJson } from '../crypto/encryption'
import type { AuthenticatorAccount, NewAccountInput } from '../types/account'

function generateId(): string {
  // crypto.randomUUID is available in all modern browsers in secure contexts.
  return crypto.randomUUID()
}

/** Loads and decrypts every account, sorted by their stored order. */
export async function loadAllAccounts(key: CryptoKey): Promise<AuthenticatorAccount[]> {
  const db = await getDb()
  const records = await db.getAllFromIndex('accounts', 'by-order')
  const accounts = await Promise.all(
    records.map((record) => decryptJson<AuthenticatorAccount>(key, record.blob)),
  )
  return accounts
}

export async function createAccount(
  key: CryptoKey,
  input: NewAccountInput,
): Promise<AuthenticatorAccount> {
  const db = await getDb()
  const now = Date.now()
  const existingCount = await db.count('accounts')

  const account: AuthenticatorAccount = {
    ...input,
    id: generateId(),
    favorite: input.favorite ?? false,
    createdAt: now,
    updatedAt: now,
    order: existingCount,
  }

  const blob = await encryptJson(key, account)
  await db.put('accounts', {
    id: account.id,
    blob,
    order: account.order,
    updatedAt: account.updatedAt,
  })

  return account
}

export async function updateAccount(
  key: CryptoKey,
  account: AuthenticatorAccount,
): Promise<AuthenticatorAccount> {
  const db = await getDb()
  const updated: AuthenticatorAccount = { ...account, updatedAt: Date.now() }
  const blob = await encryptJson(key, updated)
  await db.put('accounts', {
    id: updated.id,
    blob,
    order: updated.order,
    updatedAt: updated.updatedAt,
  })
  return updated
}

export async function deleteAccount(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('accounts', id)
}

/** Persists a full reordering. `orderedIds` must contain every account id exactly once. */
export async function reorderAccounts(
  key: CryptoKey,
  accounts: AuthenticatorAccount[],
  orderedIds: string[],
): Promise<AuthenticatorAccount[]> {
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const db = await getDb()
  const tx = db.transaction('accounts', 'readwrite')

  const updatedAccounts: AuthenticatorAccount[] = []
  await Promise.all(
    orderedIds.map(async (id, index) => {
      const account = byId.get(id)
      if (!account) return
      const updated: AuthenticatorAccount = { ...account, order: index, updatedAt: Date.now() }
      updatedAccounts.push(updated)
      const blob = await encryptJson(key, updated)
      await tx.store.put({ id: updated.id, blob, order: updated.order, updatedAt: updated.updatedAt })
    }),
  )
  await tx.done
  return updatedAccounts.sort((a, b) => a.order - b.order)
}

export async function replaceAllAccounts(
  key: CryptoKey,
  accounts: NewAccountInput[],
): Promise<void> {
  const db = await getDb()
  await db.clear('accounts')
  const now = Date.now()
  const tx = db.transaction('accounts', 'readwrite')
  await Promise.all(
    accounts.map(async (input, index) => {
      const account: AuthenticatorAccount = {
        ...input,
        id: generateId(),
        favorite: input.favorite ?? false,
        createdAt: now,
        updatedAt: now,
        order: index,
      }
      const blob = await encryptJson(key, account)
      await tx.store.put({ id: account.id, blob, order: account.order, updatedAt: account.updatedAt })
    }),
  )
  await tx.done
}
