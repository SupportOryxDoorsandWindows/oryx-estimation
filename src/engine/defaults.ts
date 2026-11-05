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
    priceSource: 'entered',
    doorPricing: null,
    markup: 2.85,
    glassRate: 0,
    glassThicknessMm: 32,
    glazingSpec: '',
    glassType: '',
    dualColour: false,
    bondingMode: 'amount',
    bondingRate: 0,
    bondingAmount: 0,
    freight: 0,
    otherCharges: 0,
    installation: 0,
    manpower: 0,
    manpowerManual: false,
    equipmentRental: 0,
    costComments: '',
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

/** Door products (type or name contains "door") can be priced from the door price chart. */
export const isDoorProduct = (p: Product | undefined) => !!p && /door/i.test(`${p.type} ${p.name}`)

/**
 * Applies a rule's defaults (markup, freight, other charges) to a line item.
 * A door priced in AED (AED/m² or manual) takes its supplier price from the door price chart;
 * doors quoted in GBP or EUR keep their supplier quote.
 */
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
  return {
    ...item,
    ruleId: rule.id,
    markup,
    freight,
    otherCharges: rule.otherCharges ?? item.otherCharges,
    priceSource: isDoorProduct(product) && (rule.costMethod === 'aedPerSqm' || rule.costMethod === 'manual') ? 'doorChart' : 'entered',
    doorPricing: null,
    // Bonding charges are entered as a plain amount; there is no automatic curtain-wall rate (4 Nov 2026).
  }
}
