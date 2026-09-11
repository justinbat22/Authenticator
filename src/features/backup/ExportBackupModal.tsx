import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { PasswordField } from '../../components/PasswordField'
import { useVault } from '../../app/vaultHooks'
import { createBackup, MIN_BACKUP_PASSWORD_LENGTH } from './backupService'

export function ExportBackupModal({ onClose }: { onClose: () => void }) {
  const { accounts } = useVault()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setError(`Backup password must be at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const backup = await createBackup(accounts, password)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const timestamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `authenticator-backup-${timestamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the backup.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Modal title="Backup created" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Your backup file has been downloaded. Store it somewhere safe — anyone with the file
            <em> and</em> the backup password could restore these accounts, so treat it like the
            accounts themselves.
          </p>
          <button type="button" className="btn btn-primary btn-full" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Export encrypted backup" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          This creates a file with all {accounts.length} account{accounts.length === 1 ? '' : 's'},
          encrypted with a password you choose now (it can be different from your vault
          passphrase).
        </p>
        <PasswordField
          label="Backup password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          autoFocus
        />
        <PasswordField
          label="Confirm backup password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-full" disabled={busy || accounts.length === 0}>
          {busy ? 'Creating…' : 'Create and download backup'}
        </button>
        {accounts.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Add an account first — there's nothing to back up yet.
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
