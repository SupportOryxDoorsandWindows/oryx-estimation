import type { ProposalDetails } from '../ui/proposal'
import type { DealDetails } from './crm'

/** Proposal-details fields filled from Zoho, and where each comes from. */
export const DEAL_SOURCES: Record<string, 'CRM' | 'Creator'> = {
  dealName: 'CRM', contactName: 'CRM', companyName: 'CRM', dealOwner: 'CRM', dealOwnerEmail: 'CRM',
  stage: 'CRM', closingDate: 'CRM', orderValueInCrm: 'CRM', address: 'CRM', locationTag: 'CRM',
  orderNumber: 'CRM', proposalNumber: 'CRM',
  dealOwnerNumber: 'Creator', projectName: 'Creator', proposalReferenceNumber: 'Creator',
}

/**
 * Applies a Zoho deal to the proposal details. Only non-empty Zoho values are
 * written, so a field Zoho leaves blank keeps what the estimator typed.
 * Returns the keys that were filled, for the "From CRM / Creator" tags.
 */
export function applyDeal(details: ProposalDetails, deal: DealDetails): { details: ProposalDetails; filled: string[] } {
  const values: Record<string, string | number> = { ...deal.crm, ...(deal.creator ?? {}) }
  const next: ProposalDetails = { ...details, crmDealId: deal.crm.id }
  const filled: string[] = []
  for (const key of Object.keys(DEAL_SOURCES)) {
    const v = values[key]
    if (v === undefined || v === null || v === '' || (key === 'orderValueInCrm' && !v)) continue
    next[key] = key === 'closingDate' ? String(v).slice(0, 10) : v
    filled.push(key)
  }
  next.crmFilled = filled.join(',')
  return { details: next, filled }
}
