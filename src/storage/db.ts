import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { EncryptedBlob } from '../types/vault'
import { DB_SCHEMA_VERSION } from '../types/vault'

/**
 * Every account record is stored individually, encrypted, in IndexedDB.
 * We never store an unencrypted account, and we never store the vault key
 * itself — only material needed to re-derive or unwrap it.
 */
export interface EncryptedAccountRecord {
  id: string
  /** Encrypted JSON of the full AuthenticatorAccount. */
  blob: EncryptedBlob
  /** Plaintext sort order — not secret, needed for cheap IDB range queries. */
  order: number
  updatedAt: number
}

export interface VaultMetaRecord {
  key: 'meta'
  value: unknown // serialized VaultMeta; kept loosely typed at the DB boundary
}

interface AuthenticatorDB extends DBSchema {
  accounts: {
    key: string
    value: EncryptedAccountRecord
    indexes: { 'by-order': number }
  }
  meta: {
    key: string
    value: VaultMetaRecord
  }
}

const DB_NAME = 'web-authenticator'

let dbPromise: Promise<IDBPDatabase<AuthenticatorDB>> | null = null

export function getDb(): Promise<IDBPDatabase<AuthenticatorDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AuthenticatorDB>(DB_NAME, DB_SCHEMA_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('accounts')) {
          const store = db.createObjectStore('accounts', { keyPath: 'id' })
          store.createIndex('by-order', 'order')
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}

/** Wipes all local data. Used by "reset app" / forgot-passphrase recovery. */
export async function wipeDatabase(): Promise<void> {
  const db = await getDb()
  await db.clear('accounts')
  await db.clear('meta')
}

/**
 * Closes the cached connection and clears the module-level cache so the
 * next getDb() call opens fresh. Used by tests, and by "erase all data"
 * flows that delete the whole IndexedDB database rather than just its
 * contents.
 */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
}
