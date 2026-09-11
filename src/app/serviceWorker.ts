import { registerSW } from 'virtual:pwa-register'

/**
 * Registers the service worker for offline use. On update, we don't
 * force-reload silently (that could yank a mid-typing passphrase field
 * out from under someone) — instead we surface a lightweight confirm and
 * let the user choose when to reload.
 */
export function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    onNeedRefresh() {
      const shouldUpdate = window.confirm(
        'A new version of the authenticator is available. Reload now to update?',
      )
      if (shouldUpdate) updateSW(true)
    },
    onOfflineReady() {
      // Nothing to announce — offline support is expected behavior for
      // this app, not a notable event worth interrupting the user for.
    },
  })
}
