// Proposal details, mirroring the Zoho "Deal Information" and "Proposal Information" forms.
// One list drives the form, the Excel sheet and the import, so they stay in step.

export type ProposalFieldType = 'text' | 'textarea' | 'number' | 'date' | 'url' | 'email' | 'tel' | 'checkbox' | 'select'

export interface ProposalField {
  key: string
  label: string
  group: 'deal' | 'proposal'
  type: ProposalFieldType
  required?: boolean
  /** Fixed choices for a select. */
  options?: string[]
  /** Suggestions for a free-text field. */
  suggestions?: string[]
  wide?: boolean
}

export const PROPOSAL_FIELDS: ProposalField[] = [
  { key: 'additionalWorksVariation', label: 'For Additional Works Variation', group: 'deal', type: 'checkbox', wide: true },
  { key: 'dealName', label: 'Deal Name', group: 'deal', type: 'text', required: true },
  { key: 'dealOwner', label: 'Deal Owner', group: 'deal', type: 'text' },
  { key: 'contactName', label: 'Contact Name', group: 'deal', type: 'text' },
  { key: 'companyName', label: 'Company Name', group: 'deal', type: 'text' },
  { key: 'proposalNumber', label: 'Proposal Number', group: 'deal', type: 'text' },
  { key: 'orderNumber', label: 'Order Number', group: 'deal', type: 'text' },
  { key: 'stage', label: 'Stage', group: 'deal', type: 'text' },
  { key: 'closingDate', label: 'Closing Date', group: 'deal', type: 'date' },
  { key: 'orderValueInCrm', label: 'Order Value in CRM (AED)', group: 'deal', type: 'number' },
  { key: 'locationTag', label: 'Location Tag', group: 'deal', type: 'text' },
  { key: 'address', label: 'Address', group: 'deal', type: 'textarea', required: true, wide: true },
  { key: 'latestProposalLink', label: 'Latest Generated Proposal', group: 'deal', type: 'url' },
  { key: 'latestOrderConfirmationLink', label: 'Latest Generated Order Confirmation', group: 'deal', type: 'url' },
  { key: 'dealOwnerEmail', label: 'Deal Owner Email', group: 'deal', type: 'email' },
  { key: 'dealOwnerNumber', label: 'Deal Owner Number', group: 'deal', type: 'tel' },
  { key: 'dealOwnerQrLink', label: 'Deal Owner QR Link', group: 'deal', type: 'url' },
  { key: 'proposalReference', label: 'Proposal Reference', group: 'deal', type: 'text' },
  { key: 'proposalReferenceNumber', label: 'Proposal Reference Number', group: 'deal', type: 'text' },
  { key: 'ocGenerated', label: 'OC Generated', group: 'deal', type: 'select', options: ['', 'Yes', 'No'] },
  { key: 'projectName', label: 'Project Name', group: 'deal', type: 'text' },

  { key: 'proposalOwner', label: 'Proposal Owner', group: 'proposal', type: 'text', required: true, suggestions: ['Business Support'] },
  { key: 'priority', label: 'Priority', group: 'proposal', type: 'select', required: true, options: ['High', 'Medium', 'Low'] },
  { key: 'expectedCompletionDate', label: 'Expected Date of Completion', group: 'proposal', type: 'date', required: true },
  { key: 'quoteStatus', label: 'Quote Status', group: 'proposal', type: 'text', required: true, suggestions: ['Not Started', 'Accepted by the Client'] },
  { key: 'proposalDate', label: 'Proposal Date', group: 'proposal', type: 'date', required: true },
  { key: 'revisionNumber', label: 'Revision Number', group: 'proposal', type: 'number', required: true },
]

export type ProposalDetails = Record<string, string | number | boolean>

const today = () => new Date().toISOString().slice(0, 10)

/** Zoho's defaults for a new proposal. */
export function blankProposal(): ProposalDetails {
  const d: ProposalDetails = {}
  for (const f of PROPOSAL_FIELDS) d[f.key] = f.type === 'checkbox' ? false : f.type === 'number' ? 0 : ''
  return { ...d, proposalOwner: 'Business Support', priority: 'High', quoteStatus: 'Not Started', expectedCompletionDate: today(), proposalDate: today() }
}

/** Labels of required fields that are still empty. */
export function missingRequired(d: ProposalDetails): string[] {
  return PROPOSAL_FIELDS.filter((f) => f.required && f.type !== 'number' && String(d[f.key] ?? '').trim() === '').map((f) => f.label)
}
