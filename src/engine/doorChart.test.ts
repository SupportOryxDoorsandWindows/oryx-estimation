import { describe, expect, it } from 'vitest'
import productsJson from '../../data/products.json'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from './calculate'
import { applyRuleDefaults, blankLineItem, matchRule } from './defaults'
import { chartSizes, doorRate } from './doorChart'
import type { PricingRules, Product } from './types'

const rules = rulesJson as PricingRules
const chart = rules.doorChart

// Values computed by Single_Door_Order_Estimator.xlsx.
describe('Door price chart (Single Door Order Estimator)', () => {
  it('matches the Price Lookup tab: 950 × 2750 = 1,473.7225', () => {
    const r = doorRate(950, 2750, chart)
    expect(r.rate).toBeCloseTo(1473.7225, 6)
    expect([r.widthLow, r.widthHigh, r.heightLow, r.heightHigh]).toEqual([800, 1000, 2500, 3000])
    expect([r.widthFactor, r.heightFactor]).toEqual([0.75, 0.5])
  })

  it.each([
    [500, 1800, 2846.34], [700, 1800, 2229], [1100, 1900, 1601.4628571428573],
    [1000, 2000, 1653.4428571428573], [1200, 2000, 1485.2285714285715], [600, 1900, 2477.3461904761907],
  ])('matches the SQM Price Chart tab at %i × %i', (w, h, expected) => {
    expect(doorRate(w, h, chart).rate).toBeCloseTo(expected, 9)
  })

  it('uses the costed rate at the top corner (1200 × 4000)', () => {
    expect(doorRate(1200, 4000, chart).rate).toBe(1208.69)
  })

  it('is out of range outside 500–1200 × 1800–4000', () => {
    expect(doorRate(1300, 2000, chart)).toMatchObject({ inRange: false, rate: 0 })
    expect(doorRate(1000, 1700, chart).inRange).toBe(false)
  })

  it('applies the markup on base rate', () => {
    expect(doorRate(950, 2750, { ...chart, markupOnBase: 0.1 }).rate).toBeCloseTo(1473.7225 * 1.1, 6)
  })

  it('lists chart sizes in 100 mm steps', () => {
    const s = chartSizes(chart)
    expect(s.widths).toEqual([500, 600, 700, 800, 900, 1000, 1100, 1200])
    expect(s.heights).toHaveLength(23)
  })

  it('feeds the estimate as the AED/m² supplier price', () => {
    const item = { ...blankLineItem(), manpowerManual: true, ruleId: 'fusion-a', priceSource: 'doorChart' as const, widthMm: 1000, heightMm: 2000, markup: 2.5, supplierPrice: 1 }
    const r = calculateLineItem(item, rules)
    expect(r.profileCost).toBeCloseTo(2 * 1653.4428571428573, 9) // Order Estimator line 1: unit price 3,306.89
    expect(r.profilePrice).toBe(Math.floor(2 * 1653.4428571428573 * 2.5))
    expect(r.steps.find((s) => s.key === 'doorRate')?.formula).toContain('1,000 × 2,000 mm')
  })

  it('warns and prices the profile at 0 when the size is out of range', () => {
    const r = calculateLineItem({ ...blankLineItem(), manpowerManual: true, priceSource: 'doorChart', widthMm: 1500, heightMm: 2000 }, rules)
    expect(r.profileCost).toBe(0)
    expect(r.warnings.join(' ')).toMatch(/outside the door price chart/)
  })
})

describe('Door chart: Profile reference and Pricing', () => {
  const base = { ...blankLineItem(), manpowerManual: true, ruleId: 'other', priceSource: 'doorChart' as const, widthMm: 1000, heightMm: 2000, markup: 2.85 }

  it('prices from the profile reference until Pricing is entered', () => {
    const r = calculateLineItem(base, rules)
    expect(r.profileCost).toBeCloseTo(2 * 1653.4428571428573, 9)
    expect(r.steps.find((s) => s.key === 'doorRate')?.label).toBe('Profile reference (AED/m²)')
    expect(r.steps.find((s) => s.key === 'doorPricing')).toBeUndefined()
  })

  it('uses the entered Pricing and keeps the reference in the workings', () => {
    const r = calculateLineItem({ ...base, doorPricing: 1800 }, rules)
    expect(r.profileCost).toBe(2 * 1800)
    expect(r.profilePrice).toBe(Math.floor(3600 * 2.85))
    expect(r.steps.find((s) => s.key === 'doorRate')?.value).toBeCloseTo(1653.4428571428573, 9)
    expect(r.steps.find((s) => s.key === 'doorPricing')).toMatchObject({ value: 1800, formula: 'Entered (profile reference 1,653)' })
  })

  it('ignores Pricing when the line is not on the door chart', () => {
    const r = calculateLineItem({ ...base, priceSource: 'entered', supplierPrice: 5000, doorPricing: 1800 }, rules)
    expect(r.profileCost).toBe(5000)
  })
})

describe('Door products use the door chart automatically', () => {
  const products = (productsJson as { products: Product[] }).products
  const pick = (code: string) => {
    const p = products.find((x) => x.oryxCode === code)!
    return applyRuleDefaults({ ...blankLineItem(), manpowerManual: true, productId: p.id }, matchRule(p, rules), rules, p)
  }

  it('switches an AED-priced door to the door chart', () => {
    expect(pick('Al Taqwa-Fusion-D50 Single Door (Arched)-Single Door').priceSource).toBe('doorChart')
  })

  it('keeps the supplier quote for a door quoted in GBP', () => {
    expect(pick('Origin-Origin-OB36+-Single Door').priceSource).toBe('entered')
  })

  it('does not use the door chart for windows or curtain walls', () => {
    expect(pick('Insulux-Fusion-C35 Reinforced-Curtain Wall').priceSource).toBe('entered')
  })
})
