import type { OtpAlgorithm, OtpDigits } from '../types/account'
import { generateHotp } from './hotp'

export interface TotpOptions {
  secret: string
  algorithm?: OtpAlgorithm
  digits?: OtpDigits
  /** Period in seconds. */
  period?: number
  /** Unix time in milliseconds. Defaults to Date.now(). Exposed for testing. */
  timestampMs?: number
}

/**
 * Computes the TOTP counter for a given moment (RFC 6238 §4.2).
 * Uses integer (BigInt) division throughout — no floating point — so
 * there is no risk of rounding error near a period boundary.
 */
export function timeToCounter(timestampMs: number, periodSeconds: number): bigint {
  if (periodSeconds <= 0) {
    throw new RangeError('TOTP period must be a positive number of seconds.')
  }
  const timestampSeconds = BigInt(Math.floor(timestampMs / 1000))
  const period = BigInt(periodSeconds)
  return timestampSeconds / period
}

/** Generates the current (or a specified moment's) TOTP code (RFC 6238). */
export async function generateTotp({
  secret,
  algorithm = 'SHA-1',
  digits = 6,
  period = 30,
  timestampMs = Date.now(),
}: TotpOptions): Promise<string> {
  const counter = timeToCounter(timestampMs, period)
  return generateHotp({ secret, counter, algorithm, digits })
}

/**
 * Seconds remaining until the current TOTP period boundary, in [1, period].
 * Never returns 0 so UIs can treat "0 seconds left" as "about to roll over"
 * without an off-by-one flicker.
 */
export function secondsRemaining(periodSeconds: number, timestampMs: number = Date.now()): number {
  const elapsedInPeriod = Math.floor(timestampMs / 1000) % periodSeconds
  const remaining = periodSeconds - elapsedInPeriod
  return remaining
}

/** Unix ms timestamp of the next period boundary (i.e. when the code will change). */
export function nextBoundaryMs(periodSeconds: number, timestampMs: number = Date.now()): number {
  const periodMs = periodSeconds * 1000
  return (Math.floor(timestampMs / periodMs) + 1) * periodMs
}
