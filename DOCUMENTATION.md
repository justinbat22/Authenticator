# Documentation

This is the complete guide to the Authenticator app — what it is, how to use every feature, and
exactly what its security model does and doesn't cover. The same content (minus this table of
contents) is available inside the app itself: tap **Documentation** on the welcome screen or in
Settings.

## Table of contents

- [What this is](#what-this-is)
- [Getting started](#getting-started)
- [Adding accounts](#adding-accounts)
- [Using the app day to day](#using-the-app-day-to-day)
- [Security & encryption](#security--encryption)
- [Backup & restore](#backup--restore)
- [Settings reference](#settings-reference)
- [Data & portability](#data--portability)
- [FAQ](#faq)
- [Tech stack](#tech-stack)

## What this is

This app generates time-based one-time codes (TOTP) — the same six- or eight-digit codes used
for two-factor login, compatible with any service that supports Google Authenticator, Authy, or
similar apps. Every account is encrypted with AES-256-GCM before it's saved to this browser's
IndexedDB, under a key derived from a passphrase only you know. Nothing is ever sent to a
server — the app works fully offline once loaded and can be installed like a native app (it's a
PWA).

## Getting started

**First time using the app:**
1. On the welcome screen, choose a passphrase (at least 8 characters — longer and more random is
   better than adding symbols to a short one).
2. Confirm it, tick the acknowledgment checkbox, and tap **Create vault**.
3. Your passphrase encrypts everything from this point on. There is intentionally no "forgot
   passphrase" recovery — see [Security](#security--encryption) for why — so write it down
   somewhere durable.

**Returning to the app:**
1. Enter your passphrase on the "Open your vault" screen, or tap **Unlock with device** if
   you've enrolled WebAuthn (fingerprint/face/security key) unlock in Settings.

## Adding accounts

Tap the **+** button on the account list. There are four ways to add an account:

| Method | When to use it |
|---|---|
| **Scan** (camera) | You have a second device to point the camera at the QR code. |
| **Upload** (image) | You only have one device — save or screenshot the QR code image, then upload the image file directly. This is the recommended path if the QR code is displayed on the same screen you're using. |
| **Paste** (link) | The service gives you an `otpauth://` setup link instead of, or in addition to, a QR code. |
| **Manual** | You have the raw secret key and want to type it in directly, optionally specifying a non-default algorithm, digit count, or time period. |

Every method ends on a confirmation step showing the issuer, account name, and technical
parameters before saving — nothing is added silently.

You can also **export any existing account back to a QR code** (via its "⋮" menu → "Show QR
code") to move it to another authenticator app or device.

## Using the app day to day

The account list shows a live 6- or 8-digit code for each account with a countdown ring next to
it — the ring fills in as the code approaches expiry and turns amber in the last few seconds.
Tap a code to copy it. Accounts can be marked as favorites (they sort to the top), searched by
issuer or account name, edited, or deleted from the "⋮" menu.

## Security & encryption

**Summary:** accounts are encrypted with AES-256-GCM under a random 256-bit key (the "Vault
Master Key," VMK), generated once and never stored unencrypted. That key is itself encrypted
("wrapped") under a key derived from your passphrase via PBKDF2-HMAC-SHA256 at 600,000
iterations — and optionally wrapped again under a key derived from a WebAuthn PRF assertion, if
you opt in. Every key that touches account data or wraps the VMK is marked **non-extractable**
in the browser's Web Crypto API, meaning it cannot be read back out in raw form even by this
app's own code.

### WebAuthn unlock: PRF-only, by design

WebAuthn's basic assertion flow proves "the user passed device verification" — it doesn't hand
your code any secret key material on its own. Some apps use that as a weak "unlock gate":
require an assertion, then just let you in, without anything actually being re-encrypted. This
app only enables WebAuthn unlock when the authenticator supports the **PRF extension**, which
returns a deterministic, secret-derived byte string during an assertion — that output is fed
through HKDF to derive a real AES-GCM key that wraps the same VMK your passphrase wraps. If your
browser/authenticator doesn't support PRF, the option is simply unavailable, rather than
offering a fallback that would only pretend to add security.

### What this protects against

- Someone with access to your device's storage but not your passphrase (a stolen laptop, another
  OS user account reading browser files directly) gets ciphertext they cannot decrypt.
- A backup file falling into the wrong hands without its separate backup password.
- Passive network observation — nothing is transmitted, ever.

### What this does NOT protect against

- **A weak or reused passphrase.** PBKDF2 slows brute-force attempts but can't make a short or
  common passphrase safe.
- **Malware or a compromised browser while the vault is unlocked.** Non-extractable keys don't
  help if something can already ask your unlocked session to decrypt on its behalf.
- **Malicious browser extensions** with broad page access, while unlocked.
- **Forgetting your passphrase with no backup exported.** There is deliberately no server-side
  recovery.
- **Phishing** (real-time relay attacks) — a limitation of TOTP as a protocol, not of this app.

The full write-up, including the exact key-wrapping diagram and what testing has and hasn't been
performed, is in [SECURITY.md](./SECURITY.md).

## Backup & restore

There is no cloud sync. From **Settings → Export encrypted backup**, choose a backup password
(independent of your vault passphrase) and a JSON file downloads. Store it somewhere durable — a
password manager attachment, an encrypted drive, etc.

To restore, go to **Settings → Import backup**, select the file, enter its password, then choose:

- **Merge** — add accounts from the backup that you don't already have, keep everything else.
- **Replace** — delete your current accounts first, then restore from the backup.

## Settings reference

| Setting | What it does |
|---|---|
| **Appearance** | Dark, light, or follow system theme. |
| **Change passphrase** | Re-wraps the Vault Master Key under a new passphrase-derived key. Instant — your accounts themselves are never re-encrypted. |
| **Device unlock (WebAuthn)** | Enroll or remove fingerprint/face/security-key unlock. Requires re-entering your passphrase once, to unwrap the VMK for wrapping under the new key. |
| **Auto-lock** | How long the app waits without activity before re-locking. |
| **Export / Import backup** | See [Backup & restore](#backup--restore). |
| **Erase all data** | Permanently deletes the vault and every account from this device. Cannot be undone without a backup. |

## Data & portability

Your accounts live in this specific browser profile, on this device, for this site's origin. A
different browser, a different device, clearing site data, or private/incognito mode all mean a
separate, empty vault. To move to a new device: either restore an exported backup, or re-scan
each account's QR code from its issuing service (most services can show it again from their own
security settings).

## FAQ

**I forgot my passphrase — can it be recovered?**
No. There's no server-side recovery mechanism, by design — anyone who could reset it for you
would also be someone who could decrypt your accounts. Restore from a backup if you have one;
otherwise you'll need to re-enroll 2FA with each service individually.

**Does this work without internet?**
Yes — once loaded (or installed as an app), everything works fully offline.

**Has this been security-audited?**
No formal third-party audit has been performed. The TOTP/HOTP math and encryption layer are
unit-tested against official RFC test vectors; see [SECURITY.md](./SECURITY.md#testing-performed)
for exactly what has and hasn't been verified.

**Can I use this on two devices at once?**
Not with live sync. Export a backup from one device and import it on the other — after that,
each device keeps its own independent copy.

**Why do I need to re-enter my passphrase to set up device unlock?**
The Vault Master Key is non-extractable once derived in a session, by design (see
[Security](#security--encryption)). Re-entering your passphrase re-derives access to the VMK
specifically so it can be wrapped under a new WebAuthn-derived key, without ever loosening the
non-extractable guarantee for normal use.

## Tech stack

React 19 · TypeScript (strict mode) · Vite · Web Crypto API (PBKDF2, AES-GCM, HKDF) · IndexedDB
(via `idb`) · `vite-plugin-pwa` for offline support · `jsqr` for QR decoding (camera and
uploaded images) · Vitest for testing.
