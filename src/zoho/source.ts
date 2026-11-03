// Where deals, accepted proposals and BOQ lines come from (Phase 2 plan §2–3, §7).
// Zoho stays the source of truth: a source fetches on demand and the app does not keep a copy.
import { calculateLineItem } from '../engine/calculate'
import { parseReference, snapshot, type ProposalRef, type RevisionDraft, type RevisionLine } from '../engine/revision'
import type { PricingRules, Product } from '../engine/types'
import { boqRowToItem, records, type ReadSheet } from '../io/workbook'

export interface DealSummary {
  name: string
  /** Zoho CRM record ID, when the source is CRM. */
  zohoId?: string
  details?: Record<string, string>
}

export interface ProposalSummary extends ProposalRef {
  status: string
  lineCount: number
  total: number
}

export interface ZohoSource {
  /** Shown to the user, e.g. "Test data: BOQ_Summary_1.xlsx". */
  label: string
  live: boolean
  searchDeals(query: string): Promise<DealSummary[]>
  /** Every proposal of the deal; callers filter to accepted ones. */
  proposals(dealName: string): Promise<ProposalSummary[]>
  /** BOQ lines of one proposal, fetched when it is selected. */
  boq(proposal: ProposalRef): Promise<RevisionLine[]>
  /** Sends a finished revision back to Zoho. Absent until the live connection exists. */
  submit?(draft: RevisionDraft): Promise<void>
}

/** Quote_Status values confirmed by Oryx (Zoho Creator, proposals-2-0). */
export const QUOTE_STATUS = {
  /** The proposal that can be revised. */
  accepted: 'Accepted by the Client',
  /** A new revision, until the client confirms it in Zoho. */
  workInProgress: 'Work in Progress',
  /** The earlier proposal once its revision is accepted. */
  replaced: 'Replaced Accepted Proposal',
} as const

/** Only the current accepted proposal can be revised, not one already replaced. */
export const isAccepted = (status: string) => status.trim().toLowerCase() === QUOTE_STATUS.accepted.toLowerCase()

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const num = (v: unknown) => (typeof v === 'number' ? v : Number(str(v).replace(/,/g, '')) || 0)

/**
 * Test source: a Zoho BOQ_Summary export held in memory for this session only.
 * It stands in for Zoho Creator until the live connection is set up.
 */
export function boqFileSource(fileName: string, sheets: ReadSheet[], rules: PricingRules, products: Product[]): ZohoSource {
  const sheet = sheets.find((s) => (s.data[0] ?? []).map(str).includes('Proposal Reference'))
  if (!sheet) throw new Error('This is not a Zoho BOQ_Summary export. It needs a "Proposal Reference" column.')
  const rows = records(sheet)
  const byCode = new Map(products.map((p) => [str(p.oryxCode).replace(/\s+/g, ' '), p]))

  const proposalsOf = (deal: string) => {
    const map = new Map<string, ProposalSummary>()
    for (const r of rows) {
      if (str(r['Deal Name']) !== deal) continue
      const reference = str(r['Proposal Reference'])
      const p = map.get(reference) ?? { reference, ...parseReference(reference), dealName: deal, zohoId: str(r['ID']), status: str(r['Quote Status']), lineCount: 0, total: 0 }
      p.lineCount++
      p.total += num(r['Amount (AED)'])
      map.set(reference, p)
    }
    return [...map.values()].sort((a, b) => b.revision - a.revision)
  }

  return {
    label: `Test data: ${fileName}`,
    live: false,
    async searchDeals(query) {
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
      const names = [...new Set(rows.map((r) => str(r['Deal Name'])).filter(Boolean))]
      return names.filter((n) => terms.every((t) => n.toLowerCase().includes(t))).map((name) => ({ name }))
    },
    async proposals(dealName) {
      return proposalsOf(dealName)
    },
    async boq(proposal) {
      return rows
        .filter((r) => str(r['Proposal Reference']) === proposal.reference)
        .map((r, i): RevisionLine => {
          const { item } = boqRowToItem(r, rules, byCode)
          const qty = Math.round(num(r['Quantity']))
          const amount = num(r['Amount (AED)'])
          const snap = snapshot({
            ref: item.ref, location: item.location, description: str(r['Type of Frame']), productId: item.productId,
            widthMm: item.widthMm, heightMm: item.heightMm, panels: item.panels, qty,
            rate: qty ? amount / qty : 0,
          })
          // A line Zoho priced from the salesperson price has no engine inputs that reproduce it.
          const reproducible = qty > 0 && calculateLineItem(item, rules).amount === amount
          return {
            id: `zoho-${str(r['ID (3)']) || `${proposal.reference}-${i}`}`,
            zohoId: str(r['ID (3)']) || undefined,
            status: 'original',
            original: snap,
            current: { ...snap },
            input: qty > 0 ? { ...item, qty } : undefined,
            ...(qty > 0 && !reproducible ? { priceNote: 'salesperson' as const } : {}),
          }
        })
        .sort((a, b) => a.current.ref.localeCompare(b.current.ref, 'en', { numeric: true }))
    },
  }
}
