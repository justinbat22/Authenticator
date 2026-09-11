# Security

This document describes the cryptographic design, what it protects against,
and — just as importantly — what it doesn't. Read this before trusting it
with real accounts.

## Summary

- Account secrets are encrypted with **AES-256-GCM**.
- The encryption key (the "Vault Master Key", VMK) is a random 256-bit key,
  generated once and never stored unencrypted.
- The VMK is itself encrypted ("wrapped") under a key derived from your
  passphrase via **PBKDF2-HMAC-SHA256, 600,000 iterations** (OWASP's 2023
  recommendation), and optionally also wrapped under a key derived from a
  **WebAuthn PRF extension** output, if you opt in.
- All of this runs client-side, in the browser's Web Crypto API. No account
  data, passphrase, or key material is ever sent over the network.

## Key architecture (why two keys?)

```
passphrase ──PBKDF2──▶ KEK_passphrase ──wraps──▶ VMK ──encrypts──▶ account data
                                                   ▲
WebAuthn PRF output ──HKDF──▶ KEK_webauthn ──wraps─┘
```

Accounts are encrypted under the VMK, a random key that is generated once
and never derived from anything user-memorable. The VMK is stored only in
*wrapped* (encrypted) form — once under a passphrase-derived key, and
optionally again under a WebAuthn-derived key.

This indirection buys two properties:

1. **Changing your passphrase is cheap and doesn't touch account
   ciphertext.** Only the wrapped copy of the VMK is re-encrypted. (An
   earlier, simpler design that encrypted accounts directly with a
   passphrase-derived key was scrapped during development specifically
   because it made passphrase changes require re-encrypting every account,
   and made WebAuthn unlock impossible without either exporting a key that
   should stay non-extractable, or maintaining two separately-encrypted
   copies of every account.)
2. **Multiple independent unlock methods can coexist** (passphrase,
   WebAuthn) without either one being weaker than encrypting directly, and
   without the actual data-encryption key ever being marked `extractable`
   in the Web Crypto API — see below.

## Keys are non-extractable

Every `CryptoKey` that touches account plaintext or wraps the VMK is
imported/derived with Web Crypto's `extractable: false`. This is a real,
checkable property, not just a policy statement — `crypto.subtle.exportKey`
on any of these keys throws. In practice this means: even if malicious
JavaScript ran in the page (e.g. via a dependency-chain XSS), it could
still invoke the key to *encrypt/decrypt through the API* if it had a
handle to the live session's `CryptoKey` object, but it could not export
the raw key bytes for offline use. This is a meaningful reduction in blast
radius, not a complete mitigation — XSS in an unlocked session is still bad
(see "What this does not protect against" below).

## WebAuthn unlock: PRF-only, by design

WebAuthn's basic assertion flow proves "the user passed device
verification" — it does not hand your code any secret key material. Some
apps use that as a weak "unlock gate": require an assertion, then just...
let you in, without the data actually being re-encrypted or protected by
anything the assertion produced. That's a UX convenience, not encryption,
and presenting it as the latter would be misleading.

This app only enables WebAuthn unlock when the authenticator supports the
**PRF extension**, which returns a deterministic, secret-derived byte
string during an assertion. That output is fed through HKDF to derive a
real AES-GCM key, which wraps the same VMK your passphrase wraps. If your
browser/authenticator doesn't support PRF, the "set up device unlock"
option is simply unavailable — there's no fallback "gate" mode, because it
would add a false sense of security. As of this writing, PRF support is
inconsistent across browsers and authenticators (better on recent platform
authenticators, patchy on older devices and many USB security keys) — the
app degrades gracefully by hiding the feature when unsupported.

## What this protects against

- **Someone with your device's disk/IndexedDB but not your passphrase**
  (e.g. a stolen laptop with full-disk encryption off, or another user
  account on a shared machine reading browser profile files directly):
  they get ciphertext they cannot decrypt without either your passphrase
  or a successful WebAuthn PRF assertion against your enrolled
  authenticator.
- **A backup file falling into the wrong hands** without its separate
  backup password: same guarantee, independent key.
- **Passive network observation**: nothing is transmitted; there is no
  network dependency for this app's core function at all.

## What this does NOT protect against

Be realistic about these — no client-side web app can fully solve them:

- **A weak or reused passphrase.** PBKDF2 at 600k iterations meaningfully
  slows brute-force, but doesn't make a short/common passphrase safe.
  Choose something you couldn't type from memory if you'd only seen it
  once — length matters more than symbol complexity.
- **Malware or a compromised browser on your device while the vault is
  unlocked.** If something can read the page's memory or intercept
  clipboard/DOM while you're actively using the app, non-extractable keys
  don't help — the attacker can just ask the unlocked session to decrypt
  things for it, the same way you can.
- **Browser extensions with broad page access.** A malicious or compromised
  extension with access to this page can read anything the page can read
  while unlocked, including codes as they're generated and displayed.
- **Forgetting your passphrase with no backup.** There is deliberately no
  server-side recovery mechanism — that would mean someone other than you
  could decrypt your accounts. Losing the passphrase with no exported
  backup means losing the accounts (you'd need to re-enroll each one from
  its issuing service).
- **Phishing.** TOTP codes are still phishable (the classic real-time
  relay attack) — this app doesn't and can't change that; it's a limitation
  of TOTP as a protocol, not of this implementation.
- **Physical shoulder-surfing / screen recording** while codes are visible.

## Backup file format

Export produces a JSON file: `{ format, version, createdAt, kdf, payload }`,
where `payload` is AES-256-GCM ciphertext of the account list, encrypted
under a PBKDF2 key derived from a backup password **you choose at export
time** — independent of your vault passphrase, so a backup can be stored or
shared elsewhere without exposing your live vault's unlock credential.
Import validates the file's shape and format version before attempting
decryption, and skips (rather than aborting on) individual malformed
account entries so one corrupt record doesn't block restoring the rest.

## Testing performed

- The OTP engine (Base32, HOTP, TOTP) is verified against the official
  RFC 4648, RFC 4226, and RFC 6238 test vectors — not just "it produces a
  6-digit number," but the exact documented outputs for known inputs
  across SHA-1/256/512.
- The crypto layer (PBKDF2 derivation, AES-GCM roundtrip, tamper detection
  via GCM's auth tag, VMK wrap/unwrap) has direct unit tests, including
  negative cases (wrong key, tampered ciphertext).
- The vault service (init → unlock → wrong-passphrase-rejected →
  change-passphrase → accounts-still-readable) is covered by an
  integration test against a real (fake-indexeddb-backed) storage layer.
- Backup export/import is tested including malicious/corrupt-input paths:
  non-JSON, wrong format tag, wrong version, tampered ciphertext, and
  partially-corrupt account lists.
- WebAuthn and camera-based QR scanning are implemented and reviewed but
  could not be exercised against real hardware/camera in the environment
  this was built in (headless container, no WebAuthn authenticator, no
  camera). **Test these two features directly in your target browser
  before relying on them.**
- No formal third-party security audit or penetration test has been
  performed. Treat this as a solid-effort personal/small-scale tool, not
  as vetted enterprise security software.

## Reporting a concern

This is a self-hosted project with no vendor — if you find a flaw, fix it
(or have someone you trust review a fix) before relying on the affected
functionality.
