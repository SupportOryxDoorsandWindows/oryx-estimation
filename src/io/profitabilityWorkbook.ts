import { calculateLineItem } from '../engine/calculate'
import {
  COST_CATEGORIES, OTHER_PARTS, marginLabel, markupLabel, projectProfitability, type Profitability,
} from '../engine/profitability'
import type { LineItemInput, PricingRules, Product } from '../engine/types'
import type { ProposalDetails } from '../ui/proposal'
import type { Cell, SheetRows } from './workbook'

const AED = '#,##0'

export interface ProfitabilityExport {
  name: string
  details: ProposalDetails
  items: LineItemInput[]
  rules: PricingRules
  products: Product[]
  /** Date shown on the sheet, e.g. "5 Nov 2026". */
  exportedOn: string
}

/** Project name for the sheet: Project Name, else Opportunity Name, else the estimate's name. */
export function projectNameOf(name: string, details: ProposalDetails): string {
  const d = details as Record<string, unknown>
  const pick = (k: string) => (typeof d[k] === 'string' ? (d[k] as string).trim() : '')
  return pick('projectName') || pick('dealName') || name
}

/**
 * The Project Profitability Summary as an Excel workbook. Every figure comes from
 * projectProfitability(), the same function the screen uses, so the two always match.
 */
export function buildProfitabilityWorkbook(x: ProfitabilityExport): SheetRows[] {
  const results = x.items.map((i) => calculateLineItem(i, x.rules))
  const p = projectProfitability(x.items, results)
  const d = x.details as Record<string, unknown>
  const text = (k: string) => (typeof d[k] === 'string' && (d[k] as string).trim() ? (d[k] as string).trim() : '—')

  const rows: Cell[][] = []
  const bold: number[] = []
  const add = (label: string, value: Cell = null, note: Cell = null, isBold = false) => {
    if (isBold) bold.push(rows.length)
    rows.push([label, value, note])
  }
  add('Project Profitability Summary (estimated)', null, null)
  add('Project name', projectNameOf(x.name, x.details))
  add('Proposal number', text('proposalNumber'))
  add('Proposal reference', text('proposalReference'))
  add('Line items', p.itemCount)
  add('Exported', x.exportedOn)
  add('')
  add('Selling price (AED)', p.sellingPrice, 'Charged to the client, after markup, dual colour, margin change and discounts', true)
  add('Total estimated cost (AED)', p.totalCost, 'Cost to Oryx before markup', true)
  add('Estimated profit (AED)', p.profit, 'Selling price − total estimated cost', true)
  add('Profit margin', marginLabel(p.marginPercent), 'Estimated profit ÷ selling price × 100', true)
  add('')
  add('Cost breakdown', 'AED', null, true)
  for (const c of COST_CATEGORIES) {
    add(c.label, p.costs[c.key])
    if (c.key === 'other') for (const o of OTHER_PARTS) if (p.otherParts[o.key]) add(`   ${o.label}`, p.otherParts[o.key])
  }
  add('Total estimated cost', p.totalCost, null, true)
  add('')
  add('Price build-up', 'AED', null, true)
  add('Markup', markupLabel(p.markups), 'Multiplier on the profile cost')
  add('Markup on profile', p.markupAmount)
  add('Dual colour', p.dualColour)
  add('Margin change', p.marginChangeAmount)
  add('Discounts', -p.discount)
  if (p.priceReductions) add('Negative other charges', -p.priceReductions, 'Reduce the client price; not counted as cost')
  add('')
  add('Estimated figures from this proposal. They are not the actual project costs.')

  const lineRows: Cell[][] = [[
    'Ref #', 'Location', 'Product', 'Qty', 'Markup', 'Selling price (AED)',
    ...COST_CATEGORIES.map((c) => `${c.label} (AED)`), 'Total estimated cost (AED)', 'Estimated profit (AED)', 'Profit margin',
  ]]
  x.items.forEach((item, i) => {
    const one: Profitability = projectProfitability([item], [results[i]])
    lineRows.push([
      item.ref || `Item ${i + 1}`, item.location || '', x.products.find((pr) => pr.id === item.productId)?.name ?? '',
      item.qty, item.markup, one.sellingPrice, ...COST_CATEGORIES.map((c) => one.costs[c.key]), one.totalCost, one.profit, marginLabel(one.marginPercent),
    ])
  })
  lineRows.push([
    'Total', '', '', null, markupLabel(p.markups), p.sellingPrice, ...COST_CATEGORIES.map((c) => p.costs[c.key]), p.totalCost, p.profit, marginLabel(p.marginPercent),
  ])

  return [
    { sheet: 'Profitability summary', data: rows, widths: [34, 18, 62], formats: [undefined, AED, undefined], boldRows: bold },
    {
      sheet: 'By line item', data: lineRows,
      widths: [12, 18, 36, 6, 8, 16, ...COST_CATEGORIES.map(() => 15), 16, 16, 12],
      formats: [undefined, undefined, undefined, undefined, undefined, AED, ...COST_CATEGORIES.map(() => AED), AED, AED, undefined],
      boldRows: [lineRows.length - 1],
    },
  ]
}
