import { describe, expect, it } from 'vitest'
import { encodeBase32 } from './base32'
import { counterToBytes, generateHotp } from './hotp'

// RFC 4226 Appendix D — secret is the ASCII string "12345678901234567890",
// SHA-1, 6 digits, counters 0-9.
const RFC_4226_SECRET_B32 = encodeBase32(new TextEncoder().encode('12345678901234567890'))
const RFC_4226_VECTORS = [
  '755224',
  '287082',
  '359152',
  '969429',
  '338314',
  '254676',
  '287922',
  '162583',
  '399871',
  '520489',
]

describe('hotp', () => {
  it('matches RFC 4226 Appendix D reference vectors', async () => {
    for (let counter = 0; counter < RFC_4226_VECTORS.length; counter++) {
      const code = await generateHotp({
        secret: RFC_4226_SECRET_B32,
        counter: BigInt(counter),
        algorithm: 'SHA-1',
        digits: 6,
      })
      expect(code).toBe(RFC_4226_VECTORS[counter])
    }
  })

  it('encodes counters as 8-byte big-endian', () => {
    expect(Array.from(counterToBytes(0n))).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(Array.from(counterToBytes(1n))).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    expect(Array.from(counterToBytes(255n))).toEqual([0, 0, 0, 0, 0, 0, 0, 255])
    expect(Array.from(counterToBytes(256n))).toEqual([0, 0, 0, 0, 0, 0, 1, 0])
  })

  it('handles large counters beyond 32-bit range without precision loss', () => {
    // 2^40 — well past what plain JS bitwise ops (32-bit) can represent.
    const bytes = counterToBytes(1_099_511_627_776n)
    expect(Array.from(bytes)).toEqual([0, 0, 1, 0, 0, 0, 0, 0])
  })

  it('rejects negative counters', () => {
    expect(() => counterToBytes(-1n)).toThrow(RangeError)
  })

  it('produces different codes for different digit counts', async () => {
    const code6 = await generateHotp({ secret: RFC_4226_SECRET_B32, counter: 0n, digits: 6 })
    const code8 = await generateHotp({ secret: RFC_4226_SECRET_B32, counter: 0n, digits: 8 })
    expect(code6).toHaveLength(6)
    expect(code8).toHaveLength(8)
    expect(code8.endsWith(code6)).toBe(true) // truncation keeps the same low-order digits
  })
})
