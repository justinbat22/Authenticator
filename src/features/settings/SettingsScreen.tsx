import { ChevronLeft, Download, Fingerprint, KeyRound, Trash2, Upload } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useVault } from '../../app/vaultHooks'
import { applyTheme, getStoredTheme, setStoredTheme, type ThemePreference } from '../../app/theme'
import { ChangePassphraseModal } from './ChangePassphraseModal'
import { EnrollWebAuthnModal } from './EnrollWebAuthnModal'
import { ExportBackupModal } from '../backup/ExportBackupModal'
import { ImportBackupModal } from '../backup/ImportBackupModal'
import { Modal } from '../../components/Modal'
import { wipeDatabase, closeDb } from '../../storage/db'

interface SettingsScreenProps {
  onBack: () => void
}

const AUTO_LOCK_OPTIONS = [
  { label: 'Immediately', minutes: 0.05 },
  { label: '1 minute', minutes: 1 },
  { label: '5 minutes', minutes: 5 },
  { label: '15 minutes', minutes: 15 },
  { label: 'Never', minutes: 0 },
]

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { meta, webAuthnSupported, webAuthnEnrolled, setAutoLockMinutes, disableWebAuthn, accounts } =
    useVault()
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme())
  const [modal, setModal] = useState<
    'changePassphrase' | 'enrollWebAuthn' | 'export' | 'import' | 'eraseConfirm' | null
  >(null)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function handleThemeChange(next: ThemePreference) {
    setTheme(next)
    setStoredTheme(next)
  }

  async function handleEraseAll() {
    await closeDb()
    await wipeDatabase()
    window.location.reload()
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <button type="button" onClick={onBack} aria-label="Back" className="btn-ghost" style={iconBtn}>
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ fontSize: 19 }}>Settings</h1>
      </header>

      <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <Section title="Appearance">
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            {(['system', 'dark', 'light'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleThemeChange(option)}
                className={theme === option ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ flex: 1, textTransform: 'capitalize' }}
              >
                {option}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Security">
          <SettingRow label="Change passphrase" onClick={() => setModal('changePassphrase')} icon={<KeyRound size={17} />} />
          {webAuthnSupported ? (
            webAuthnEnrolled ? (
              <SettingRow
                label="Turn off device unlock"
                onClick={disableWebAuthn}
                icon={<Fingerprint size={17} />}
              />
            ) : (
              <SettingRow
                label="Set up device unlock"
                onClick={() => setModal('enrollWebAuthn')}
                icon={<Fingerprint size={17} />}
              />
            )
          ) : null}

          <div>
            <label className="field-label" htmlFor="auto-lock">
              Auto-lock after inactivity
            </label>
            <select
              id="auto-lock"
              className="text-field"
              value={meta?.autoLockMinutes ?? 5}
              onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
            >
              {AUTO_LOCK_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.minutes}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Backup">
          <SettingRow label="Export encrypted backup" onClick={() => setModal('export')} icon={<Download size={17} />} />
          <SettingRow label="Import backup" onClick={() => setModal('import')} icon={<Upload size={17} />} />
        </Section>

        <Section title="About & security">
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {accounts.length} account{accounts.length === 1 ? '' : 's'} stored, encrypted with
            AES-256-GCM under a key derived from your passphrase via PBKDF2. Nothing leaves this
            device. See SECURITY.md in the project for full details and known limitations.
          </p>
        </Section>

        <Section title="Danger zone">
          <SettingRow
            label="Erase all data on this device"
            onClick={() => setModal('eraseConfirm')}
            icon={<Trash2 size={17} />}
            danger
          />
        </Section>
      </div>

      {modal === 'changePassphrase' ? <ChangePassphraseModal onClose={() => setModal(null)} /> : null}
      {modal === 'enrollWebAuthn' ? <EnrollWebAuthnModal onClose={() => setModal(null)} /> : null}
      {modal === 'export' ? <ExportBackupModal onClose={() => setModal(null)} /> : null}
      {modal === 'import' ? <ImportBackupModal onClose={() => setModal(null)} /> : null}
      {modal === 'eraseConfirm' ? (
        <Modal title="Erase all data?" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              This permanently deletes your vault and all {accounts.length} account
              {accounts.length === 1 ? '' : 's'} from this device. This cannot be undone unless
              you have an exported backup.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" style={{ flex: 1 }} onClick={handleEraseAll}>
                Erase everything
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h2 style={{ fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function SettingRow({
  label,
  onClick,
  icon,
  danger,
}: {
  label: string
  onClick: () => void
  icon: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        cursor: 'pointer',
        color: danger ? 'var(--color-danger)' : 'var(--color-text-primary)',
        textAlign: 'left',
      }}
    >
      {icon}
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
    </button>
  )
}

const iconBtn = { padding: 8, borderRadius: 'var(--radius-md)', border: 'none' } as const
