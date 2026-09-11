import { describe, expect, it } from 'vitest'
import { encodeBase32 } from './base32'
import { generateTotp, nextBoundaryMs, secondsRemaining, timeToCounter } from './totp'

// RFC 6238 Appendix B reference vectors. The RFC uses raw ASCII secrets
// directly as HMAC keys (not Base32); we Base32-encode them here since our
// public API takes Base32, exactly as OTPAuth URIs do.
const SECRET_20_B32 = encodeBase32(new TextEncoder().encode('12345678901234567890'))
const SECRET_32_B32 = encodeBase32(new TextEncoder().encode('12345678901234567890123456789012'))
const SECRET_64_B32 = encodeBase32(
  new TextEncoder().encode(
    '1234567890123456789012345678901234567890123456789012345678901234',
  ),
)

// [unixSeconds, sha1, sha256, sha512] — all 8 digits, period 30, T0 = 0.
const RFC_6238_VECTORS: Array<[number, string, string, string]> = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826'],
]

describe('totp', () => {
  it('matches RFC 6238 Appendix B reference vectors for SHA-1, SHA-256, SHA-512', async () => {
    for (const [unixSeconds, expectedSha1, expectedSha256, expectedSha512] of RFC_6238_VECTORS) {
      const timestampMs = unixSeconds * 1000

      const sha1 = await generateTotp({
        secret: SECRET_20_B32,
        algorithm: 'SHA-1',
        digits: 8,
        period: 30,
        timestampMs,
      })
      expect(sha1, `SHA-1 @ ${unixSeconds}`).toBe(expectedSha1)

      const sha256 = await generateTotp({
        secret: SECRET_32_B32,
        algorithm: 'SHA-256',
        digits: 8,
        period: 30,
        timestampMs,
      })
      expect(sha256, `SHA-256 @ ${unixSeconds}`).toBe(expectedSha256)

      const sha512 = await generateTotp({
        secret: SECRET_64_B32,
        algorithm: 'SHA-512',
        digits: 8,
        period: 30,
        timestampMs,
      })
      expect(sha512, `SHA-512 @ ${unixSeconds}`).toBe(expectedSha512)
    }
  })

  it('produces the standard 6-digit codes by default', async () => {
    const code = await generateTotp({ secret: SECRET_20_B32, timestampMs: 59_000 })
    expect(code).toHaveLength(6)
    // Should be the last 6 digits of the known 8-digit vector for T=59.
    expect(code).toBe('94287082'.slice(-6))
  })

  it('computes the correct counter at period boundaries', () => {
    expect(timeToCounter(0, 30)).toBe(0n)
    expect(timeToCounter(29_999, 30)).toBe(0n)
    expect(timeToCounter(30_000, 30)).toBe(1n)
    expect(timeToCounter(59_999, 30)).toBe(1n)
    expect(timeToCounter(60_000, 30)).toBe(2n)
  })

  it('rejects a non-positive period', () => {
    expect(() => timeToCounter(1000, 0)).toThrow(RangeError)
    expect(() => timeToCounter(1000, -30)).toThrow(RangeError)
  })

  it('reports seconds remaining without ever hitting 0', () => {
    expect(secondsRemaining(30, 0)).toBe(30)
    expect(secondsRemaining(30, 1_000)).toBe(29)
    expect(secondsRemaining(30, 29_000)).toBe(1)
    expect(secondsRemaining(30, 29_999)).toBe(1)
  })

  it('computes the next boundary consistently with secondsRemaining', () => {
    const now = 1_700_000_000_123
    const boundary = nextBoundaryMs(30, now)
    const remaining = secondsRemaining(30, now)
    expect(boundary - now).toBe(remaining * 1000 - (now % 1000))
    expect(boundary % 30_000).toBe(0)
  })
})
