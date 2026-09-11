import { getDb } from './db'
import type { VaultMeta } from '../types/vault'

const META_KEY = 'meta'

export async function loadVaultMeta(): Promise<VaultMeta | null> {
  const db = await getDb()
  const record = await db.get('meta', META_KEY)
  return (record?.value as VaultMeta | undefined) ?? null
}

export async function saveVaultMeta(meta: VaultMeta): Promise<void> {
  const db = await getDb()
  await db.put('meta', { key: META_KEY, value: meta })
}

export async function vaultExists(): Promise<boolean> {
  return (await loadVaultMeta()) !== null
}
