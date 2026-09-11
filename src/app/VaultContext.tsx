import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthenticatorAccount, NewAccountInput } from '../types/account'
import type { VaultMeta } from '../types/vault'
import { loadVaultMeta, saveVaultMeta } from '../storage/vaultRepo'
import {
  createAccount as repoCreateAccount,
  deleteAccount as repoDeleteAccount,
  loadAllAccounts,
  replaceAllAccounts,
  reorderAccounts as repoReorderAccounts,
  updateAccount as repoUpdateAccount,
} from '../storage/accountsRepo'
import {
  changePassphrase as serviceChangePassphrase,
  DEFAULT_AUTO_LOCK_MINUTES,
  initializeVault,
  unlockVault,
  updateAutoLockMinutes,
} from '../services/vaultService'
import { isWebAuthnSupported, unlockWithWebAuthn } from '../webauthn/webauthn'
import { useAutoLock } from '../hooks/useAutoLock'

type AppStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked'

export interface VaultContextValue {
  status: AppStatus
  meta: VaultMeta | null
  accounts: AuthenticatorAccount[]
  webAuthnSupported: boolean
  webAuthnEnrolled: boolean

  createVault: (passphrase: string, autoLockMinutes?: number) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  unlockViaWebAuthn: () => Promise<void>
  lock: () => void
  changePassphrase: (current: string, next: string) => Promise<void>
  setAutoLockMinutes: (minutes: number) => Promise<void>
  disableWebAuthn: () => Promise<void>
  /** Lets a screen (e.g. Settings, after a successful WebAuthn enrollment) push an updated meta into context. */
  applyMetaUpdate: (meta: VaultMeta) => void

  addAccount: (input: NewAccountInput) => Promise<AuthenticatorAccount>
  editAccount: (account: AuthenticatorAccount) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  reorder: (orderedIds: string[]) => Promise<void>
  replaceAllAccountsFromBackup: (accounts: AuthenticatorAccount[]) => Promise<void>
  mergeAccountsFromBackup: (accounts: AuthenticatorAccount[]) => Promise<void>

  /** Exposed narrowly for the backup/export screen, which needs the raw key. */
  getVaultKeyForExport: () => CryptoKey | null
}

export const VaultContext = createContext<VaultContextValue | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus>('loading')
  const [meta, setMeta] = useState<VaultMeta | null>(null)
  const [accounts, setAccounts] = useState<AuthenticatorAccount[]>([])
  const keyRef = useRef<CryptoKey | null>(null)
  const webAuthnSupported = useMemo(() => isWebAuthnSupported(), [])

  useEffect(() => {
    loadVaultMeta().then((existing) => {
      if (existing) {
        setMeta(existing)
        setStatus('locked')
      } else {
        setStatus('uninitialized')
      }
    })
  }, [])

  const refreshAccounts = useCallback(async () => {
    if (!keyRef.current) return
    setAccounts(await loadAllAccounts(keyRef.current))
  }, [])

  const lock = useCallback(() => {
    keyRef.current = null
    setAccounts([])
    setStatus(meta ? 'locked' : 'uninitialized')
  }, [meta])

  useAutoLock(meta?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES, () => {
    if (status === 'unlocked') lock()
  })

  const createVault = useCallback(async (passphrase: string, autoLockMinutes?: number) => {
    const result = await initializeVault(passphrase, autoLockMinutes)
    keyRef.current = result.key
    setMeta(result.meta)
    setStatus('unlocked')
    setAccounts([])
  }, [])

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!meta) throw new Error('No vault exists yet.')
      const key = await unlockVault(passphrase, meta)
      keyRef.current = key
      setStatus('unlocked')
      setAccounts(await loadAllAccounts(key))
    },
    [meta],
  )

  const unlockViaWebAuthn = useCallback(async () => {
    if (!meta) throw new Error('No vault exists yet.')
    const key = await unlockWithWebAuthn(meta)
    keyRef.current = key
    setStatus('unlocked')
    setAccounts(await loadAllAccounts(key))
  }, [meta])

  const changePassphrase = useCallback(
    async (current: string, next: string) => {
      if (!meta || !keyRef.current) throw new Error('Vault is locked.')
      const result = await serviceChangePassphrase(keyRef.current, meta, current, next)
      keyRef.current = result.key
      setMeta(result.meta)
    },
    [meta],
  )

  const setAutoLockMinutesCb = useCallback(
    async (minutes: number) => {
      if (!meta) return
      setMeta(await updateAutoLockMinutes(meta, minutes))
    },
    [meta],
  )

  const applyMetaUpdate = useCallback((updated: VaultMeta) => {
    setMeta(updated)
  }, [])

  const disableWebAuthn = useCallback(async () => {
    if (!meta) return
    const { webAuthn, ...rest } = meta
    void webAuthn
    const updated = { ...rest }
    setMeta(updated)
    await saveVaultMeta(updated)
  }, [meta])

  const addAccount = useCallback(
    async (input: NewAccountInput) => {
      if (!keyRef.current) throw new Error('Vault is locked.')
      const account = await repoCreateAccount(keyRef.current, input)
      await refreshAccounts()
      return account
    },
    [refreshAccounts],
  )

  const editAccount = useCallback(
    async (account: AuthenticatorAccount) => {
      if (!keyRef.current) throw new Error('Vault is locked.')
      await repoUpdateAccount(keyRef.current, account)
      await refreshAccounts()
    },
    [refreshAccounts],
  )

  const removeAccount = useCallback(
    async (id: string) => {
      await repoDeleteAccount(id)
      await refreshAccounts()
    },
    [refreshAccounts],
  )

  const toggleFavorite = useCallback(
    async (id: string) => {
      if (!keyRef.current) throw new Error('Vault is locked.')
      const account = accounts.find((a) => a.id === id)
      if (!account) return
      await repoUpdateAccount(keyRef.current, { ...account, favorite: !account.favorite })
      await refreshAccounts()
    },
    [accounts, refreshAccounts],
  )

  const reorder = useCallback(
    async (orderedIds: string[]) => {
      if (!keyRef.current) throw new Error('Vault is locked.')
      const updated = await repoReorderAccounts(keyRef.current, accounts, orderedIds)
      setAccounts(updated)
    },
    [accounts],
  )

  const replaceAllAccountsFromBackup = useCallback(
    async (restored: AuthenticatorAccount[]) => {
      if (!keyRef.current) throw new Error('Vault is locked.')
      await replaceAllAccounts(
        keyRef.current,
        restored.map((a) => ({ ...a })),
      )
      await refreshAccounts()
    },
    [refreshAccounts],
  )

  const mergeAccountsFromBackup = useCallback(
    async (restored: AuthenticatorAccount[]) => {
      if (!keyRef.current) throw new Error('Vault is locked.')
      // Dedupe on (issuer, accountName, secret) — a backup restored onto a
      // vault that already has some of the same accounts shouldn't create
      // visible duplicates.
      const existingKeys = new Set(accounts.map((a) => `${a.issuer}\u0000${a.accountName}\u0000${a.secret}`))
      for (const account of restored) {
        const dedupeKey = `${account.issuer}\u0000${account.accountName}\u0000${account.secret}`
        if (existingKeys.has(dedupeKey)) continue
        await repoCreateAccount(keyRef.current, account)
        existingKeys.add(dedupeKey)
      }
      await refreshAccounts()
    },
    [accounts, refreshAccounts],
  )

  const getVaultKeyForExport = useCallback(() => keyRef.current, [])

  const webAuthnEnrolled = Boolean(meta?.webAuthn)

  const value: VaultContextValue = {
    status,
    meta,
    accounts,
    webAuthnSupported,
    webAuthnEnrolled,
    createVault,
    unlock,
    unlockViaWebAuthn,
    lock,
    changePassphrase,
    setAutoLockMinutes: setAutoLockMinutesCb,
    disableWebAuthn,
    applyMetaUpdate,
    addAccount,
    editAccount,
    removeAccount,
    toggleFavorite,
    reorder,
    replaceAllAccountsFromBackup,
    mergeAccountsFromBackup,
    getVaultKeyForExport,
  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}
