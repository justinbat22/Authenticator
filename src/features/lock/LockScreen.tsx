import { Fingerprint, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PasswordField } from '../../components/PasswordField'
import { useVault } from '../../app/vaultHooks'

export function LockScreen() {
  const { unlock, unlockViaWebAuthn, webAuthnEnrolled } = useVault()
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await unlock(passphrase)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock.')
    } finally {
      setBusy(false)
    }
  }

  async function handleWebAuthn() {
    setError(null)
    setBusy(true)
    try {
      await unlockViaWebAuthn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WebAuthn unlock failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'var(--space-6) var(--space-5)',
        gap: 'var(--space-6)',
      }}
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-panel)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <Lock size={24} color="var(--color-text-secondary)" />
        </div>
        <h1 style={{ fontSize: 22 }}>Vault locked</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <PasswordField
          label="Passphrase"
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
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>

      {webAuthnEnrolled ? (
        <button
          type="button"
          onClick={handleWebAuthn}
          className="btn btn-secondary btn-full"
          disabled={busy}
        >
          <Fingerprint size={18} />
          Unlock with device
        </button>
      ) : null}
    </div>
  )
}
