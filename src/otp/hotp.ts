import type { OtpAlgorithm, OtpDigits } from '../types/account'
import { decodeBase32 } from './base32'
import { asBufferSource } from '../utils/binary'

const DIGIT_MODULUS: Record<OtpDigits, number> = {
  6: 1_000_000,
  8: 100_000_000,
}

function algorithmToSubtleName(algorithm: OtpAlgorithm): string {
  switch (algorithm) {
    case 'SHA-1':
      return 'SHA-1'
    case 'SHA-256':
      return 'SHA-256'
    case 'SHA-512':
      return 'SHA-512'
  }
}

/**
 * Encodes a non-negative counter as an 8-byte big-endian buffer.
 * Uses BigInt throughout — counters can exceed Number.MAX_SAFE_INTEGER's
 * safe bit-manipulation range once you're doing bitwise shifts, and TOTP
 * counters derived from far-future timestamps must not silently corrupt.
 */
export function counterToBytes(counter: bigint): Uint8Array {
  if (counter < 0n) {
    throw new RangeError('HOTP counter must be non-negative.')
  }
  const bytes = new Uint8Array(8)
  let value = counter
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return bytes
}

/**
 * Computes an HMAC over the counter using the given secret and algorithm.
 * This is the only place that touches Web Crypto's HMAC primitive, so the
 * whole OTP engine's correctness rests on this function and counterToBytes.
 */
async function hmac(
  secretBytes: Uint8Array,
  counterBytes: Uint8Array,
  algorithm: OtpAlgorithm,
): Promise<Uint8Array> {
  // Web Crypto requires a non-empty key buffer.
  const keyData = new Uint8Array(secretBytes)
  const key = await crypto.subtle.importKey(
    'raw',
    asBufferSource(keyData),
    { name: 'HMAC', hash: algorithmToSubtleName(algorithm) },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, asBufferSource(counterBytes))
  return new Uint8Array(signature)
}

/** RFC 4226 dynamic truncation. */
function dynamicTruncate(hmacResult: Uint8Array, digits: OtpDigits): string {
  const offset = hmacResult[hmacResult.length - 1] & 0x0f
  const binary =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)

  const modulus = DIGIT_MODULUS[digits]
  const code = binary % modulus
  return code.toString().padStart(digits, '0')
}

export interface HotpOptions {
  /** Base32-encoded secret. */
  secret: string
  counter: bigint
  algorithm?: OtpAlgorithm
  digits?: OtpDigits
}

/** Generates a single HOTP value for an explicit counter (RFC 4226). */
export async function generateHotp({
  secret,
  counter,
  algorithm = 'SHA-1',
  digits = 6,
}: HotpOptions): Promise<string> {
  const secretBytes = decodeBase32(secret)
  if (secretBytes.length === 0) {
    throw new RangeError('Decoded secret must not be empty.')
  }
  const counterBytes = counterToBytes(counter)
  const result = await hmac(secretBytes, counterBytes, algorithm)
  return dynamicTruncate(result, digits)
}
