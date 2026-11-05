import { describe, expect, it } from 'vitest'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from './calculate'
import { blankLineItem } from './defaults'
import { marginLabel, markupLabel, projectProfitability } from './profitability'
import type { LineItemInput, PricingRules } from './types'

const rules = rulesJson as PricingRules

function cw011(): LineItemInput {
  return {
    ...blankLineItem(), ruleId: 'fusion-a', ref: 'CW01.1', widthMm: 4789, heightMm: 3366, panels: 8, qty: 1,
    supplierPrice: 800, markup: 2.5, glassRate: 450, glassThicknessMm: 16, bondingMode: 'amount', bondingAmount: 16120, otherCharges: -5387,
  }
}
const run = (items: LineItemInput[]) => projectProfitability(items, items.map((i) => calculateLineItem(i, rules)))

describe('project profitability', () => {
  it('CW01.1: selling price is the line amount, cost is before markup', () => {
    const p = run([cw011()])
    expect(p.sellingPrice).toBe(50225)
    expect(p.costs.profile).toBe(12896) // 16.119774 m² × 800, before markup
    expect(p.costs.glass).toBe(7253)
    expect(p.otherParts.bonding).toBe(16120)
    expect(p.otherParts.otherCharges).toBe(0) // negative other charges are a price reduction, not income
    expect(p.priceReductions).toBe(5387)
    expect(p.totalCost).toBe(12896 + 7253 + 16120)
    expect(p.profit).toBe(50225 - 36269)
    expect(p.marginPercent).toBeCloseTo((13956 / 50225) * 100, 6)
    expect(p.markupAmount).toBe(32239 - 12896)
    expect(p.markups).toEqual([2.5])
  })

  it('categories add up to the total cost', () => {
    const p = run([{ ...cw011(), installation: 3000, manpower: 1200, equipmentRental: 800, freight: 500, otherCharges: 250,
      accessories: [{ description: 'Handle', cost: 120 }] }])
    expect(Object.values(p.costs).reduce((t, v) => t + v, 0)).toBe(p.totalCost)
    expect(p.costs.other).toBe(16120 + 500 + 250)
    expect(p.costs.installation).toBe(3000)
    expect(p.costs.manpower).toBe(1200)
    expect(p.costs.equipment).toBe(800)
    expect(p.costs.accessories).toBe(120)
    expect(p.profit).toBe(p.sellingPrice - p.totalCost)
  })

  it('installation and manpower raise cost and price by the same amount', () => {
    const a = run([cw011()])
    const b = run([{ ...cw011(), installation: 2000, manpower: 1000 }])
    expect(b.totalCost - a.totalCost).toBe(3000)
    expect(b.sellingPrice - a.sellingPrice).toBe(3000)
    expect(b.profit).toBe(a.profit)
  })

  it('markup, dual colour and discount move the profit, not the cost', () => {
    const a = run([cw011()])
    const markup = run([{ ...cw011(), markup: 2.85 }])
    expect(markup.totalCost).toBe(a.totalCost)
    expect(markup.profit).toBeGreaterThan(a.profit)
    const dual = run([{ ...cw011(), dualColour: true }])
    expect(dual.totalCost).toBe(a.totalCost)
    expect(dual.dualColour).toBe(Math.floor(32239 * 0.1))
    expect(dual.profit - a.profit).toBe(dual.dualColour)
    const pct = run([{ ...cw011(), discountMode: 'percent', discountValue: 10 }])
    expect(pct.discount).toBe(Math.floor(50225 * 0.1))
    expect(a.profit - pct.profit).toBe(pct.discount)
    const fixed = run([{ ...cw011(), discountMode: 'amount', discountValue: 1000 }])
    expect(a.profit - fixed.profit).toBe(1000)
  })

  it('multiplies costs by quantity and adds up several items', () => {
    const one = run([cw011()])
    const p = run([{ ...cw011(), qty: 2 }, { ...cw011(), markup: 2.85 }])
    expect(p.sellingPrice).toBe(50225 * 2 + calculateLineItem({ ...cw011(), markup: 2.85 }, rules).amount)
    expect(p.totalCost).toBe(one.totalCost * 3)
    expect(p.markups).toEqual([2.5, 2.85])
    expect(markupLabel(p.markups)).toBe('× 2.5 – 2.85')
  })

  it('price build-up adds back to the selling price', () => {
    for (const item of [cw011(), { ...cw011(), qty: 3, dualColour: true, marginChange: 1.1, discountMode: 'percent' as const, discountValue: 5, installation: 900 }]) {
      const p = run([item])
      expect(p.totalCost + p.markupAmount + p.dualColour + p.marginChangeAmount - p.discount - p.priceReductions).toBe(p.sellingPrice)
    }
  })

  it('never uses the salesperson price', () => {
    expect(run([{ ...cw011(), salespersonPrice: 40000 }]).sellingPrice).toBe(50225)
  })

  it('handles an empty estimate safely', () => {
    const p = run([blankLineItem()])
    expect(p.sellingPrice).toBe(0)
    expect(p.totalCost).toBe(0)
    expect(p.profit).toBe(0)
    expect(p.marginPercent).toBeNull()
    expect(marginLabel(p.marginPercent)).toBe('—')
    expect(run([]).itemCount).toBe(0)
  })

  it('ignores missing values instead of showing NaN', () => {
    const odd = { ...cw011(), installation: undefined as unknown as number, manpower: Number.NaN }
    const p = projectProfitability([odd], [{ ...calculateLineItem(cw011(), rules), installation: Number.NaN }])
    expect(Number.isFinite(p.totalCost)).toBe(true)
    expect(Number.isFinite(p.profit)).toBe(true)
  })
})
