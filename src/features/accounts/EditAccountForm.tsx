import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { useVault } from '../../app/vaultHooks'
import { isValidBase32, normalizeBase32 } from '../../otp/base32'
import { generateTotp } from '../../otp/totp'
import type { AuthenticatorAccount, OtpAlgorithm, OtpDigits } from '../../types/account'

interface EditAccountFormProps {
  account: AuthenticatorAccount
  onClose: () => void
}

export function EditAccountForm({ account, onClose }: EditAccountFormProps) {
  const { editAccount } = useVault()
  const [issuer, setIssuer] = useState(account.issuer)
  const [accountName, setAccountName] = useState(account.accountName)
  const [secret, setSecret] = useState(account.secret)
  const [algorithm, setAlgorithm] = useState<OtpAlgorithm>(account.algorithm)
  const [digits, setDigits] = useState<OtpDigits>(account.digits)
  const [period, setPeriod] = useState(account.period)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const normalizedSecret = normalizeBase32(secret)
    if (!isValidBase32(normalizedSecret)) {
      setError('That secret key is not valid Base32.')
      return
    }

    setBusy(true)
    try {
      await generateTotp({ secret: normalizedSecret, algorithm, digits, period })
      await editAccount({
        ...account,
        issuer: issuer.trim() || 'Unknown issuer',
        accountName: accountName.trim(),
        secret: normalizedSecret,
        algorithm,
        digits,
        period,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Edit account" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <label className="field-label" htmlFor="edit-issuer">
            Issuer
          </label>
          <input
            id="edit-issuer"
            className="text-field"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-name">
            Account name
          </label>
          <input
            id="edit-name"
            className="text-field"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-secret">
            Secret key
          </label>
          <input
            id="edit-secret"
            className="text-field"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="edit-algo">
              Algorithm
            </label>
            <select
              id="edit-algo"
              className="text-field"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as OtpAlgorithm)}
            >
              <option value="SHA-1">SHA-1</option>
              <option value="SHA-256">SHA-256</option>
              <option value="SHA-512">SHA-512</option>
            </select>
          </div>
          <div style={{ width: 90 }}>
            <label className="field-label" htmlFor="edit-digits">
              Digits
            </label>
            <select
              id="edit-digits"
              className="text-field"
              value={digits}
              onChange={(e) => setDigits(Number(e.target.value) as OtpDigits)}
            >
              <option value={6}>6</option>
              <option value={8}>8</option>
            </select>
          </div>
          <div style={{ width: 90 }}>
            <label className="field-label" htmlFor="edit-period">
              Period
            </label>
            <input
              id="edit-period"
              className="text-field"
              type="number"
              min={5}
              max={300}
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            />
          </div>
        </div>

        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
