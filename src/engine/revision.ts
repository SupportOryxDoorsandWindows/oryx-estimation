// Revision and variation management (Phase 2 plan §4–5).
// Pure functions: every action returns a new draft and records itself in the history.
// The original accepted proposal is never changed; each line keeps its original snapshot.
import { calculateLineItem } from './calculate'
import type { LineItemInput, PricingRules } from './types'

export type LineStatus = 'original' | 'cancelled' | 'additional' | 'replaced' | 'replacement' | 'sizeRevised'

export const STATUS_LABEL: Record<LineStatus, string> = {
  original: 'Original',
  cancelled: 'Cancelled Item',
  additional: 'Additional Item',
  replaced: 'Replaced Item',
  replacement: 'Item Replacement',
  sizeRevised: 'Size Revision',
}

/** What a BOQ line looks like at one point in time. */
export interface LineSnapshot {
  ref: string
  location: string
  description: string
  productId: string
  widthMm: number
  heightMm: number
  panels: number
  qty: number
  /** Unit rate, AED. */
  rate: number
  /** rate × qty, AED. */
  amount: number
}

export interface RevisionLine {
  id: string
  /** Zoho BOQ record ID, for lines that came from the accepted proposal. */
  zohoId?: string
  status: LineStatus
  /** As accepted. Absent for lines added in this revision. */
  original?: LineSnapshot
  current: LineSnapshot
  /** Pricing inputs, used when a size revision recalculates the price. */
  input?: LineItemInput
  replacesId?: string
  replacedById?: string
  sizeMode?: 'withPrice' | 'withoutPrice'
  /** 'salesperson': Zoho's agreed rate came from a salesperson price, not the pricing engine. */
  priceNote?: 'salesperson'
}

export interface HistoryEntry {
  at: string
  action: 'cancel' | 'add' | 'replace' | 'sizeRevision' | 'undo'
  lineId: string
  text: string
}

export interface ProposalRef {
  /** e.g. P000123R5 */
  reference: string
  base: string
  revision: number
  dealName: string
  zohoId?: string
}

export interface RevisionDraft {
  source: ProposalRef
  /** The revision being prepared, e.g. 6 for P000123R6. */
  revision: number
  reference: string
  lines: RevisionLine[]
  history: HistoryEntry[]
}

const REF = /^(P\d+)R(\d+)$/i

export function parseReference(reference: string): { base: string; revision: number } {
  const m = reference.trim().match(REF)
  return m ? { base: m[1].toUpperCase(), revision: Number(m[2]) } : { base: reference.trim(), revision: 0 }
}

/** Starts a revision from an accepted proposal. `takenRevisions` are revision numbers already used for the deal. */
export function startRevision(source: ProposalRef, lines: RevisionLine[], takenRevisions: number[] = []): RevisionDraft {
  const revision = Math.max(source.revision, ...takenRevisions) + 1
  return { source, revision, reference: `${source.base}R${revision}`, lines, history: [] }
}

const now = () => new Date().toISOString()
const fmt = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(n)
const size = (s: LineSnapshot) => `${fmt(s.widthMm)} × ${fmt(s.heightMm)}`
const label = (l: RevisionLine) => l.current.ref || l.id

function log(d: RevisionDraft, action: HistoryEntry['action'], lineId: string, text: string): HistoryEntry[] {
  return [...d.history, { at: now(), action, lineId, text }]
}

function update(d: RevisionDraft, id: string, fn: (l: RevisionLine) => RevisionLine): RevisionLine[] {
  return d.lines.map((l) => (l.id === id ? fn(l) : l))
}

function find(d: RevisionDraft, id: string): RevisionLine {
  const l = d.lines.find((x) => x.id === id)
  if (!l) throw new Error(`No line ${id}`)
  return l
}

/** Lines from the accepted proposal that have not been cancelled or replaced. */
export const canRevise = (l: RevisionLine) => l.status === 'original' || l.status === 'sizeRevised'

/** §4.1 Quantity and value become zero; the line stays, marked Cancelled Item. */
export function cancelItem(d: RevisionDraft, id: string): RevisionDraft {
  const line = find(d, id)
  if (!canRevise(line)) throw new Error(`${label(line)} is ${STATUS_LABEL[line.status]} and cannot be cancelled`)
  return {
    ...d,
    lines: update(d, id, (l) => ({ ...l, status: 'cancelled', sizeMode: undefined, current: { ...l.original!, qty: 0, amount: 0 } })),
    history: log(d, 'cancel', id, `Cancelled ${label(line)}: qty ${line.current.qty} → 0, AED ${fmt(line.current.amount)} → 0`),
  }
}

let seq = 0
const newId = () => `new-${Date.now().toString(36)}-${(seq++).toString(36)}`

export function snapshot(s: Omit<LineSnapshot, 'amount'>): LineSnapshot {
  return { ...s, amount: s.rate * s.qty }
}

/** §4.2 A new BOQ line, marked Additional Item. */
export function addItem(d: RevisionDraft, item: Omit<LineSnapshot, 'amount'>, input?: LineItemInput): RevisionDraft {
  const line: RevisionLine = { id: newId(), status: 'additional', current: snapshot(item), input }
  return {
    ...d,
    lines: [...d.lines, line],
    history: log(d, 'add', line.id, `Added ${line.current.ref || 'item'}: ${size(line.current)} mm, qty ${line.current.qty}, AED ${fmt(line.current.amount)}`),
  }
}

/** §4.3 The original becomes Replaced Item (qty and value 0); the new line is Item Replacement, linked both ways. */
export function replaceItem(d: RevisionDraft, id: string, item: Omit<LineSnapshot, 'amount'>, input?: LineItemInput): RevisionDraft {
  const old = find(d, id)
  if (!canRevise(old)) throw new Error(`${label(old)} is ${STATUS_LABEL[old.status]} and cannot be replaced`)
  const repl: RevisionLine = { id: newId(), status: 'replacement', current: snapshot(item), input, replacesId: id }
  const lines = update(d, id, (l) => ({ ...l, status: 'replaced', sizeMode: undefined, replacedById: repl.id, current: { ...l.original!, qty: 0, amount: 0 } }))
  const at = lines.findIndex((l) => l.id === id)
  return {
    ...d,
    lines: [...lines.slice(0, at + 1), repl, ...lines.slice(at + 1)],
    history: log(d, 'replace', id, `Replaced ${label(old)} (AED ${fmt(old.current.amount)}) with ${repl.current.ref || 'new item'}: ${size(repl.current)} mm, qty ${repl.current.qty}, AED ${fmt(repl.current.amount)}`),
  }
}

/** The rate for a line at a new size, from the pricing engine. */
export function recalculatedRate(line: RevisionLine, widthMm: number, heightMm: number, rules: PricingRules): number | null {
  if (!line.input) return null
  return calculateLineItem({ ...line.input, widthMm, heightMm, salespersonPrice: null }, rules).rate
}

/** §4.4 New dimensions; with price change the rate is recalculated, without it the agreed rate and amount stay. */
export function sizeRevision(
  d: RevisionDraft, id: string, widthMm: number, heightMm: number, mode: 'withPrice' | 'withoutPrice', rules: PricingRules,
): RevisionDraft {
  const line = find(d, id)
  if (!canRevise(line)) throw new Error(`${label(line)} is ${STATUS_LABEL[line.status]} and cannot be resized`)
  const base = line.original!
  let rate = base.rate
  if (mode === 'withPrice') {
    const r = recalculatedRate(line, widthMm, heightMm, rules)
    if (r === null) throw new Error(`${label(line)} has no pricing inputs, so its price cannot be recalculated`)
    rate = r
  }
  const current = { ...base, widthMm, heightMm, rate, amount: rate * base.qty }
  return {
    ...d,
    lines: update(d, id, (l) => ({ ...l, status: 'sizeRevised', sizeMode: mode, current })),
    history: log(d, 'sizeRevision', id,
      `Size revision ${mode === 'withPrice' ? 'with' : 'without'} price change on ${label(line)}: ${size(base)} → ${size(current)} mm` +
      (mode === 'withPrice' ? `, AED ${fmt(base.amount)} → ${fmt(current.amount)}` : `, AED ${fmt(base.amount)} kept`)),
  }
}

/** Puts an original line back as accepted, or removes a line added in this revision (and frees what it replaced). */
export function undoLine(d: RevisionDraft, id: string): RevisionDraft {
  const line = find(d, id)
  if (line.status === 'original') return d
  if (!line.original) {
    // Added in this revision: remove it, and restore the item it replaced.
    const lines = d.lines
      .filter((l) => l.id !== id)
      .map((l) => (l.id === line.replacesId ? { ...l, status: 'original' as const, replacedById: undefined, current: { ...l.original! } } : l))
    return { ...d, lines, history: log(d, 'undo', id, `Removed ${STATUS_LABEL[line.status].toLowerCase()} ${label(line)}`) }
  }
  // An original: restore it, and drop its replacement if it had one.
  const lines = d.lines
    .filter((l) => l.id !== line.replacedById)
    .map((l) => (l.id === id ? { ...l, status: 'original' as const, sizeMode: undefined, replacedById: undefined, current: { ...l.original! } } : l))
  return { ...d, lines, history: log(d, 'undo', id, `Restored ${label(line)} as accepted`) }
}

export interface RevisionTotals {
  original: number
  revised: number
  variation: number
  counts: Record<LineStatus, number>
}

export function totals(d: RevisionDraft): RevisionTotals {
  const counts = { original: 0, cancelled: 0, additional: 0, replaced: 0, replacement: 0, sizeRevised: 0 } as Record<LineStatus, number>
  let original = 0
  let revised = 0
  for (const l of d.lines) {
    counts[l.status]++
    original += l.original?.amount ?? 0
    revised += l.current.amount
  }
  return { original, revised, variation: revised - original, counts }
}
