import { Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { PasswordField } from '../../components/PasswordField'
import { useVault } from '../../app/vaultHooks'
import { readBackup } from './backupService'
import type { AuthenticatorAccount } from '../../types/account'

export function ImportBackupModal({ onClose }: { onClose: () => void }) {
  const { mergeAccountsFromBackup, replaceAllAccountsFromBackup, accounts } = useVault()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileContents, setFileContents] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<AuthenticatorAccount[] | null>(null)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setFileContents(await file.text())
    setError(null)
  }

  async function handleDecrypt(e: FormEvent) {
    e.preventDefault()
    if (!fileContents) {
      setError('Choose a backup file first.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const restored = await readBackup(fileContents, password)
      setPendingRestore(restored)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this backup.')
    } finally {
      setBusy(false)
    }
  }

  async function handleChoice(mode: 'merge' | 'replace') {
    if (!pendingRestore) return
    setBusy(true)
    try {
      if (mode === 'merge') {
        await mergeAccountsFromBackup(pendingRestore)
      } else {
        await replaceAllAccountsFromBackup(pendingRestore)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore this backup.')
    } finally {
      setBusy(false)
    }
  }

  if (pendingRestore) {
    return (
      <Modal title="Restore backup" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            This backup contains {pendingRestore.length} account{pendingRestore.length === 1 ? '' : 's'}.
            You currently have {accounts.length}. How should these be combined?
          </p>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary btn-full"
            disabled={busy}
            onClick={() => handleChoice('merge')}
          >
            Merge — add new accounts, keep existing ones
          </button>
          <button
            type="button"
            className="btn btn-danger btn-full"
            disabled={busy}
            onClick={() => handleChoice('replace')}
          >
            Replace — delete existing accounts first
          </button>
          <button type="button" className="btn btn-ghost btn-full" onClick={() => setPendingRestore(null)}>
            Back
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Import backup" onClose={onClose}>
      <form onSubmit={handleDecrypt} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-secondary btn-full"
        >
          <Upload size={16} />
          {fileName ?? 'Choose backup file'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <PasswordField
          label="Backup password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-full" disabled={busy || !fileContents}>
          {busy ? 'Reading…' : 'Continue'}
        </button>
      </form>
    </Modal>
  )
}
