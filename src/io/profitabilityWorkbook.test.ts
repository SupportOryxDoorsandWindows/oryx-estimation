import { describe, expect, it } from 'vitest'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from '../engine/calculate'
import { blankLineItem } from '../engine/defaults'
import { projectProfitability } from '../engine/profitability'
import type { LineItemInput, PricingRules } from '../engine/types'
import { buildProfitabilityWorkbook } from './profitabilityWorkbook'

const rules = rulesJson as PricingRules
const item = (over: Partial<LineItemInput> = {}): LineItemInput => ({
  ...blankLineItem(), ruleId: 'fusion-a', ref: 'CW01.1', widthMm: 4789, heightMm: 3366, panels: 8, qty: 1,
  supplierPrice: 800, markup: 2.5, glassRate: 450, bondingMode: 'amount', bondingAmount: 16120, otherCharges: -5387, ...over,
})

describe('profitability workbook', () => {
  const items = [item({ installation: 2500, manpower: 1000 }), item({ ref: 'W02', qty: 2, markup: 2.85, discountMode: 'percent', discountValue: 5 })]
  const p = projectProfitability(items, items.map((i) => calculateLineItem(i, rules)))
  const [summary, lines] = buildProfitabilityWorkbook({
    name: 'Villa test', details: { projectName: 'Villa 12', proposalNumber: 'P-TEST-1' }, items, rules, products: [], exportedOn: '5 Nov 2026',
  })
  const value = (label: string) => summary.data.find((r) => r[0] === label)?.[1]

  it('carries the project and proposal', () => {
    expect(value('Project name')).toBe('Villa 12')
    expect(value('Proposal number')).toBe('P-TEST-1')
  })

  it('has the same figures as the screen', () => {
    expect(value('Selling price (AED)')).toBe(p.sellingPrice)
    expect(value('Total estimated cost (AED)')).toBe(p.totalCost)
    expect(value('Estimated profit (AED)')).toBe(p.profit)
    expect(value('Installation')).toBe(2500)
    expect(value('Manpower')).toBe(1000)
    expect(value('Discounts')).toBe(-p.discount)
    expect(value('Markup')).toBe('× 2.5 – 2.85')
    expect(String(value('Profit margin'))).toMatch(/^\d+\.\d%$/)
  })

  it('line rows add up to the totals row', () => {
    const body = lines.data.slice(1, -1)
    const totals = lines.data.at(-1)!
    const col = lines.data[0].indexOf('Total estimated cost (AED)')
    expect(body.reduce((t, r) => t + (r[col] as number), 0)).toBe(totals[col])
    expect(totals[col]).toBe(p.totalCost)
  })
})
