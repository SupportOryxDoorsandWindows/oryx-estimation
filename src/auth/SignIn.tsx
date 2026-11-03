import { useState, type FormEvent } from 'react'
import { supabase } from './supabase'

/** Sign-in screen, in the design of Oryx StockFlow's: brand panel left, form right. */
export function SignIn({ initialMessage }: { initialMessage?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialMessage ?? '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (err) setError(/invalid/i.test(err.message) ? 'Wrong email or password.' : err.message)
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate-hero">
        <img src="./oryx-logo-white.png" alt="Oryx Doors & Windows" />
        <div className="gate-hero-text">
          <p className="gate-hero-name">Oryx Estimation</p>
          <p className="gate-hero-h">Every price, with its working.</p>
          <p>Estimates, revisions and the door price chart in one place. Every figure shows the formula behind it.</p>
        </div>
      </div>
      <div className="gate-card">
        <h2>Sign in</h2>
        <p className="gate-sub">Use your Oryx work email. Admins only for now.</p>
        <form className="gate-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Work email</span>
            <input type="email" autoComplete="username" required placeholder="name@oryxdoors.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary gate-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="gate-status" role="status" aria-live="polite">{error}</div>
        <div className="gate-foot">
          <p className="gate-help"><b>New here or forgot your password?</b><br />Ask your Admin. The app uses the same accounts as Oryx Fleet.</p>
        </div>
      </div>
    </div>
  )
}
