// Catalyst Authentication, through the Web SDK loaded in index.html.

interface CatalystAuth {
  isUserAuthenticated(): Promise<{ content?: { email_id?: string } }>
  signIn(elementId: string, config: { service_url: string }): void
  signOut(redirectUrl: string): void
  generateAuthToken(): Promise<{ access_token: string }>
}

declare global {
  interface Window {
    catalyst?: { auth?: CatalystAuth }
  }
}

export interface SignedInUser {
  email: string
}

const SDK_WAIT_MS = 10_000

/** The Web SDK loads separately from the app, so wait for it. */
export function catalystAuth(): Promise<CatalystAuth> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const check = () => {
      const auth = window.catalyst?.auth
      if (auth?.signIn) return resolve(auth)
      if (Date.now() - started > SDK_WAIT_MS) return reject(new Error('sign_in_unavailable'))
      setTimeout(check, 100)
    }
    check()
  })
}

export async function isSignedIn(): Promise<boolean> {
  const auth = await catalystAuth()
  try {
    await auth.isUserAuthenticated()
    return true
  } catch {
    return false
  }
}

export async function showSignIn(elementId: string): Promise<void> {
  ;(await catalystAuth()).signIn(elementId, { service_url: '/' })
}

export async function signOut(): Promise<void> {
  ;(await catalystAuth()).signOut(window.location.origin)
}

/** A user token for backend calls, valid for one hour. */
export async function authToken(): Promise<string> {
  return (await (await catalystAuth()).generateAuthToken()).access_token
}
