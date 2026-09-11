import { describe, expect, it } from 'vitest'
import { decodeBase32, encodeBase32, isValidBase32, normalizeBase32 } from './base32'

// RFC 4648 §10 test vectors (padding stripped, since this codec is unpadded).
const RFC_4648_VECTORS: Array<[string, string]> = [
  ['', ''],
  ['f', 'MY'],
  ['fo', 'MZXQ'],
  ['foo', 'MZXW6'],
  ['foob', 'MZXW6YQ'],
  ['fooba', 'MZXW6YTB'],
  ['foobar', 'MZXW6YTBOI'],
]

describe('base32', () => {
  it('encodes per RFC 4648 test vectors', () => {
    for (const [plain, expected] of RFC_4648_VECTORS) {
      const bytes = new TextEncoder().encode(plain)
      expect(encodeBase32(bytes)).toBe(expected)
    }
  })

  it('decodes per RFC 4648 test vectors', () => {
    for (const [plain, encoded] of RFC_4648_VECTORS) {
      const decoded = decodeBase32(encoded)
      expect(new TextDecoder().decode(decoded)).toBe(plain)
    }
  })

  it('round-trips arbitrary byte lengths (0-16 bytes)', () => {
    for (let len = 0; len <= 16; len++) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 37 + 11) % 256)
      const roundTripped = decodeBase32(encodeBase32(bytes))
      expect(Array.from(roundTripped)).toEqual(Array.from(bytes))
    }
  })

  it('normalizes lowercase, whitespace, and padding', () => {
    expect(normalizeBase32('mzxw6ytb')).toBe('MZXW6YTB')
    expect(normalizeBase32('MZXW 6YTB')).toBe('MZXW6YTB')
    expect(normalizeBase32('MZXW6YTB====')).toBe('MZXW6YTB')
    expect(normalizeBase32('mz-xw6-ytb')).toBe('MZXW6YTB')
  })

  it('accepts valid unpadded lengths', () => {
    expect(isValidBase32('MY')).toBe(true) // remainder 2
    expect(isValidBase32('MZXW6')).toBe(true) // remainder 5
    expect(isValidBase32('MZXW6YTB')).toBe(true) // remainder 0
  })

  it('rejects invalid characters', () => {
    expect(isValidBase32('MZXW6YT1')).toBe(false) // '1' not in alphabet
    expect(isValidBase32('mzxw6ytb!')).toBe(false)
  })

  it('rejects impossible unpadded lengths', () => {
    expect(isValidBase32('M')).toBe(false) // remainder 1 — impossible
    expect(isValidBase32('MZX')).toBe(false) // remainder 3 — impossible
    expect(isValidBase32('MZXW6Y')).toBe(false) // remainder 6 — impossible
  })

  it('rejects empty input', () => {
    expect(isValidBase32('')).toBe(false)
  })

  it('throws Base32Error on decode of invalid input', () => {
    expect(() => decodeBase32('not valid!!')).toThrow()
  })
})
