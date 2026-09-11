import { useEffect, useState } from 'react'
import type { AuthenticatorAccount } from '../types/account'
import { generateTotp, nextBoundaryMs, secondsRemaining } from '../otp/totp'

/**
 * A single shared 250ms tick, subscribed to by every account row, instead
 * of each row running its own setInterval. Countdown numbers stay
 * synchronized to wall-clock time (Date.now()) rather than accumulating
 * setInterval drift.
 */
type Listener = (now: number) => void
const listeners = new Set<Listener>()
let tickHandle: ReturnType<typeof setInterval> | null = null

function ensureTicking() {
  if (tickHandle !== null) return
  tickHandle = setInterval(() => {
    const now = Date.now()
    for (const listener of listeners) listener(now)
  }, 250)
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  ensureTicking()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && tickHandle !== null) {
      clearInterval(tickHandle)
      tickHandle = null
    }
  }
}

export interface TotpState {
  code: string | null
  secondsLeft: number
  period: number
  /** 0 (just started) to 1 (about to roll over) — for a progress ring. */
  progress: number
  error: string | null
}

export function useTotp(account: AuthenticatorAccount): TotpState {
  const [now, setNow] = useState(() => Date.now())
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribe(setNow), [])

  // Recompute the code whenever we cross a period boundary — not on every
  // 250ms tick, so we don't hammer Web Crypto for no reason.
  const boundary = nextBoundaryMs(account.period, now)
  useEffect(() => {
    let cancelled = false
    generateTotp({
      secret: account.secret,
      algorithm: account.algorithm,
      digits: account.digits,
      period: account.period,
      timestampMs: now,
    })
      .then((value) => {
        if (!cancelled) {
          setCode(value)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCode(null)
          setError(err instanceof Error ? err.message : 'Failed to generate code.')
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boundary is the intentional recompute trigger
  }, [boundary, account.secret, account.algorithm, account.digits, account.period])

  const secondsLeft = secondsRemaining(account.period, now)
  const progress = 1 - secondsLeft / account.period

  return { code, secondsLeft, period: account.period, progress, error }
}
