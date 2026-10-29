import { describe, expect, it } from 'vitest'
import productsJson from '../../data/products.json'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from './calculate'
import { applyRuleDefaults, blankLineItem, matchRule } from './defaults'
import type { PricingRules, Product } from './types'

const rules = rulesJson as PricingRules
const products = productsJson.products as Product[]

// Worked examples from reference/PRICING-FORMULAS.xlsx. Excel keeps decimals in the final
// price (e.g. 23,312.5); the app floors each component, so the expected rate is floor(Excel).
const examples = [
  { name: 'Series 1', rule: 'fusion-a', w: 3000, h: 2500, price: 1050, glass: 450, panels: 1, excel: 23312.5 },
  { name: 'Series 2', rule: 'fusion-b', w: 3000, h: 2500, price: 1200, glass: 450, panels: 1, excel: 29275 },
  { name: 'Series 3', rule: 'fusion-b', w: 3000, h: 2500, price: 1400, glass: 450, panels: 1, excel: 33550 },
  { name: 'B3800 Folding', rule: 'fusion-b', w: 3200, h: 2400, price: 1050, glass: 450, panels: 1, excel: 26688.4 },
  { name: 'B3710 Folding', rule: 'fusion-a', w: 3500, h: 4000, price: 1200, glass: 1500, panels: 1, excel: 63250 },
  { name: 'F44 Fixed', rule: 'fusion-a', w: 1000, h: 1500, price: 600, glass: 450, panels: 1, excel: 3175 },
  { name: 'C35 Curtain Wall', rule: 'fusion-a', w: 2000, h: 2200, price: 800, glass: 450, panels: 1, excel: 11030 },
  { name: 'Origin single door', rule: 'origin', w: 1000, h: 2500, price: 560, glass: 450, panels: 1, excel: 10605 },
  { name: 'Origin folding, 3 panels', rule: 'origin', w: 3000, h: 2600, price: 1700, glass: 450, panels: 3, excel: 32235 },
  { name: 'Hyline sliding', rule: 'hyline', w: 4000, h: 2400, price: 2200, glass: 800, panels: 1, excel: 36440 },
  { name: 'OTIF (no glass line)', rule: 'otif', w: 3200, h: 2500, price: 1800, glass: 0, panels: 1, excel: 22262.72 },
]

describe('PRICING-FORMULAS.xlsx examples', () => {
  for (const ex of examples) {
    it(`${ex.name} = floor(${ex.excel})`, () => {
      const rule = rules.rules.find((r) => r.id === ex.rule)!
      const base = { ...blankLineItem(), widthMm: ex.w, heightMm: ex.h, panels: ex.panels, supplierPrice: ex.price, glassRate: ex.glass }
      const item = { ...applyRuleDefaults(base, rule, rules, undefined), bondingMode: 'amount' as const, bondingAmount: 0 }
      expect(calculateLineItem(item, rules).rate).toBe(Math.floor(ex.excel))
    })
  }
})

describe('product list', () => {
  it('holds all 269 Zoho products, 190 with no Standard Pricing', () => {
    expect(products).toHaveLength(269)
    expect(products.filter((p) => !p.standardPricing)).toHaveLength(190)
    expect(new Set(products.map((p) => p.id)).size).toBe(269)
  })

  it('matches rules on Business Unit, ignoring case', () => {
    const find = (code: string) => products.find((p) => p.oryxCode === code)
    expect(matchRule(find('Insulux-Fusion-C35 Reinforced-Curtain Wall'), rules).id).toBe('fusion-a')
    for (const bu of ['Origin', 'Hyline', 'Otif', 'Inotherm', 'Kobbe']) {
      const p = products.find((x) => x.businessUnit === bu)
      expect(matchRule(p, rules).id).toBe(bu.toLowerCase())
    }
    expect(matchRule(products.find((p) => p.businessUnit === 'Renson'), rules).id).toBe('other')
  })
})
