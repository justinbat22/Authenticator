import { useState, type FormEvent } from 'react'
import { PasswordField } from '../../components/PasswordField'
import { MIN_PASSPHRASE_LENGTH } from '../../services/vaultService'
import { useVault } from '../../app/vaultHooks'
import { GateLayout } from '../gate/GateLayout'

interface OnboardingScreenProps {
  onOpenDocs: () => void
}

export function OnboardingScreen({ onOpenDocs }: OnboardingScreenProps) {
  const { createVault } = useVault()
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
      return
    }
    if (passphrase !== confirm) {
      setError('Passphrases do not match.')
      return
    }
    if (!acknowledged) {
      setError('Please confirm you understand the passphrase cannot be recovered.')
      return
    }

    setBusy(true)
    try {
      await createVault(passphrase)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the vault.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GateLayout
      onOpenDocs={onOpenDocs}
      tagline="An offline-first authenticator that keeps every account encrypted on this device — nothing is ever sent anywhere."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 16, textAlign: 'center', color: 'var(--color-text-primary)' }}>
          Create your vault
        </h2>
        <PasswordField
          label="Passphrase"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSPHRASE_LENGTH} characters`}
          autoFocus
        />
        <PasswordField
          label="Confirm passphrase"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />

        <label
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'flex-start',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          I understand that if I forget this passphrase and haven't saved a backup, my
          accounts cannot be recovered.
        </label>

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary btn-full" disabled={busy}>
          {busy ? 'Creating vault…' : 'Create vault'}
        </button>
      </form>
    </GateLayout>
  )
}
