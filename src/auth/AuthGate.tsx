import { useEffect, useState, type ReactNode } from 'react'
import { SignIn } from './SignIn'
import { supabase, type SignedInUser } from './supabase'

type State =
  | { kind: 'loading' }
  | { kind: 'signedOut'; message?: string }
  | { kind: 'signedIn'; user: SignedInUser }

/** Only active Admins of the Fleet app's accounts may use the app for now. */
async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('role, active').eq('id', userId).maybeSingle()
  return !!(data && data.active && data.role === 'admin')
}

export function AuthGate({ children }: { children: (user: SignedInUser, signOut: () => void) => ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    const settle = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!session) return live && setState((s) => (s.kind === 'signedOut' ? s : { kind: 'signedOut' }))
      if (await checkAdmin(session.user.id)) {
        if (live) setState({ kind: 'signedIn', user: { email: session.user.email ?? '' } })
      } else {
        await supabase.auth.signOut()
        if (live) setState({ kind: 'signedOut', message: 'This app is open to Admins only for now. Ask your Admin for access.' })
      }
    }
    supabase.auth.getSession().then(({ data }) => settle(data.session)).catch(() => live && setState({ kind: 'signedOut' }))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') settle(session)
    })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [])

  if (state.kind === 'loading') return <div className="gate-loading">Loading…</div>
  if (state.kind === 'signedOut') return <SignIn key={state.message ?? ''} initialMessage={state.message} />
  return <>{children(state.user, () => { void supabase.auth.signOut() })}</>
}
