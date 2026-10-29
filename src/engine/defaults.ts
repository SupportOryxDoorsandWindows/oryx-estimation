import type { LineItemInput, PricingRule, PricingRules, Product } from './types'

export function blankLineItem(): LineItemInput {
  return {
    productId: '',
    ruleId: 'other',
    ref: '',
    location: '',
    remarks: '',
    widthMm: 0,
    heightMm: 0,
    panels: 1,
    qty: 1,
    supplierPrice: 0,
    markup: 2.5,
    glassRate: 0,
    glassThicknessMm: 0,
    glazingSpec: '',
    bondingMode: 'amount',
    bondingRate: 0,
    bondingAmount: 0,
    freight: 0,
    otherCharges: 0,
    installation: 0,
    equipmentRental: 0,
    accessories: [],
    insuranceEnabled: false,
    dutiesPercent: 0,
    discountMode: 'amount',
    discountValue: 0,
    marginChange: 1,
    salespersonPrice: null,
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** Picks the SPEC §3 rule from the product's Business Unit (its origin); falls back to "other". */
export function matchRule(product: Product | undefined, rules: PricingRules): PricingRule {
  const other = rules.rules.find((r) => r.id === 'other') ?? rules.rules[rules.rules.length - 1]
  if (!product) return other
  const origin = norm(product.businessUnit)
  const text = norm(`${product.name} ${product.productCode} ${product.type}`)
  const candidates = rules.rules.filter((r) => r.fabricator && norm(r.fabricator) === origin)
  const byKeyword = candidates.find((r) => r.keywords.some((k) => text.includes(norm(k))))
  if (byKeyword) return byKeyword
  const noKeywords = candidates.find((r) => r.keywords.length === 0)
  return noKeywords ?? other
}

/** Applies a rule's defaults (markup, freight, other charges, bonding) to a line item. */
export function applyRuleDefaults(
  item: LineItemInput,
  rule: PricingRule,
  rules: PricingRules,
  product: Product | undefined,
): LineItemInput {
  const s = rules.settings
  const markup = rule.id === 'other' ? s.defaultMarkupOther : rule.markup
  const freight =
    rule.freight.type === 'perPanel'
      ? rule.freight.value * Math.max(1, item.panels)
      : rule.freight.type === 'fixed'
        ? rule.freight.value
        : item.freight
  const isCurtainWall = !!product && /curtain wall|\bc35\b/i.test(`${product.type} ${product.name}`)
  const bondingPerSqm = s.bondingDefault === 'curtainWallPerSqm' && isCurtainWall
  return {
    ...item,
    ruleId: rule.id,
    markup,
    freight,
    otherCharges: rule.otherCharges ?? item.otherCharges,
    bondingMode: bondingPerSqm ? 'perSqm' : 'amount',
    bondingRate: bondingPerSqm ? s.curtainWallBondingRate : item.bondingRate,
  }
}
