import type { LineItemInput, LineItemResult } from './types'

/**
 * Estimated project profitability (Project Profitability Summary).
 *
 * Reuses the line-item results of calculateLineItem; nothing is recalculated.
 * Selling price = the sum of the line amounts (after markup, dual colour,
 * margin change and discount, times quantity). The calculated rate is used,
 * never the salesperson price.
 *
 * Estimated cost = what the line costs Oryx before markup, times quantity:
 * profile cost (supplier price in AED, before markup) + glass + installation +
 * manpower + equipment rental + accessories + bonding + freight + positive
 * other charges + insurance + duties. Each figure is taken once from the
 * result. Markup, dual colour and margin change are not costs: they are what
 * Oryx earns. Negative other charges reduce the client price (they are a
 * reduction, not income), so they count only in the selling price.
 *
 * This is the ESTIMATED profitability of the proposal. It is kept apart from
 * any actual project costs.
 */

export const COST_CATEGORIES = [
  { key: 'profile', label: 'Profile and material' },
  { key: 'glass', label: 'Glass' },
  { key: 'installation', label: 'Installation' },
  { key: 'manpower', label: 'Manpower' },
  { key: 'equipment', label: 'Equipment rental' },
  { key: 'accessories', label: 'Accessories' },
  { key: 'other', label: 'Other additional charges' },
] as const

export type CostKey = (typeof COST_CATEGORIES)[number]['key']

/** The parts of "Other additional charges", shown under it. */
export const OTHER_PARTS = [
  { key: 'bonding', label: 'Bonding charges' },
  { key: 'freight', label: 'Freight' },
  { key: 'otherCharges', label: 'Other charges' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'duties', label: 'Duties' },
] as const

export type OtherKey = (typeof OTHER_PARTS)[number]['key']

export interface Profitability {
  /** Whole AED, the same figure as the Line items total. */
  sellingPrice: number
  /** Whole AED per category; they add up to totalCost exactly. */
  costs: Record<CostKey, number>
  otherParts: Record<OtherKey, number>
  totalCost: number
  profit: number
  /** Profit ÷ selling price × 100; null when there is no selling price. */
  marginPercent: number | null
  /** Price build-up, whole AED, all items × quantity. */
  markupAmount: number
  dualColour: number
  marginChangeAmount: number
  discount: number
  /** Markups used by the line items, lowest to highest (one value when they are all the same). */
  markups: number[]
  /** Other charges entered as negative amounts, shown as a reduction of the client price. */
  priceReductions: number
  itemCount: number
}

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function projectProfitability(items: LineItemInput[], results: LineItemResult[]): Profitability {
  const raw: Record<CostKey, number> = { profile: 0, glass: 0, installation: 0, manpower: 0, equipment: 0, accessories: 0, other: 0 }
  const other: Record<OtherKey, number> = { bonding: 0, freight: 0, otherCharges: 0, insurance: 0, duties: 0 }
  let selling = 0
  let markupAmount = 0
  let dualColour = 0
  let marginChangeAmount = 0
  let discount = 0
  let priceReductions = 0
  const markups = new Set<number>()

  items.forEach((item, i) => {
    const r = results[i]
    if (!r) return
    const qty = Math.max(0, n(item.qty))
    selling += n(r.amount)
    // Profile cost is the only unrounded figure in the result: whole AED per unit, like every other component.
    const profileCost = Math.round(n(r.profileCost))
    raw.profile += profileCost * qty
    raw.glass += n(r.glassCost) * qty
    raw.installation += n(r.installation) * qty
    raw.manpower += n(r.manpower) * qty
    raw.equipment += n(r.equipmentRental) * qty
    raw.accessories += n(r.accessories) * qty
    other.bonding += n(r.bonding) * qty
    other.freight += n(r.freight) * qty
    other.otherCharges += Math.max(0, n(r.otherCharges)) * qty
    other.insurance += n(r.insurance) * qty
    other.duties += n(r.duties) * qty
    priceReductions += Math.min(0, n(r.otherCharges)) * qty * -1
    markupAmount += (n(r.profilePrice) - profileCost) * qty
    dualColour += n(r.dualColour) * qty
    marginChangeAmount += (n(r.subtotalAfterMargin) - n(r.subtotal)) * qty
    discount += n(r.discountAmount) * qty
    if (n(item.markup) > 0) markups.add(n(item.markup))
  })

  // Whole AED, rounded once per figure, so the categories add up to the total on screen and in Excel.
  const whole = (v: number) => Math.round(v)
  const otherParts = Object.fromEntries(Object.entries(other).map(([k, v]) => [k, whole(v)])) as Record<OtherKey, number>
  raw.other = Object.values(otherParts).reduce((t, v) => t + v, 0)
  const costs = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, k === 'other' ? v : whole(v)])) as Record<CostKey, number>
  const totalCost = Object.values(costs).reduce((t, v) => t + v, 0)
  const sellingPrice = whole(selling)
  const profit = sellingPrice - totalCost
  const marginPercent = sellingPrice > 0 ? (profit / sellingPrice) * 100 : null

  return {
    sellingPrice, costs, otherParts, totalCost, profit, marginPercent,
    markupAmount: whole(markupAmount), dualColour: whole(dualColour), marginChangeAmount: whole(marginChangeAmount),
    discount: whole(discount), markups: [...markups].sort((a, b) => a - b), priceReductions: whole(priceReductions),
    itemCount: items.length,
  }
}

/** "2.85" or "2.5 – 2.85" for the markups in use; "—" when there are none. */
export function markupLabel(markups: number[]): string {
  if (!markups.length) return '—'
  const f = (m: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 }).format(m)
  return markups.length === 1 ? `× ${f(markups[0])}` : `× ${f(markups[0])} – ${f(markups[markups.length - 1])}`
}

/** "34.5%" (one decimal) or "—" when there is no selling price. */
export function marginLabel(p: number | null): string {
  return p === null ? '—' : `${new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p)}%`
}
