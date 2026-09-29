import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { PasswordField } from '../../components/PasswordField'
import { useVault, enrollWebAuthnWithPassphrase } from '../../app/vaultHooks'
import { isPrfSupported } from '../../webauthn/webauthn'

export function EnrollWebAuthnModal({ onClose }: { onClose: () => void }) {
  const { meta, applyMetaUpdate } = useVault()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [prfSupported, setPrfSupported] = useState<boolean | null>(null)

  // Concrete next steps, shown whenever device unlock can't be completed, so
  // the user gets something to act on rather than a dead end.
  const prfHelp = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        lineHeight: 1.5,
      }}
    >
      <p style={{ fontWeight: 600 }}>Things worth trying:</p>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li>Make sure you have a screen lock set (PIN, pattern, password, fingerprint or face).</li>
        <li>
          On Android, save your passkeys to your <strong>Google account</strong> via Google
          Password Manager, then try again.
        </li>
        <li>Update your browser to the latest version and close other apps that may hold a passkey prompt.</li>
        <li>Try a different passkey provider, such as a USB security key.</li>
      </ul>
      <p>Your passphrase still unlocks your vault exactly as before — nothing was changed.</p>
    </div>
  )

  // Check up front so we never ask for a passphrase and then run a ceremony
  // that is going to fail. `null` means "still checking / browser can't tell
  // us", in which case we optimistically show the form and let the real
  // enrollment attempt be the source of truth.
  useEffect(() => {
    let cancelled = false
    void isPrfSupported().then((supported) => {
      if (!cancelled) setPrfSupported(supported)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  if (prfSupported === false) {
    return (
      <Modal title="Set up device unlock" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            This browser reports that it does not support the WebAuthn PRF extension, which device
            unlock needs in order to produce real key material. Nothing has been changed, and your
            passphrase continues to work as normal.
          </p>
          {prfHelp}
          <button type="button" className="btn btn-primary btn-full" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>
    )
  }

  if (error) {
    return (
      <Modal title="Set up device unlock" onClose={onClose}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <p className="field-error" role="alert">
            {error}
          </p>
          {prfHelp}
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => {
                setError(null)
                setPassphrase('')
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Set up device unlock" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          This lets you unlock with your device's fingerprint, face, or security key instead of
          typing your passphrase. Your passphrase still works as a backup. You'll be asked to
          confirm your passphrase, then to verify with your device.
        </p>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          On Android, make sure your passkeys are saved to your Google account (Google Password
          Manager) — passkeys stored only on the device or in a third‑party manager often can't
          supply the key material this needs.
        </p>
        <PasswordField
          label="Confirm your passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoFocus
        />
        {busy ? (
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Confirm with your device — this may ask for your fingerprint twice.
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-full" disabled={busy || !passphrase}>
          {busy ? 'Setting up…' : 'Continue'}
        </button>
      </form>
    </Modal>
  )
}
