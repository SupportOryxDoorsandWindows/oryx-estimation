import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthGate } from './auth/AuthGate'
import './ui/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>{(user, signOut) => <App user={user} onSignOut={signOut} />}</AuthGate>
  </StrictMode>,
)
