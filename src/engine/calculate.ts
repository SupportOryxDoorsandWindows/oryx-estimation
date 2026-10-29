import { fmtAed, fmtNum } from './format'
import type { LineItemInput, LineItemResult, PricingRules, Step } from './types'

/** Pure line-item calculation per SPEC.md §2. Returns every figure with its formula. */
export function calculateLineItem(input: LineItemInput, rules: PricingRules): LineItemResult {
  const s = rules.settings
  const rule = rules.rules.find((r) => r.id === input.ruleId) ?? rules.rules[rules.rules.length - 1]
  const rnd = (n: number) => (s.rounding === 'round' ? Math.round(n) : Math.floor(n))
  const rLabel = s.rounding === 'round' ? 'round' : 'floor'
  const steps: Step[] = []
  const warnings: string[] = []
  const step = (key: string, label: string, value: number, formula: string) => {
    steps.push({ key, label, value, formula })
    return value
  }

  const area = step(
    'area', 'Area (m²)', (input.widthMm * input.heightMm) / 1_000_000,
    `${fmtNum(input.widthMm)} × ${fmtNum(input.heightMm)} ÷ 1,000,000`,
  )

  let profileCost: number
  let costFormula: string
  switch (rule.costMethod) {
    case 'aedPerSqm':
      profileCost = area * input.supplierPrice
      costFormula = `${fmtNum(area)} m² × ${fmtNum(input.supplierPrice)} AED/m²`
      break
    case 'gbp':
      profileCost = input.supplierPrice * s.gbpToAed
      costFormula = `GBP ${fmtNum(input.supplierPrice)} × ${fmtNum(s.gbpToAed)}`
      break
    case 'eur':
      profileCost = input.supplierPrice * s.eurToAed
      costFormula = `EUR ${fmtNum(input.supplierPrice)} × ${fmtNum(s.eurToAed)}`
      break
    case 'eurDiscounted':
      profileCost = input.supplierPrice * (1 - s.inothermDiscount) * s.eurToAed
      costFormula = `EUR ${fmtNum(input.supplierPrice)} × (1 − ${fmtNum(s.inothermDiscount)}) × ${fmtNum(s.eurToAed)}`
      break
    default:
      profileCost = input.supplierPrice
      costFormula = `Supplier quote AED ${fmtNum(input.supplierPrice)}`
  }
  step('profileCost', 'Profile cost (AED)', profileCost, costFormula)

  const profilePrice = step(
    'profilePrice', 'Profile price (AED)', rnd(profileCost * input.markup),
    `${rLabel}(${fmtNum(profileCost)} × ${fmtNum(input.markup)})`,
  )

  const glassCost = rule.glassLine
    ? step('glassCost', 'Glass cost (AED)', rnd(area * input.glassRate),
        `${rLabel}(${fmtNum(area)} m² × ${fmtNum(input.glassRate)} AED/m²)`)
    : step('glassCost', 'Glass cost (AED)', 0, `No glass line for ${rule.label}`)

  const glassWeightKg = step(
    'glassWeight', 'Glass weight per panel (kg)',
    rnd((area / Math.max(1, input.panels)) * input.glassThicknessMm * s.glassDensityKgPerSqmPerMm),
    `${rLabel}((${fmtNum(area)} ÷ ${input.panels}) × ${fmtNum(input.glassThicknessMm)} mm × ${fmtNum(s.glassDensityKgPerSqmPerMm)})`,
  )

  const bonding = input.bondingMode === 'perSqm'
    ? step('bonding', 'Bonding charges (AED)', rnd(area * input.bondingRate),
        `${rLabel}(${fmtNum(area)} m² × ${fmtNum(input.bondingRate)} AED/m²)`)
    : step('bonding', 'Bonding charges (AED)', rnd(input.bondingAmount), 'Entered amount')

  const freight = step('freight', 'Freight (AED)', rnd(input.freight), 'Entered amount')
  const otherCharges = step('otherCharges', 'Other charges (AED)', rnd(input.otherCharges), 'Entered amount')
  const accessories = step(
    'accessories', 'Accessories (AED)', rnd(input.accessories.reduce((t, a) => t + (a.cost || 0), 0)),
    input.accessories.length ? input.accessories.map((a) => fmtAed(a.cost)).join(' + ') : 'No accessories',
  )
  const installation = step('installation', 'Installation (AED)', rnd(input.installation), 'Entered amount')
  const equipmentRental = step('equipment', 'Equipment rental (AED)', rnd(input.equipmentRental), 'Entered amount')

  // SPEC §4.5: percentages use the subtotal before discount (excluding insurance and duties).
  const base = profilePrice + glassCost + bonding + freight + otherCharges + accessories + installation + equipmentRental
  const insurance = input.insuranceEnabled
    ? step('insurance', 'Insurance (AED)', rnd(base * s.insuranceRate),
        `${rLabel}(${fmtAed(base)} × ${fmtNum(s.insuranceRate * 100)}%)`)
    : step('insurance', 'Insurance (AED)', 0, 'Not applied')
  const duties = step(
    'duties', 'Duties (AED)', rnd((base * input.dutiesPercent) / 100),
    `${rLabel}(${fmtAed(base)} × ${fmtNum(input.dutiesPercent)}%)`,
  )

  const subtotal = step(
    'subtotal', 'Subtotal (AED)', base + insurance + duties,
    'Profile price + glass + bonding + freight + other + accessories + installation + equipment + insurance + duties',
  )
  const subtotalAfterMargin = step(
    'margin', 'After margin change (AED)', rnd(subtotal * input.marginChange),
    `${rLabel}(${fmtAed(subtotal)} × ${fmtNum(input.marginChange)})`,
  )

  let discountAmount: number
  let discountPercent: number
  if (input.discountMode === 'percent') {
    discountPercent = input.discountValue
    discountAmount = step('discount', 'Discount (AED)', rnd((subtotalAfterMargin * discountPercent) / 100),
      `${rLabel}(${fmtAed(subtotalAfterMargin)} × ${fmtNum(discountPercent)}%)`)
  } else {
    discountAmount = step('discount', 'Discount (AED)', rnd(input.discountValue), 'Entered amount')
    discountPercent = subtotalAfterMargin ? (discountAmount / subtotalAfterMargin) * 100 : 0
  }

  const rate = step('rate', 'Rate (AED)', subtotalAfterMargin - discountAmount,
    `${fmtAed(subtotalAfterMargin)} − ${fmtAed(discountAmount)}`)
  const amount = step('amount', 'Amount (AED)', rate * input.qty, `${fmtAed(rate)} × ${input.qty}`)
  const pricePerSqm = step('pricePerSqm', 'Price per m² (AED)', area ? rnd(rate / area) : 0,
    area ? `${rLabel}(${fmtAed(rate)} ÷ ${fmtNum(area)} m²)` : 'No area')

  if (s.warnNegativeOtherCharges && otherCharges < 0)
    warnings.push(`Other charges are negative (AED ${fmtAed(otherCharges)}). Confirm whether this is a discount.`)

  return {
    area, profileCost, profilePrice, glassCost, bonding, glassWeightKg, freight, otherCharges,
    accessories, installation, equipmentRental, insurance, duties, subtotal, subtotalAfterMargin,
    discountAmount, discountPercent, rate, amount, pricePerSqm, steps, warnings,
  }
}

/** SPEC §4.3: warn when the calculated price per m² is below Standard Pricing. */
export function standardPricingWarning(pricePerSqm: number, standardPricing: number, rules: PricingRules) {
  if (!rules.settings.warnBelowStandardPricing || !standardPricing) return null
  return pricePerSqm < standardPricing
    ? `Price per m² (AED ${fmtAed(pricePerSqm)}) is below Standard Pricing (AED ${fmtAed(standardPricing)}).`
    : null
}
