import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Modal } from '../../components/Modal'
import { buildOtpAuthUri } from '../../otp/otpauth'
import type { AuthenticatorAccount } from '../../types/account'

interface ShowQrModalProps {
  account: AuthenticatorAccount
  onClose: () => void
}

export function ShowQrModal({ account, onClose }: ShowQrModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const uri = buildOtpAuthUri(account)
    QRCode.toDataURL(uri, { width: 280, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setError('Could not generate a QR code for this account.')
      })
    return () => {
      cancelled = true
    }
  }, [account])

  return (
    <Modal title={`${account.issuer} QR code`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          Scan this with another authenticator app to add the same account there. Anyone who sees
          this code can generate your codes too — treat it like the secret itself.
        </p>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code to add ${account.issuer} (${account.accountName})`}
            width={280}
            height={280}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        ) : (
          <div style={{ width: 280, height: 280 }} aria-hidden />
        )}
        <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
