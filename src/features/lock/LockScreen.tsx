import { Fingerprint } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PasswordField } from '../../components/PasswordField'
import { useVault } from '../../app/vaultHooks'
import { GateLayout } from '../gate/GateLayout'

interface LockScreenProps {
  onOpenDocs: () => void
}

export function LockScreen({ onOpenDocs }: LockScreenProps) {
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
    <GateLayout onOpenDocs={onOpenDocs} tagline="Welcome back. Enter your passphrase to open your vault.">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 16, textAlign: 'center', color: 'var(--color-text-primary)' }}>
          Open your vault
        </h2>
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
    </GateLayout>
  )
}
