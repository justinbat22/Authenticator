import { useState } from 'react'
import { VaultProvider } from './app/VaultContext'
import { useVault } from './app/vaultHooks'
import { OnboardingScreen } from './features/onboarding/OnboardingScreen'
import { LockScreen } from './features/lock/LockScreen'
import { AccountListScreen } from './features/accounts/AccountListScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'

function AppRoutes() {
  const { status } = useVault()
  const [showSettings, setShowSettings] = useState(false)

  if (status === 'loading') {
    return <div style={{ flex: 1 }} />
  }
  if (status === 'uninitialized') {
    return <OnboardingScreen />
  }
  if (status === 'locked') {
    return <LockScreen />
  }
  return showSettings ? (
    <SettingsScreen onBack={() => setShowSettings(false)} />
  ) : (
    <AccountListScreen onOpenSettings={() => setShowSettings(true)} />
  )
}

function App() {
  return (
    <VaultProvider>
      <div className="app-shell">
        <AppRoutes />
      </div>
    </VaultProvider>
  )
}

export default App
