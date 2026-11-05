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
  /** Added to the profile price when a line item is dual colour (0.1 = 10%). */
  dualColourSurcharge: number
  /** Glass rate (AED/m²) filled in when a glass type is chosen; the estimator can change it. */
  glassTypeRates: Record<string, number>
  /** Manpower charges filled in as this share of the profile cost (0.2 = 20%); the estimator can type another amount. */
  manpowerRate: number
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

/** Production-costed AED/m² rates on a width × height grid; sizes in between are interpolated. */
export interface DoorChart {
  label: string
  source: string
  /** Costed widths and heights in mm, ascending. */
  widths: number[]
  heights: number[]
  /** rates[heightIndex][widthIndex], AED/m². */
  rates: number[][]
  /** Fraction added to the interpolated base rate (0.1 = 10%). */
  markupOnBase: number
}

export interface PricingRules {
  version: number
  source: string
  settings: Settings
  unconfirmed: (keyof Settings)[]
  rules: PricingRule[]
  doorChart: DoorChart
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

export const GLASS_TYPES = ['Standard', 'Special', 'Jumbo', 'Super Jumbo'] as const
export type GlassType = (typeof GLASS_TYPES)[number] | ''

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
  /** 'doorChart': the AED/m² rate comes from the door price chart for this width and height. */
  priceSource: 'entered' | 'doorChart'
  /** With the door chart: the estimator's Pricing (AED/m²) over the chart's Profile reference. null = use the reference. */
  doorPricing: number | null
  markup: number
  glassRate: number
  glassThicknessMm: number
  glazingSpec: string
  /** Standard, Special, Jumbo or Super Jumbo; '' until chosen. Choosing one fills in its glass rate. */
  glassType: GlassType
  /** Dual colour frames: adds the dual colour surcharge (10%) to the profile price. */
  dualColour: boolean
  bondingMode: 'perSqm' | 'amount'
  bondingRate: number
  bondingAmount: number
  freight: number
  otherCharges: number
  installation: number
  /** Manpower charges, AED, when entered by hand (manpowerManual). */
  manpower: number
  /** false: manpower = profile cost × the manpower rate (Settings). true: the amount typed in `manpower`. */
  manpowerManual: boolean
  equipmentRental: number
  /** Notes on the other costs (free text, e.g. what the charges cover). Not used in any calculation. */
  costComments: string
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
  dualColour: number
  glassCost: number
  bonding: number
  glassWeightKg: number
  freight: number
  otherCharges: number
  accessories: number
  installation: number
  manpower: number
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
