import { useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const CHECK_INTERVAL_MS = 2_000

/**
 * Fires `onLock` once at least `minutes` have elapsed since the last user
 * activity. Uses a polling check against real timestamps (rather than a
 * single setTimeout) so a laptop going to sleep and waking up hours later
 * locks immediately on wake, instead of waiting for a timer that may have
 * been paused the whole time the device was asleep.
 *
 * `minutes <= 0` disables auto-lock entirely.
 */
export function useAutoLock(minutes: number, onLock: () => void): void {
  const lastActiveRef = useRef(0)
  const onLockRef = useRef(onLock)

  // Keep the ref pointing at the latest callback without mutating it
  // during render (that's a React purity violation) — an effect is the
  // correct place for this "always-latest closure" pattern.
  useEffect(() => {
    onLockRef.current = onLock
  }, [onLock])

  useEffect(() => {
    if (minutes <= 0) return

    const markActive = () => {
      lastActiveRef.current = Date.now()
    }

    const checkTimeout = () => {
      const elapsedMs = Date.now() - lastActiveRef.current
      if (elapsedMs >= minutes * 60_000) {
        onLockRef.current()
      }
    }

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, markActive, { passive: true })
    }
    // Coming back from a backgrounded tab counts as an immediate check,
    // not as "activity" — we want a real re-check of elapsed time, since
    // the tab may have been hidden well past the timeout.
    document.addEventListener('visibilitychange', checkTimeout)

    const interval = setInterval(checkTimeout, CHECK_INTERVAL_MS)

    return () => {
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, markActive)
      }
      document.removeEventListener('visibilitychange', checkTimeout)
      clearInterval(interval)
    }
  }, [minutes])

  // Any mount/prop change also counts as activity (e.g. just unlocked).
  useEffect(() => {
    lastActiveRef.current = Date.now()
  }, [minutes])
}
