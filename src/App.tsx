import { useState } from 'react'
import { VaultProvider } from './app/VaultContext'
import { useVault } from './app/vaultHooks'
import { OnboardingScreen } from './features/onboarding/OnboardingScreen'
import { LockScreen } from './features/lock/LockScreen'
import { AccountListScreen } from './features/accounts/AccountListScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { DocumentationScreen } from './features/docs/DocumentationScreen'

function AppRoutes() {
  const { status } = useVault()
  const [showSettings, setShowSettings] = useState(false)
  const [showDocs, setShowDocs] = useState(false)

  if (showDocs) {
    return <DocumentationScreen onBack={() => setShowDocs(false)} />
  }

  if (status === 'loading') {
    return <div style={{ flex: 1 }} />
  }
  if (status === 'uninitialized') {
    return <OnboardingScreen onOpenDocs={() => setShowDocs(true)} />
  }
  if (status === 'locked') {
    return <LockScreen onOpenDocs={() => setShowDocs(true)} />
  }
  return showSettings ? (
    <SettingsScreen onBack={() => setShowSettings(false)} onOpenDocs={() => setShowDocs(true)} />
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
