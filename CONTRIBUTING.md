# Contributing

Issues and pull requests are welcome.

## Development setup

```bash
git clone https://github.com/subashbuilds/Authenticator.git
cd Authenticator
npm install
npm run dev
```

## Before opening a PR

```bash
npm run lint
npm test
npm run build
```

All three should pass — CI runs the same checks on every push and PR.

## Guidelines

- The cryptographic core (`src/otp/`, `src/crypto/`, `src/storage/`, `src/services/`) has no
  React dependency and is fully unit-tested. If you touch it, add or update tests — see
  `src/otp/*.test.ts` for examples using the official RFC test vectors.
- Keep secrets out of logs. There should be no `console.log` of passphrases, secrets, or derived
  keys anywhere in the codebase — this is checked informally in review, not by a linter rule, so
  please self-check.
- UI changes should keep working with keyboard navigation and screen readers where reasonably
  possible (existing components use semantic HTML, `aria-label`s, and focus-visible styles).
- For anything touching the encryption or vault-unlock flow, please read
  [SECURITY.md](./SECURITY.md) first — that document explains *why* things are built the way
  they are (e.g. why keys are non-extractable, why WebAuthn unlock requires PRF specifically).

## Reporting a security concern

This is a community project without a dedicated security team. If you find a vulnerability,
please open an issue with as much detail as you can, or reach out to the maintainer directly if
the issue is sensitive enough that public disclosure first would put users at risk.
