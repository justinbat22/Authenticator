import { ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PasswordField } from '../../components/PasswordField'
import { MIN_PASSPHRASE_LENGTH } from '../../services/vaultService'
import { useVault } from '../../app/vaultHooks'

export function OnboardingScreen() {
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
            background: 'var(--color-accent-wash)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}
        >
          <ShieldCheck size={28} color="var(--color-accent)" />
        </div>
        <h1 style={{ fontSize: 24 }}>Set up your vault</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, lineHeight: 1.5 }}>
          Choose a passphrase to encrypt your accounts on this device. It never leaves your
          device and we can't reset it for you — write it down somewhere safe.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
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
    </div>
  )
}
