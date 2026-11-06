import { useEffect, useState, type ReactNode } from 'react'
import { isSignedIn, signOut, type SignedInUser } from './catalyst'
import { NoAccess, SignIn } from './SignIn'
import { currentUser } from '../zoho/crm'

type State =
  | { kind: 'loading' }
  | { kind: 'signedOut'; message?: string }
  | { kind: 'noAccess' }
  | { kind: 'signedIn'; user: SignedInUser }

const UNAVAILABLE = 'Could not reach the sign-in service. Check your connection and try again.'

/** Only active App Administrators may use the app for now. The server function decides. */
export function AuthGate({ children }: { children: (user: SignedInUser, signOut: () => void) => ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    const settle = async (): Promise<State> => {
      if (!(await isSignedIn())) return { kind: 'signedOut' }
      const me = await currentUser()
      return me.admin ? { kind: 'signedIn', user: { email: me.email } } : { kind: 'noAccess' }
    }
    settle()
      .catch((): State => ({ kind: 'signedOut', message: UNAVAILABLE }))
      .then((next) => { if (live) setState(next) })
    return () => { live = false }
  }, [])

  if (state.kind === 'loading') return <div className="gate-loading">Loading…</div>
  if (state.kind === 'signedOut') return <SignIn key={state.message ?? ''} initialMessage={state.message} />
  if (state.kind === 'noAccess') return <NoAccess />
  return <>{children(state.user, () => { void signOut() })}</>
}
