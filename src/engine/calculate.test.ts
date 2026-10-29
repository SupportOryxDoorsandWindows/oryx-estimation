import { describe, expect, it } from 'vitest'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from './calculate'
import { blankLineItem } from './defaults'
import type { LineItemInput, PricingRules } from './types'

const rules = rulesJson as PricingRules

// Proposal P268194R3, item CW01.1 (SPEC.md §2 golden test).
function cw011(): LineItemInput {
  return {
    ...blankLineItem(),
    productId: 'insulux-fusion-c35-reinforced',
    ruleId: 'fusion-a',
    ref: 'CW01.1',
    widthMm: 4789,
    heightMm: 3366,
    panels: 8,
    qty: 1,
    supplierPrice: 800,
    markup: 2.5,
    glassRate: 450,
    glassThicknessMm: 16,
    bondingMode: 'amount',
    bondingAmount: 16120,
    otherCharges: -5387,
  }
}

describe('CW01.1 golden test', () => {
  const r = calculateLineItem(cw011(), rules)

  it('matches every expected output', () => {
    expect(r.area).toBeCloseTo(16.119774, 6)
    expect(r.profilePrice).toBe(32239)
    expect(r.glassCost).toBe(7253)
    expect(r.glassWeightKg).toBe(80)
    expect(r.rate).toBe(50225)
    expect(r.amount).toBe(50225)
  })

  it('gives 50,227 with Excel-style round', () => {
    const roundRules = { ...rules, settings: { ...rules.settings, rounding: 'round' as const } }
    expect(calculateLineItem(cw011(), roundRules).rate).toBe(50227)
  })

  it('warns that other charges are negative', () => {
    expect(r.warnings.some((w) => w.includes('Other charges'))).toBe(true)
  })

  it('shows a formula for every step', () => {
    for (const s of r.steps) expect(s.formula.length).toBeGreaterThan(0)
  })
})

describe('engine rules', () => {
  const base = cw011()

  it('multiplies the rate by qty for the amount', () => {
    expect(calculateLineItem({ ...base, qty: 3 }, rules).amount).toBe(50225 * 3)
  })

  it('converts the discount both ways', () => {
    const pct = calculateLineItem({ ...base, discountMode: 'percent', discountValue: 10 }, rules)
    expect(pct.discountAmount).toBe(Math.floor(pct.subtotalAfterMargin * 0.1))
    const amt = calculateLineItem({ ...base, discountMode: 'amount', discountValue: 5000 }, rules)
    expect(amt.discountPercent).toBeCloseTo((5000 / amt.subtotalAfterMargin) * 100, 6)
    expect(amt.rate).toBe(50225 - 5000)
  })

  it('applies the margin change before the discount', () => {
    expect(calculateLineItem({ ...base, marginChange: 1.1 }, rules).rate).toBe(Math.floor(50225 * 1.1))
  })

  it('converts GBP for Origin and EUR with the Inotherm discount', () => {
    const origin = calculateLineItem({ ...base, ruleId: 'origin', supplierPrice: 1000, markup: 2.85 }, rules)
    expect(origin.profileCost).toBe(5000)
    const ino = calculateLineItem({ ...base, ruleId: 'inotherm', supplierPrice: 1000, markup: 2.85 }, rules)
    expect(ino.profileCost).toBeCloseTo(1000 * 0.55 * 4.32, 6)
  })

  it('drops the glass line for OTIF', () => {
    expect(calculateLineItem({ ...base, ruleId: 'otif' }, rules).glassCost).toBe(0)
  })

  it('never lets the salesperson price change the rate', () => {
    expect(calculateLineItem({ ...base, salespersonPrice: 40000 }, rules).rate).toBe(50225)
  })

  it('adds insurance at 1% of the subtotal when enabled', () => {
    const r = calculateLineItem({ ...base, insuranceEnabled: true }, rules)
    expect(r.insurance).toBe(Math.floor(50225 * 0.01))
  })
})
