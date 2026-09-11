/**
 * RFC 4648 Base32 codec (the variant used by OTPAuth secrets).
 * No external dependency — this is small enough, security-sensitive enough,
 * and stable enough to own directly rather than trust to a package.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const CHAR_TO_VALUE: Record<string, number> = Object.fromEntries(
  ALPHABET.split('').map((c, i) => [c, i]),
)

export class Base32Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Base32Error'
  }
}

/**
 * Normalizes user-entered Base32: uppercases, strips whitespace/hyphens,
 * and removes optional '=' padding. This does NOT validate — call
 * isValidBase32() or decodeBase32() to validate.
 */
export function normalizeBase32(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/=+$/, '')
}

/**
 * Validates non-empty Base32 (used to gate account-creation UI, where an
 * empty secret should never be accepted). decodeBase32() separately treats
 * the empty string as "zero bytes" for general codec correctness — see
 * the RFC 4648 round-trip test.
 */
export function isValidBase32(input: string): boolean {
  const normalized = normalizeBase32(input)
  if (normalized.length === 0) return false
  // Base32 without padding must not leave an undecodable remainder.
  // Valid unpadded lengths mod 8: 0,2,4,5,7 are fine; 1,3,6 cannot exist.
  const remainder = normalized.length % 8
  if (remainder === 1 || remainder === 3 || remainder === 6) return false
  for (const ch of normalized) {
    if (!(ch in CHAR_TO_VALUE)) return false
  }
  return true
}

/** Decodes a Base32 string into raw bytes. Throws Base32Error if invalid. */
export function decodeBase32(input: string): Uint8Array {
  const normalized = normalizeBase32(input)
  if (normalized.length === 0) {
    return new Uint8Array(0)
  }
  if (!isValidBase32(normalized)) {
    throw new Base32Error('Invalid Base32 secret.')
  }

  const bytes: number[] = []
  let buffer = 0
  let bitsInBuffer = 0

  for (const ch of normalized) {
    const value = CHAR_TO_VALUE[ch]
    buffer = (buffer << 5) | value
    bitsInBuffer += 5

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8
      bytes.push((buffer >> bitsInBuffer) & 0xff)
    }
  }

  return new Uint8Array(bytes)
}

/** Encodes raw bytes as an unpadded, uppercase Base32 string. */
export function encodeBase32(bytes: Uint8Array): string {
  let buffer = 0
  let bitsInBuffer = 0
  let output = ''

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bitsInBuffer += 8

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5
      output += ALPHABET[(buffer >> bitsInBuffer) & 0x1f]
    }
  }

  if (bitsInBuffer > 0) {
    output += ALPHABET[(buffer << (5 - bitsInBuffer)) & 0x1f]
  }

  return output
}

/** Formats a Base32 secret into groups of 4 for readability, e.g. "JBSW Y3DP EHPK". */
export function formatBase32ForDisplay(input: string): string {
  const normalized = normalizeBase32(input)
  return normalized.replace(/(.{4})/g, '$1 ').trim()
}
