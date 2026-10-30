export type Rounding = 'floor' | 'round'
export type CostMethod = 'aedPerSqm' | 'gbp' | 'eur' | 'eurDiscounted' | 'manual'

export interface Settings {
  rounding: Rounding
  gbpToAed: number
  eurToAed: number
  inothermDiscount: number
  curtainWallBondingRate: number
  bondingDefault: 'curtainWallPerSqm' | 'manual'
  glassAreaBasis: 'full'
  glassDensityKgPerSqmPerMm: number
  defaultMarkupOther: number
  insuranceRate: number
  percentageBase: 'subtotalBeforeDiscount'
  warnNegativeOtherCharges: boolean
  warnBelowStandardPricing: boolean
}

export interface PricingRule {
  id: string
  label: string
  fabricator: string
  keywords: string[]
  costMethod: CostMethod
  markup: number
  freight: { type: 'fixed' | 'perPanel' | 'manual'; value: number }
  otherCharges: number | null
  glassLine: boolean
}

export interface PricingRules {
  version: number
  source: string
  settings: Settings
  unconfirmed: (keyof Settings)[]
  rules: PricingRule[]
}

/** One row of the Zoho All_Products export. Business Unit is the origin (Fusion, Origin, Hyline…). */
export interface Product {
  id: string
  oryxCode?: string
  name: string
  fabricator: string
  businessUnit: string
  productCode: string
  type: string
  sizeRange: string
  standardPricing: number
  installDays?: number
  remarks?: string
}

export interface Accessory {
  description: string
  cost: number
}

export interface LineItemInput {
  productId: string
  ruleId: string
  ref: string
  location: string
  remarks: string
  widthMm: number
  heightMm: number
  panels: number
  qty: number
  /** AED/m² for aedPerSqm, GBP for gbp, EUR for eur/eurDiscounted, lump AED for manual. */
  supplierPrice: number
  markup: number
  glassRate: number
  glassThicknessMm: number
  glazingSpec: string
  bondingMode: 'perSqm' | 'amount'
  bondingRate: number
  bondingAmount: number
  freight: number
  otherCharges: number
  installation: number
  equipmentRental: number
  accessories: Accessory[]
  insuranceEnabled: boolean
  dutiesPercent: number
  discountMode: 'amount' | 'percent'
  discountValue: number
  marginChange: number
  salespersonPrice: number | null
  /** Amount from an imported Zoho BOQ, kept for comparison only. */
  zohoAmount?: number | null
}

export interface Step {
  key: string
  label: string
  value: number
  formula: string
}

export interface LineItemResult {
  area: number
  profileCost: number
  profilePrice: number
  glassCost: number
  bonding: number
  glassWeightKg: number
  freight: number
  otherCharges: number
  accessories: number
  installation: number
  equipmentRental: number
  insurance: number
  duties: number
  subtotal: number
  subtotalAfterMargin: number
  discountAmount: number
  discountPercent: number
  rate: number
  amount: number
  pricePerSqm: number
  steps: Step[]
  warnings: string[]
}
