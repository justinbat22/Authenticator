import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Upload } from 'lucide-react'
import { Modal } from '../../components/Modal'
import { QrScannerView } from '../../qr/QrScannerView'
import { decodeQrFromFile } from '../../qr/decodeFromImage'
import { parseOtpAuthUri, type ParsedOtpAuth } from '../../otp/otpauth'
import { isValidBase32, normalizeBase32 } from '../../otp/base32'
import { generateTotp } from '../../otp/totp'
import { useVault } from '../../app/vaultHooks'
import type { OtpAlgorithm, OtpDigits } from '../../types/account'
import { DEFAULT_ALGORITHM, DEFAULT_DIGITS, DEFAULT_PERIOD } from '../../types/account'

type Tab = 'scan' | 'upload' | 'paste' | 'manual'

interface AddAccountFlowProps {
  onClose: () => void
}

export function AddAccountFlow({ onClose }: AddAccountFlowProps) {
  const [tab, setTab] = useState<Tab>('scan')
  const [parsed, setParsed] = useState<ParsedOtpAuth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { addAccount } = useVault()

  async function handleParsedResult(uri: string) {
    try {
      const result = parseOtpAuthUri(uri)
      // Confirm the secret actually produces a code before we save it —
      // catches encoding edge cases the parser's validation might miss.
      await generateTotp(result)
      setParsed(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this code.')
    }
  }

  async function handleConfirmSave(edited: ParsedOtpAuth) {
    await addAccount({ ...edited, type: 'totp' })
    onClose()
  }

  if (parsed) {
    return (
      <Modal title="Confirm account" onClose={onClose}>
        <ConfirmAccountForm initial={parsed} onCancel={() => setParsed(null)} onSave={handleConfirmSave} />
      </Modal>
    )
  }

  return (
    <Modal title="Add account" onClose={onClose}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-4)' }}>
        <TabButton label="Scan" active={tab === 'scan'} onClick={() => setTab('scan')} />
        <TabButton label="Upload" active={tab === 'upload'} onClick={() => setTab('upload')} />
        <TabButton label="Paste" active={tab === 'paste'} onClick={() => setTab('paste')} />
        <TabButton label="Manual" active={tab === 'manual'} onClick={() => setTab('manual')} />
      </div>

      {error ? (
        <p className="field-error" role="alert" style={{ marginBottom: 'var(--space-3)' }}>
          {error}
        </p>
      ) : null}

      {tab === 'scan' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <QrScannerView active={tab === 'scan'} onDetected={handleParsedResult} />
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            Point your camera at the account's setup QR code.
          </p>
        </div>
      ) : null}

      {tab === 'upload' ? <UploadQrImageForm onDetected={handleParsedResult} onError={setError} /> : null}

      {tab === 'paste' ? <PasteLinkForm onSubmit={handleParsedResult} /> : null}

      {tab === 'manual' ? (
        <ConfirmAccountForm
          initial={{
            issuer: '',
            accountName: '',
            secret: '',
            algorithm: DEFAULT_ALGORITHM,
            digits: DEFAULT_DIGITS,
            period: DEFAULT_PERIOD,
          }}
          onCancel={onClose}
          onSave={handleConfirmSave}
          isManualEntry
        />
      ) : null}
    </Modal>
  )
}

function UploadQrImageForm({
  onDetected,
  onError,
}: {
  onDetected: (uri: string) => void
  onError: (message: string | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    onError(null)
    setBusy(true)
    try {
      const uri = await decodeQrFromFile(file)
      onDetected(uri)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read a QR code from that image.')
    } finally {
      setBusy(false)
      // Allow re-selecting the same file if the user wants to retry.
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="btn btn-secondary btn-full"
        disabled={busy}
      >
        <Upload size={16} />
        {busy ? 'Reading…' : (fileName ?? 'Choose an image')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Good for when scanning with a second device's camera isn't an option — save or
        screenshot the QR code image, then upload it here.
      </p>
    </div>
  )
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 4px',
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--color-accent-wash)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
      }}
    >
      {label}
    </button>
  )
}

function PasteLinkForm({ onSubmit }: { onSubmit: (uri: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value.trim())
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      <div>
        <label className="field-label" htmlFor="otpauth-uri">
          otpauth:// link
        </label>
        <textarea
          id="otpauth-uri"
          className="text-field"
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="otpauth://totp/Example:alice@example.com?secret=..."
        />
      </div>
      <button type="submit" className="btn btn-primary btn-full" disabled={!value.trim()}>
        Continue
      </button>
    </form>
  )
}

interface ConfirmAccountFormProps {
  initial: Omit<ParsedOtpAuth, 'issuer' | 'accountName'> & { issuer: string; accountName: string }
  onCancel: () => void
  onSave: (account: ParsedOtpAuth) => Promise<void>
  isManualEntry?: boolean
}

function ConfirmAccountForm({ initial, onCancel, onSave, isManualEntry }: ConfirmAccountFormProps) {
  const [issuer, setIssuer] = useState(initial.issuer)
  const [accountName, setAccountName] = useState(initial.accountName)
  const [secret, setSecret] = useState(initial.secret)
  const [algorithm, setAlgorithm] = useState<OtpAlgorithm>(initial.algorithm)
  const [digits, setDigits] = useState<OtpDigits>(initial.digits)
  const [period, setPeriod] = useState(initial.period)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!issuer.trim() && !accountName.trim()) {
      setError('Enter at least an issuer or account name.')
      return
    }
    const normalizedSecret = normalizeBase32(secret)
    if (!isValidBase32(normalizedSecret)) {
      setError('That secret key is not valid Base32.')
      return
    }

    setBusy(true)
    try {
      // Verify it actually produces a code before saving.
      await generateTotp({ secret: normalizedSecret, algorithm, digits, period })
      await onSave({
        issuer: issuer.trim() || 'Unknown issuer',
        accountName: accountName.trim(),
        secret: normalizedSecret,
        algorithm,
        digits,
        period,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <label className="field-label" htmlFor="acc-issuer">
          Issuer
        </label>
        <input
          id="acc-issuer"
          className="text-field"
          value={issuer}
          onChange={(e) => setIssuer(e.target.value)}
          placeholder="e.g. GitHub"
          autoFocus={isManualEntry}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="acc-name">
          Account name
        </label>
        <input
          id="acc-name"
          className="text-field"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="e.g. alice@example.com"
        />
      </div>
      {isManualEntry ? (
        <>
          <div>
            <label className="field-label" htmlFor="acc-secret">
              Secret key
            </label>
            <input
              id="acc-secret"
              className="text-field"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Base32 secret, e.g. JBSW Y3DP EHPK 3PXP"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flex: 1 }}>
              <label className="field-label" htmlFor="acc-algo">
                Algorithm
              </label>
              <select
                id="acc-algo"
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
              <label className="field-label" htmlFor="acc-digits">
                Digits
              </label>
              <select
                id="acc-digits"
                className="text-field"
                value={digits}
                onChange={(e) => setDigits(Number(e.target.value) as OtpDigits)}
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
              </select>
            </div>
            <div style={{ width: 90 }}>
              <label className="field-label" htmlFor="acc-period">
                Period
              </label>
              <input
                id="acc-period"
                className="text-field"
                type="number"
                min={5}
                max={300}
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
              />
            </div>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {algorithm} · {digits} digits · every {period}s
        </p>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
          {busy ? 'Saving…' : 'Save account'}
        </button>
      </div>
    </form>
  )
}
