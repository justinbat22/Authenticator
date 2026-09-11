import type { OtpAlgorithm, OtpDigits } from '../types/account'
import { isValidBase32, normalizeBase32 } from './base32'
import { DEFAULT_ALGORITHM, DEFAULT_DIGITS, DEFAULT_PERIOD } from '../types/account'

export interface ParsedOtpAuth {
  issuer: string
  accountName: string
  secret: string
  algorithm: OtpAlgorithm
  digits: OtpDigits
  period: number
}

export class OtpAuthParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OtpAuthParseError'
  }
}

const VALID_ALGORITHMS = new Set<string>(['SHA1', 'SHA256', 'SHA512'])
const ALGORITHM_MAP: Record<string, OtpAlgorithm> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
}
const VALID_DIGITS = new Set([6, 8])
const MAX_PERIOD_SECONDS = 24 * 60 * 60 // sanity ceiling; nothing legitimate needs more.

/**
 * Parses an `otpauth://totp/...` URI, per the de facto Key URI Format.
 * Treats every field as untrusted: unknown/garbled input is rejected with
 * a human-readable error rather than silently defaulted or allowed to throw
 * an unhandled exception up into the UI.
 */
export function parseOtpAuthUri(rawUri: string): ParsedOtpAuth {
  const trimmed = rawUri.trim()
  if (!trimmed) {
    throw new OtpAuthParseError('This QR code or link is empty.')
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new OtpAuthParseError('This does not look like a valid otpauth link.')
  }

  if (url.protocol !== 'otpauth:') {
    throw new OtpAuthParseError('Only otpauth:// links are supported.')
  }

  // In "otpauth://totp/Label", the WHATWG URL parser puts "totp" in `host`
  // (it treats it as authority since otpauth has no registered scheme rules).
  const type = url.host.toLowerCase()
  if (type === 'hotp') {
    throw new OtpAuthParseError(
      'Counter-based (HOTP) accounts are not supported — only time-based (TOTP) accounts.',
    )
  }
  if (type !== 'totp') {
    throw new OtpAuthParseError(`Unsupported account type "${type || 'unknown'}".`)
  }

  const label = decodeURIComponent(url.pathname.replace(/^\//, ''))
  let issuerFromLabel = ''
  let accountName = label
  const separatorIndex = label.indexOf(':')
  if (separatorIndex !== -1) {
    issuerFromLabel = label.slice(0, separatorIndex).trim()
    accountName = label.slice(separatorIndex + 1).trim()
  }

  const params = url.searchParams
  const secretParam = params.get('secret')
  if (!secretParam) {
    throw new OtpAuthParseError('This code is missing a secret key.')
  }
  const secret = normalizeBase32(secretParam)
  if (!isValidBase32(secret)) {
    throw new OtpAuthParseError('The secret key in this code is not valid Base32.')
  }

  const issuerParam = params.get('issuer')?.trim() ?? ''
  // Per spec, issuer param and label prefix should match when both present.
  // We don't reject on mismatch (real-world QR codes are inconsistent) —
  // the issuer query param wins when present, since it's the documented
  // source of truth.
  const issuer = issuerParam || issuerFromLabel || 'Unknown issuer'

  let algorithm: OtpAlgorithm = DEFAULT_ALGORITHM
  const algorithmParam = params.get('algorithm')
  if (algorithmParam) {
    const normalizedAlg = algorithmParam.toUpperCase().replace(/-/g, '')
    if (!VALID_ALGORITHMS.has(normalizedAlg)) {
      throw new OtpAuthParseError(`Unsupported algorithm "${algorithmParam}".`)
    }
    algorithm = ALGORITHM_MAP[normalizedAlg]
  }

  let digits: OtpDigits = DEFAULT_DIGITS
  const digitsParam = params.get('digits')
  if (digitsParam) {
    const parsedDigits = Number(digitsParam)
    if (!VALID_DIGITS.has(parsedDigits)) {
      throw new OtpAuthParseError('Digit count must be 6 or 8.')
    }
    digits = parsedDigits as OtpDigits
  }

  let period = DEFAULT_PERIOD
  const periodParam = params.get('period')
  if (periodParam) {
    const parsedPeriod = Number(periodParam)
    if (!Number.isInteger(parsedPeriod) || parsedPeriod <= 0 || parsedPeriod > MAX_PERIOD_SECONDS) {
      throw new OtpAuthParseError('Period must be a positive number of seconds.')
    }
    period = parsedPeriod
  }

  if (!accountName) {
    accountName = issuer
  }

  return { issuer, accountName, secret, algorithm, digits, period }
}

/** Builds a display-only otpauth:// URI (e.g. for re-generating a QR to move an account). */
export function buildOtpAuthUri(account: ParsedOtpAuth): string {
  const label = account.issuer
    ? `${account.issuer}:${account.accountName}`
    : account.accountName
  const params = new URLSearchParams({
    secret: account.secret,
    issuer: account.issuer,
    algorithm: account.algorithm.replace('-', ''),
    digits: String(account.digits),
    period: String(account.period),
  })
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
}
