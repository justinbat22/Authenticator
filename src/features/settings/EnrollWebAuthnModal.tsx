import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { PasswordField } from '../../components/PasswordField'
import { useVault, enrollWebAuthnWithPassphrase } from '../../app/vaultHooks'

export function EnrollWebAuthnModal({ onClose }: { onClose: () => void }) {
  const { meta, applyMetaUpdate } = useVault()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!meta) return
    setError(null)
    setBusy(true)
    try {
      const label = 'Web Authenticator vault'
      const updated = await enrollWebAuthnWithPassphrase(meta, passphrase, label)
      applyMetaUpdate(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up WebAuthn unlock.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Set up device unlock" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          This lets you unlock with your device's fingerprint, face, or security key instead of
          typing your passphrase. Your passphrase still works as a backup. Requires a device or
          key that supports the WebAuthn PRF extension — not all do.
        </p>
        <PasswordField
          label="Confirm your passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoFocus
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-full" disabled={busy || !passphrase}>
          {busy ? 'Setting up…' : 'Continue'}
        </button>
      </form>
    </Modal>
  )
}
