import { describe, expect, it } from 'vitest'
import { buildOtpAuthUri, OtpAuthParseError, parseOtpAuthUri } from './otpauth'

describe('parseOtpAuthUri', () => {
  it('parses a standard URI with issuer in both label and param', () => {
    const result = parseOtpAuthUri(
      'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example',
    )
    expect(result).toEqual({
      issuer: 'Example',
      accountName: 'alice@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
    })
  })

  it('parses a URI with no issuer param, deriving it from the label', () => {
    const result = parseOtpAuthUri('otpauth://totp/MyBank:bob?secret=JBSWY3DPEHPK3PXP')
    expect(result.issuer).toBe('MyBank')
    expect(result.accountName).toBe('bob')
  })

  it('parses a URI with no label prefix at all', () => {
    const result = parseOtpAuthUri('otpauth://totp/bob?secret=JBSWY3DPEHPK3PXP&issuer=MyBank')
    expect(result.issuer).toBe('MyBank')
    expect(result.accountName).toBe('bob')
  })

  it('respects explicit algorithm, digits, and period', () => {
    const result = parseOtpAuthUri(
      'otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&algorithm=SHA256&digits=8&period=60',
    )
    expect(result.algorithm).toBe('SHA-256')
    expect(result.digits).toBe(8)
    expect(result.period).toBe(60)
  })

  it('URL-decodes the label', () => {
    const result = parseOtpAuthUri(
      'otpauth://totp/My%20Bank:alice%40example.com?secret=JBSWY3DPEHPK3PXP',
    )
    expect(result.issuer).toBe('My Bank')
    expect(result.accountName).toBe('alice@example.com')
  })

  it('round-trips through buildOtpAuthUri', () => {
    const original = parseOtpAuthUri(
      'otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&algorithm=SHA512&digits=8&period=45',
    )
    const rebuilt = parseOtpAuthUri(buildOtpAuthUri(original))
    expect(rebuilt).toEqual(original)
  })

  it.each([
    ['not a uri at all', 'garbage'],
    ['a non-otpauth scheme', 'https://example.com/totp?secret=JBSWY3DPEHPK3PXP'],
    ['hotp (unsupported type)', 'otpauth://hotp/Example:alice?secret=JBSWY3DPEHPK3PXP&counter=0'],
    ['an unknown type', 'otpauth://weird/Example:alice?secret=JBSWY3DPEHPK3PXP'],
    ['a missing secret', 'otpauth://totp/Example:alice'],
    ['an invalid Base32 secret', 'otpauth://totp/Example:alice?secret=not-valid-base32!!!'],
    ['an unsupported algorithm', 'otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&algorithm=MD5'],
    ['invalid digits', 'otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&digits=7'],
    ['a zero period', 'otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&period=0'],
    ['a negative period', 'otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&period=-30'],
    ['an absurdly large period', 'otpauth://totp/Example:alice?secret=JBSWY3DPEHPK3PXP&period=999999999'],
    ['empty input', ''],
    ['whitespace only', '   '],
  ])('rejects %s', (_description, uri) => {
    expect(() => parseOtpAuthUri(uri)).toThrow(OtpAuthParseError)
  })

  it('never throws an uncaught non-OtpAuthParseError for garbled input', () => {
    const inputs = [
      'otpauth://totp/',
      'otpauth://totp/?secret=',
      'otpauth:totp',
      '////',
      'otpauth://totp/A:b?secret=JBSWY3DPEHPK3PXP&digits=abc',
    ]
    for (const input of inputs) {
      try {
        parseOtpAuthUri(input)
      } catch (err) {
        expect(err).toBeInstanceOf(OtpAuthParseError)
      }
    }
  })
})
