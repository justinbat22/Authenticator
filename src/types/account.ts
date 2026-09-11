export type OtpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512'
export type OtpDigits = 6 | 8

/**
 * A single authenticator account (TOTP only — HOTP is out of scope for v1
 * because counter-based codes require server-side coordination that a
 * pure client-side app cannot provide safely).
 */
export interface AuthenticatorAccount {
  id: string
  issuer: string
  accountName: string
  /** Base32-encoded shared secret. Never logged, never rendered in URLs. */
  secret: string
  algorithm: OtpAlgorithm
  digits: OtpDigits
  /** Period in seconds. Almost always 30. */
  period: number
  type: 'totp'
  createdAt: number
  updatedAt: number
  favorite: boolean
  /** Manual sort position; lower sorts first. */
  order: number
  /** Optional user-assigned color/icon hint, purely cosmetic. */
  color?: string
}

export type NewAccountInput = Omit<
  AuthenticatorAccount,
  'id' | 'createdAt' | 'updatedAt' | 'order' | 'favorite'
> & { favorite?: boolean }

export const DEFAULT_ALGORITHM: OtpAlgorithm = 'SHA-1'
export const DEFAULT_DIGITS: OtpDigits = 6
export const DEFAULT_PERIOD = 30
