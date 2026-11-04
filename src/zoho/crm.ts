// Calls to the estimation-zoho server function. The browser sends only the
// sign-in token; the server function holds the Zoho link.
import { supabase } from '../auth/supabase'

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
  zoho_not_configured: 'The Zoho connection is not set up yet (ZOHO_MCP_URL secret missing).',
  zoho_unavailable: 'Zoho did not answer. Try again in a moment.',
  deal_not_found: 'That opportunity was not found in Zoho CRM.',
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('estimation-zoho', { body })
  if (error) {
    let code = ''
    try { code = (await (error as { context?: Response }).context?.json())?.error ?? '' } catch { /* not JSON */ }
    throw new Error(MESSAGES[code] ?? 'Could not reach Zoho. Check your connection and try again.')
  }
  return data as T
}

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
