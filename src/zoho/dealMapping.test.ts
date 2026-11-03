import { describe, expect, it } from 'vitest'
import { blankProposal } from '../ui/proposal'
import type { DealDetails } from './crm'
import { applyDeal } from './dealMapping'

const deal: DealDetails = {
  crm: {
    id: '4543538000001234567', dealName: 'OC00001 Test Villa', contactName: 'A. Client', companyName: 'Test Interiors',
    dealOwner: 'Sales Person', dealOwnerEmail: 'sales@example.com', stage: 'Proposal', closingDate: '2026-11-30',
    orderValueInCrm: 125000, address: '', locationTag: 'Dubai Hills', orderNumber: '26001', proposalNumber: 'P270001',
  },
  creator: { proposalReference: 'P270001R2', dealOwnerNumber: '+971 50 000 0000', projectName: '', proposalReferenceNumber: '270001' },
}

describe('Deal Name auto-fill', () => {
  it('fills the deal information from CRM and Creator', () => {
    const { details, filled } = applyDeal(blankProposal(), deal)
    expect(details).toMatchObject({
      dealName: 'OC00001 Test Villa', contactName: 'A. Client', companyName: 'Test Interiors', dealOwner: 'Sales Person',
      dealOwnerEmail: 'sales@example.com', stage: 'Proposal', closingDate: '2026-11-30', orderValueInCrm: 125000,
      locationTag: 'Dubai Hills', orderNumber: '26001', proposalNumber: 'P270001',
      dealOwnerNumber: '+971 50 000 0000', proposalReferenceNumber: '270001', crmDealId: '4543538000001234567',
    })
    expect(filled).not.toContain('address')
    expect(filled).not.toContain('projectName')
  })

  it('keeps what the estimator typed where Zoho is blank', () => {
    const { details } = applyDeal({ ...blankProposal(), address: 'Villa 12, Dubai', projectName: 'Villa 12' }, deal)
    expect(details.address).toBe('Villa 12, Dubai')
    expect(details.projectName).toBe('Villa 12')
  })

  it('does not take the existing proposal reference from Creator', () => {
    expect(applyDeal(blankProposal(), deal).details.proposalReference).toBe('')
  })

  it('works for a deal with no Creator proposal yet', () => {
    const { details, filled } = applyDeal(blankProposal(), { ...deal, creator: null })
    expect(details.dealOwnerNumber).toBe('')
    expect(filled).toContain('dealName')
  })
})
