import { useEffect, useState, type ReactNode } from 'react'
import { showSignIn, signOut } from './catalyst'

const LOGIN_ELEMENT = 'gate-login'

/** Brand panel left, card right, in the design of Oryx StockFlow's sign-in. */
function Gate({ children }: { children: ReactNode }) {
  return (
    <div className="gate">
      <div className="gate-hero">
        <img src="./oryx-logo-white.png" alt="Oryx Doors & Windows" />
        <div className="gate-hero-text">
          <p className="gate-hero-name">Oryx Estimations</p>
          <p className="gate-hero-h">Every price, with its working.</p>
          <p>Estimates, revisions and the door price chart in one place. Every figure shows the formula behind it.</p>
        </div>
      </div>
      <div className="gate-card">{children}</div>
    </div>
  )
}

/** Catalyst draws the email and password form in an iframe, so passwords never reach this app. */
export function SignIn({ initialMessage }: { initialMessage?: string }) {
  const [error, setError] = useState(initialMessage ?? '')

  useEffect(() => {
    showSignIn(LOGIN_ELEMENT).catch(() => setError('Could not load the sign-in form. Refresh the page and try again.'))
  }, [])

  return (
    <Gate>
      <h2>Sign in</h2>
      <p className="gate-sub">Use your Oryx work email. Admins only for now.</p>
      <div id={LOGIN_ELEMENT} className="gate-login" />
      <div className="gate-status" role="status" aria-live="polite">{error}</div>
      <div className="gate-foot">
        <p className="gate-help"><b>New here?</b><br />Ask your Admin for an invitation.</p>
      </div>
    </Gate>
  )
}

export function NoAccess() {
  return (
    <Gate>
      <h2>No access yet</h2>
      <p className="gate-sub">This app is open to Admins only for now. Ask your Admin for access.</p>
      <button type="button" className="btn btn-primary gate-submit" onClick={() => { void signOut() }}>Sign out</button>
    </Gate>
  )
}
