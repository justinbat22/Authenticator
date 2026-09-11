# Web Authenticator

An offline-first TOTP (2FA) authenticator you run yourself: a web app that
generates the same six/eight-digit codes as Google Authenticator, Authy, or
1Password's authenticator — with every account secret encrypted at rest,
under a key that never leaves your device.

Read [SECURITY.md](./SECURITY.md) for the full threat model, cryptographic
design, and known limitations before relying on this for anything important.

## Features

- **Standards-compliant TOTP** (RFC 6238) and HOTP (RFC 4226) — SHA-1,
  SHA-256, and SHA-512, 6 or 8 digits, configurable period. Verified against
  the official RFC test vectors (see `src/otp/*.test.ts`).
- **Add accounts** by scanning a QR code (camera), pasting an `otpauth://`
  link, or entering the secret manually.
- **Export a QR code** for any existing account, to move it to another
  authenticator app or a second device.
- **Encrypted at rest**: every account is encrypted with AES-256-GCM before
  it touches IndexedDB. See [SECURITY.md](./SECURITY.md) for the key
  architecture.
- **Optional device unlock** via WebAuthn (fingerprint/face/security key),
  when your browser and authenticator support the PRF extension.
- **Encrypted backups**: export all accounts to a password-protected JSON
  file; import with merge-or-replace.
- **Installable PWA**, fully usable offline once loaded — code generation
  never needs a network request.
- **Auto-lock** after configurable inactivity, dark/light/system theme.

## Getting started

```bash
npm install
npm run dev       # local dev server
npm test          # run the test suite
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build locally
```

Requires a browser with the Web Crypto API, IndexedDB, and (for QR scanning)
camera access. WebAuthn unlock additionally requires an authenticator that
supports the PRF extension — most 2023+ platform authenticators do; many
older ones and most USB security keys as of this writing do not. The app
still works fully with just a passphrase if PRF isn't available.

## Project structure

```
src/
  otp/          Base32 codec, HOTP, TOTP, otpauth:// URI parsing — the
                 standards-compliant core, independently unit-tested.
  crypto/        PBKDF2 key derivation, AES-256-GCM encrypt/decrypt.
  storage/       IndexedDB persistence (accounts + vault metadata).
  services/      Vault lifecycle: create, unlock, change passphrase.
  webauthn/      WebAuthn PRF-based unlock.
  qr/            Camera-based QR scanning (getUserMedia + jsQR).
  app/           React context wiring the above into UI state.
  features/      Screens: onboarding, lock, accounts, settings, backup.
  components/    Small shared UI primitives.
```

The `otp/`, `crypto/`, `storage/`, and `services/` layers have no
dependency on React and are fully unit/integration tested independent of
the UI (68 tests as of this writing, run with `npm test`).

## Data & portability

Everything lives in this browser's IndexedDB for this origin. Clearing site
data, using a different browser, or using private/incognito mode all mean a
separate, empty vault. There is no cloud sync — **use the export/backup
feature regularly**, and store the resulting file somewhere durable (a
password manager attachment, an encrypted drive, etc.).

## Known limitations

- No cloud sync or multi-device sync — each browser profile is its own
  vault. Use export/import to move between devices.
- WebAuthn unlock requires PRF support; the app does not offer a
  weaker "unlock gate" fallback, because that would not actually add
  encryption and would be misleading to advertise as a security feature.
- Camera-based QR scanning requires a real browser context and camera
  permission; it was implemented and code-reviewed but, in the environment
  this project was built in, could not be exercised end-to-end against a
  live camera. Test it in your target browser before relying on it, and
  use "paste a link" or "enter manually" as fallbacks.
- No automated end-to-end UI tests (e.g. Playwright) are included — testing
  focused on the security-critical core (crypto, OTP math, vault lifecycle,
  backup parsing). See [SECURITY.md](./SECURITY.md) for what was and wasn't
  verified.

## License

No license file is included; add one appropriate to your use before
distributing this.
