// Calls to the estimation_zoho Catalyst function. The browser sends only the
// sign-in token; the function holds the Zoho link.
import { authToken } from '../auth/catalyst'

/** Not a secret. Slate and Functions live on different domains, so this must be a full URL. */
const API_URL = import.meta.env.VITE_ZOHO_API_URL as string

export interface DealHit {
  id: string
  name: string
  company: string
  stage: string
}

export interface DealDetails {
  crm: {
    id: string
    dealName: string
    contactName: string
    companyName: string
    dealOwner: string
    dealOwnerEmail: string
    stage: string
    closingDate: string
    orderValueInCrm: number
    address: string
    locationTag: string
    orderNumber: string
    proposalNumber: string
  }
  /** From the deal's latest Creator proposal; null when it has none yet. */
  creator: { proposalReference: string; dealOwnerNumber: string; projectName: string; proposalReferenceNumber: string } | null
}

const MESSAGES: Record<string, string> = {
  admins_only: 'Only Admins can look up Zoho opportunities. Sign in again with an Admin account.',
  not_signed_in: 'Your session has ended. Refresh the page and sign in again.',
  zoho_not_configured: 'The Zoho connection is not set up yet (ZOHO_MCP_URL setting missing).',
  zoho_unavailable: 'Zoho did not answer. Try again in a moment.',
  deal_not_found: 'That opportunity was not found in Zoho CRM.',
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const failed = 'Could not reach Zoho. Check your connection and try again.'
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: await authToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(failed)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(MESSAGES[data?.error] ?? failed)
  return data as T
}

/** The signed-in user, as the server function sees them. */
export const currentUser = () => call<{ email: string; admin: boolean }>({ action: 'me' })

export interface ZohoProposal {
  id: string
  reference: string
  revision: number
  status: string
  total: number
  dealName: string
}

/** One BOQ line as the server function returns it: BOQ_Summary link names, values as text. */
export type ZohoBoqLine = Record<string, string>

export const searchDeals = async (query: string) => (await call<{ deals: DealHit[] }>({ action: 'searchDeals', query })).deals
export const dealDetails = (dealId: string) => call<DealDetails>({ action: 'dealDetails', dealId })
export const dealProposals = async (dealId: string) => (await call<{ proposals: ZohoProposal[] }>({ action: 'dealProposals', dealId })).proposals
export const proposalBoq = async (proposalId: string) => (await call<{ lines: ZohoBoqLine[] }>({ action: 'proposalBoq', proposalId })).lines
