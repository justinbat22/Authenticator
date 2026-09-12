import { ChevronLeft, ExternalLink, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'
import { GITHUB_REPO_URL } from '../../app/links'

interface DocumentationScreenProps {
  onBack: () => void
}

export function DocumentationScreen({ onBack }: DocumentationScreenProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky',
          top: 0,
          background: 'var(--color-bg)',
          zIndex: 1,
        }}
      >
        <button type="button" onClick={onBack} aria-label="Back" className="btn-ghost" style={iconBtn}>
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ fontSize: 19 }}>Documentation</h1>
      </header>

      <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <Logo size={48} />
          <div>
            <h2 style={{ fontSize: 17, fontFamily: 'var(--font-wordmark)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Authenticator
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              An offline-first, self-hosted TOTP authenticator.
            </p>
          </div>
        </div>

        <Section title="What this is">
          <Text>
            This app generates the same time-based one-time codes (TOTP) as Google Authenticator,
            Authy, or 1Password — the six or eight digit codes used for two-factor login. Every
            account is encrypted with AES-256-GCM before it's saved to this browser's IndexedDB,
            under a key derived from a passphrase only you know. Nothing is ever sent to a server;
            the app works fully offline once loaded, and can be installed as an app on your phone
            or desktop.
          </Text>
        </Section>

        <Section title="Getting started">
          <Ol
            items={[
              <>
                <strong>First time:</strong> choose a passphrase on the welcome screen and select
                "Create vault." This passphrase encrypts everything — write it down somewhere
                safe, since there's no "forgot passphrase" recovery (see Security below for why).
              </>,
              <>
                <strong>Returning:</strong> enter your passphrase on the "Open your vault" screen,
                or use "Unlock with device" if you've set up fingerprint/face/security-key unlock.
              </>,
              <>
                <strong>Add an account:</strong> tap the + button, then scan a QR code, upload a
                screenshot of one, paste a setup link, or type the secret key in by hand.
              </>,
            ]}
          />
        </Section>

        <Section title="Adding accounts">
          <Text>There are four ways to add an account, all reachable from the + button:</Text>
          <Ul
            items={[
              <>
                <strong>Scan QR (camera):</strong> point your device's camera at the QR code shown
                by the service you're setting up 2FA for.
              </>,
              <>
                <strong>Upload a QR image:</strong> if you only have one device — for example the
                QR code is on the same screen you're using — take a screenshot or save the QR
                code image, then choose "Upload an image" instead of using the live camera.
              </>,
              <>
                <strong>Paste a link:</strong> some services give you an <code>otpauth://</code>{' '}
                setup link instead of a QR code — paste it directly.
              </>,
              <>
                <strong>Manual entry:</strong> type in the secret key yourself (and algorithm/digits/
                period, if the service specifies non-default values).
              </>,
            ]}
          />
        </Section>

        <Section title="Security & encryption">
          <Text>
            Accounts are encrypted with AES-256-GCM under a random 256-bit key (the "Vault Master
            Key"), which is itself encrypted under a key derived from your passphrase via
            PBKDF2-HMAC-SHA256 at 600,000 iterations. That key is marked non-extractable in the
            browser's Web Crypto API — it cannot be read back out in raw form, even by this app's
            own code.
          </Text>
          <Text>
            Optional device unlock uses WebAuthn's <strong>PRF extension</strong> specifically —
            not just a basic fingerprint prompt — because only PRF actually returns key material
            your browser can encrypt with. If your device doesn't support PRF, the option simply
            won't appear, rather than offering a weaker unlock that only pretends to add
            encryption.
          </Text>
          <Text>
            This protects your accounts if your device storage is accessed directly without your
            passphrase (e.g. a stolen laptop, or another OS user account reading browser files).
            It does <strong>not</strong> protect against malware running on your device while the
            vault is unlocked, a weak/reused passphrase, or phishing — see the full write-up in{' '}
            <code>SECURITY.md</code> in the repository for the complete threat model.
          </Text>
        </Section>

        <Section title="Backup & restore">
          <Text>
            There is no cloud sync — everything lives only in this browser's storage for this
            site. <strong>Export a backup regularly</strong> from Settings → Export encrypted
            backup. You'll set a backup password (which can be different from your vault
            passphrase) and a JSON file will download. Store that file somewhere durable.
          </Text>
          <Text>
            To restore, go to Settings → Import backup, choose the file and enter its password,
            then choose to merge with your current accounts or replace them entirely.
          </Text>
        </Section>

        <Section title="Settings">
          <Ul
            items={[
              <>
                <strong>Auto-lock:</strong> how long the app waits without activity before
                re-locking and requiring your passphrase again.
              </>,
              <>
                <strong>Change passphrase:</strong> re-encrypts access to your vault under a new
                passphrase — instant, since your accounts themselves don't need to be re-encrypted
                (only the key wrapping does).
              </>,
              <>
                <strong>Device unlock:</strong> enroll or remove WebAuthn (fingerprint/face/
                security key) unlock.
              </>,
              <>
                <strong>Erase all data:</strong> permanently deletes the vault and every account
                from this device. Cannot be undone without a backup.
              </>,
            ]}
          />
        </Section>

        <Section title="Data & portability">
          <Text>
            Your accounts live in this specific browser profile, on this device, for this site's
            origin. A different browser, a different device, clearing site data, or private/
            incognito mode all mean a separate, empty vault. Moving to a new device means either
            restoring a backup, or re-scanning each account's QR code from its issuing service
            (most services can show it again from their own security settings).
          </Text>
        </Section>

        <Section title="FAQ">
          <FaqItem q="I forgot my passphrase — can it be recovered?">
            No. There's no server-side recovery mechanism, by design — anyone who could reset it
            for you would also be someone who could decrypt your accounts. If you have an
            exported backup, restore from that; otherwise you'll need to re-enroll 2FA with each
            service individually.
          </FaqItem>
          <FaqItem q="Does this work without internet?">
            Yes — once loaded (or installed as an app), code generation, adding accounts, and
            backups all work fully offline. It's a PWA specifically designed for this.
          </FaqItem>
          <FaqItem q="Has this been security-audited?">
            No formal third-party audit has been performed. The cryptographic core (TOTP/HOTP math
            and the encryption layer) is unit-tested against official RFC test vectors. See{' '}
            <code>SECURITY.md</code> for exactly what has and hasn't been verified.
          </FaqItem>
          <FaqItem q="Can I use this on two devices?">
            Not with live sync — export a backup from one device and import it on the other. Each
            device keeps its own independent copy after that.
          </FaqItem>
        </Section>

        <Section title="Open source">
          <Text>
            This project is open source. If it's useful to you, a star on GitHub helps others find
            it — and issues/pull requests are welcome.
          </Text>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-full"
            style={{ textDecoration: 'none' }}
          >
            <Star size={16} />
            View on GitHub
            <ExternalLink size={14} style={{ marginLeft: 4, opacity: 0.6 }} />
          </a>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <h2
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Text({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{children}</p>
}

function Ul({ items }: { items: ReactNode[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function Ol({ items }: { items: ReactNode[] }) {
  return (
    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          {item}
        </li>
      ))}
    </ol>
  )
}

function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{q}</p>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{children}</p>
    </div>
  )
}

const iconBtn = { padding: 8, borderRadius: 'var(--radius-md)', border: 'none' } as const
