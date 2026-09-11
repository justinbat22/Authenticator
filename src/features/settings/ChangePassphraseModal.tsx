import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { PasswordField } from '../../components/PasswordField'
import { useVault } from '../../app/vaultHooks'
import { MIN_PASSPHRASE_LENGTH } from '../../services/vaultService'

export function ChangePassphraseModal({ onClose }: { onClose: () => void }) {
  const { changePassphrase } = useVault()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (next.length < MIN_PASSPHRASE_LENGTH) {
      setError(`New passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
      return
    }
    if (next !== confirm) {
      setError('New passphrases do not match.')
      return
    }

    setBusy(true)
    try {
      await changePassphrase(current, next)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the passphrase.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Modal title="Passphrase changed" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
            Your vault passphrase has been updated.
          </p>
          <button type="button" className="btn btn-primary btn-full" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Change passphrase" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <PasswordField
          label="Current passphrase"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoFocus
        />
        <PasswordField
          label="New passphrase"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new passphrase"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          {busy ? 'Changing…' : 'Change passphrase'}
        </button>
      </form>
    </Modal>
  )
}
