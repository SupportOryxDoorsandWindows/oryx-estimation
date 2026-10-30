// Converts estimates, settings and products to and from spreadsheet rows.
// Pure functions: the Excel libraries only read and write the rows (see src/ui/excelFile.ts).
import { calculateLineItem } from '../engine/calculate'
import { blankLineItem } from '../engine/defaults'
import type { LineItemInput, PricingRule, PricingRules, Product, Settings } from '../engine/types'
import type { Estimate } from '../ui/storage'

export type Cell = string | number | boolean | null
export interface SheetRows {
  sheet: string
  data: Cell[][]
  widths?: number[]
}
/** What a reader hands back: any cell value, including dates. */
export interface ReadSheet {
  sheet: string
  data: unknown[][]
}

export const SHEETS = {
  estimates: 'Estimates',
  accessories: 'Accessories',
  settings: 'Settings',
  rules: 'Pricing rules',
} as const

type Col = { title: string; width: number; get: (e: Estimate, i: LineItemInput, n: number, rules: PricingRules, products: Product[]) => Cell }

const yesNo = (b: boolean) => (b ? 'Yes' : 'No')
const productName = (id: string, products: Product[]) => {
  const p = products.find((x) => x.id === id)
  return p ? [p.fabricator, p.businessUnit, p.productCode, p.type, p.sizeRange].filter(Boolean).join(' · ') : ''
}

// Input columns are read back on import; calculated columns are for reading in Excel only.
const INPUT_COLS: (Col & { key?: keyof LineItemInput })[] = [
  { title: 'Estimate ID', width: 12, get: (e) => e.id },
  { title: 'Estimate name', width: 28, get: (e) => e.name },
  { title: 'Updated', width: 18, get: (e) => e.updatedAt },
  { title: 'Item #', width: 7, get: (_e, _i, n) => n },
  { title: 'Ref #', key: 'ref', width: 10, get: (_e, i) => i.ref },
  { title: 'Location', key: 'location', width: 16, get: (_e, i) => i.location },
  { title: 'Remarks', key: 'remarks', width: 20, get: (_e, i) => i.remarks },
  { title: 'Product ID', key: 'productId', width: 20, get: (_e, i) => i.productId },
  { title: 'Product', width: 40, get: (_e, i, _n, _r, p) => productName(i.productId, p) },
  { title: 'Pricing rule ID', key: 'ruleId', width: 12, get: (_e, i) => i.ruleId },
  { title: 'Width (mm)', key: 'widthMm', width: 11, get: (_e, i) => i.widthMm },
  { title: 'Height (mm)', key: 'heightMm', width: 11, get: (_e, i) => i.heightMm },
  { title: 'No. of panels', key: 'panels', width: 9, get: (_e, i) => i.panels },
  { title: 'Qty', key: 'qty', width: 6, get: (_e, i) => i.qty },
  { title: 'Supplier price', key: 'supplierPrice', width: 12, get: (_e, i) => i.supplierPrice },
  { title: 'Markup', key: 'markup', width: 8, get: (_e, i) => i.markup },
  { title: 'Margin change', key: 'marginChange', width: 9, get: (_e, i) => i.marginChange },
  { title: 'Glass rate (AED/m²)', key: 'glassRate', width: 11, get: (_e, i) => i.glassRate },
  { title: 'Glass thickness (mm)', key: 'glassThicknessMm', width: 11, get: (_e, i) => i.glassThicknessMm },
  { title: 'Glazing spec', key: 'glazingSpec', width: 16, get: (_e, i) => i.glazingSpec },
  { title: 'Bonding mode', key: 'bondingMode', width: 11, get: (_e, i) => (i.bondingMode === 'perSqm' ? 'Per m²' : 'Amount') },
  { title: 'Bonding rate (AED/m²)', key: 'bondingRate', width: 11, get: (_e, i) => i.bondingRate },
  { title: 'Bonding amount (AED)', key: 'bondingAmount', width: 11, get: (_e, i) => i.bondingAmount },
  { title: 'Freight (AED)', key: 'freight', width: 11, get: (_e, i) => i.freight },
  { title: 'Other charges (AED)', key: 'otherCharges', width: 11, get: (_e, i) => i.otherCharges },
  { title: 'Installation (AED)', key: 'installation', width: 11, get: (_e, i) => i.installation },
  { title: 'Equipment rental (AED)', key: 'equipmentRental', width: 11, get: (_e, i) => i.equipmentRental },
  { title: 'Insurance applied', key: 'insuranceEnabled', width: 9, get: (_e, i) => yesNo(i.insuranceEnabled) },
  { title: 'Duties (%)', key: 'dutiesPercent', width: 8, get: (_e, i) => i.dutiesPercent },
  { title: 'Discount mode', key: 'discountMode', width: 10, get: (_e, i) => (i.discountMode === 'percent' ? 'Percent' : 'Amount') },
  { title: 'Discount value', key: 'discountValue', width: 10, get: (_e, i) => i.discountValue },
  { title: 'Salesperson price (AED)', key: 'salespersonPrice', width: 12, get: (_e, i) => i.salespersonPrice },
]

const CALC_COLS: { title: string; get: (r: ReturnType<typeof calculateLineItem>) => number }[] = [
  { title: 'Area (m²)', get: (r) => r.area },
  { title: 'Profile cost (AED)', get: (r) => r.profileCost },
  { title: 'Profile price (AED)', get: (r) => r.profilePrice },
  { title: 'Glass cost (AED)', get: (r) => r.glassCost },
  { title: 'Bonding charges (AED)', get: (r) => r.bonding },
  { title: 'Accessories (AED)', get: (r) => r.accessories },
  { title: 'Insurance (AED)', get: (r) => r.insurance },
  { title: 'Duties (AED)', get: (r) => r.duties },
  { title: 'Subtotal (AED)', get: (r) => r.subtotal },
  { title: 'Discount (AED)', get: (r) => r.discountAmount },
  { title: 'Rate (AED)', get: (r) => r.rate },
  { title: 'Amount (AED)', get: (r) => r.amount },
]

const SETTING_LABELS: Record<keyof Settings, string> = {
  rounding: 'Rounding (floor or round)',
  gbpToAed: 'GBP to AED',
  eurToAed: 'EUR to AED',
  inothermDiscount: 'Inotherm discount (0–1)',
  curtainWallBondingRate: 'Curtain wall bonding rate (AED/m²)',
  bondingDefault: 'Bonding default (curtainWallPerSqm or manual)',
  glassAreaBasis: 'Glass area basis',
  glassDensityKgPerSqmPerMm: 'Glass weight factor (kg/m²/mm)',
  defaultMarkupOther: 'Markup for products outside the pricing sheet',
  insuranceRate: 'Insurance rate (0–1)',
  percentageBase: 'Base for percentages',
  warnNegativeOtherCharges: 'Warn when other charges are negative',
  warnBelowStandardPricing: 'Warn below Standard Pricing',
}

export function buildWorkbook(estimates: Estimate[], rules: PricingRules, products: Product[]): SheetRows[] {
  const lines: Cell[][] = [[...INPUT_COLS.map((c) => c.title), ...CALC_COLS.map((c) => c.title)]]
  const accessories: Cell[][] = [['Estimate ID', 'Item #', 'Description', 'Cost (AED)']]
  for (const e of estimates) {
    e.items.forEach((item, idx) => {
      const r = calculateLineItem(item, rules)
      lines.push([...INPUT_COLS.map((c) => c.get(e, item, idx + 1, rules, products)), ...CALC_COLS.map((c) => c.get(r))])
      for (const a of item.accessories) accessories.push([e.id, idx + 1, a.description, a.cost])
    })
  }

  const s = rules.settings
  const unconfirmed = new Set<string>(rules.unconfirmed)
  const settings: Cell[][] = [['Key', 'Setting', 'Value', 'Unconfirmed']]
  for (const key of Object.keys(SETTING_LABELS) as (keyof Settings)[]) {
    const v = s[key]
    settings.push([key, SETTING_LABELS[key], typeof v === 'boolean' ? yesNo(v) : v, yesNo(unconfirmed.has(key))])
  }

  const ruleRows: Cell[][] = [['ID', 'Origin', 'Business Unit', 'Keywords', 'Cost method', 'Markup', 'Freight basis', 'Freight (AED)', 'Other default (AED)', 'Glass line']]
  for (const r of rules.rules) {
    ruleRows.push([r.id, r.label, r.fabricator, r.keywords.join(', '), r.costMethod, r.markup, r.freight.type, r.freight.value, r.otherCharges, yesNo(r.glassLine)])
  }

  return [
    { sheet: SHEETS.estimates, data: lines, widths: [...INPUT_COLS.map((c) => c.width), ...CALC_COLS.map(() => 12)] },
    { sheet: SHEETS.accessories, data: accessories, widths: [12, 7, 40, 12] },
    { sheet: SHEETS.settings, data: settings, widths: [26, 46, 18, 12] },
    { sheet: SHEETS.rules, data: ruleRows, widths: [10, 56, 14, 28, 14, 8, 12, 12, 16, 10] },
  ]
}

// ---- Reading ----

const str = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v).trim())
const num = (v: unknown) => {
  if (typeof v === 'number') return v
  const n = Number(str(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}
const bool = (v: unknown) => v === true || /^(yes|true|1)$/i.test(str(v))

/** Rows below a header row, as objects keyed by the header text. */
function records(sheet: ReadSheet | undefined): Record<string, unknown>[] {
  if (!sheet || sheet.data.length === 0) return []
  const header = sheet.data[0].map(str)
  return sheet.data.slice(1)
    .filter((row) => row.some((c) => str(c) !== ''))
    .map((row) => Object.fromEntries(header.map((h, i) => [h, row[i] ?? null])))
}

const findSheet = (sheets: ReadSheet[], name: string) =>
  sheets.find((s) => s.sheet.trim().toLowerCase() === name.toLowerCase())

export interface ImportResult {
  estimates?: Estimate[]
  rules?: PricingRules
}

export function parseWorkbook(sheets: ReadSheet[], current: PricingRules): ImportResult {
  const result: ImportResult = {}
  const lineRows = records(findSheet(sheets, SHEETS.estimates))
  if (!findSheet(sheets, SHEETS.estimates) && !findSheet(sheets, SHEETS.settings)) {
    throw new Error(`No "${SHEETS.estimates}" or "${SHEETS.settings}" sheet found. Use a file exported from this app.`)
  }

  if (findSheet(sheets, SHEETS.estimates)) {
    const accRows = records(findSheet(sheets, SHEETS.accessories))
    const byId = new Map<string, Estimate>()
    for (const row of lineRows) {
      const id = str(row['Estimate ID']) || crypto.randomUUID()
      let est = byId.get(id)
      if (!est) {
        const updated = str(row['Updated']) || new Date().toISOString()
        est = { id, name: str(row['Estimate name']) || 'Imported estimate', createdAt: updated, updatedAt: updated, items: [] }
        byId.set(id, est)
      }
      const itemNo = num(row['Item #']) || est.items.length + 1
      const item: LineItemInput = { ...blankLineItem() }
      for (const col of INPUT_COLS) {
        if (!col.key || !(col.title in row)) continue
        const v = row[col.title]
        switch (col.key) {
          case 'bondingMode': item.bondingMode = /m²|sqm|per/i.test(str(v)) ? 'perSqm' : 'amount'; break
          case 'discountMode': item.discountMode = /percent|%/i.test(str(v)) ? 'percent' : 'amount'; break
          case 'insuranceEnabled': item.insuranceEnabled = bool(v); break
          case 'salespersonPrice': item.salespersonPrice = str(v) === '' ? null : num(v) || null; break
          case 'ref': case 'location': case 'remarks': case 'productId': case 'ruleId': case 'glazingSpec':
            item[col.key] = str(v); break
          default: (item as unknown as Record<string, number>)[col.key] = num(v)
        }
      }
      item.ruleId ||= 'other'
      item.panels = Math.max(1, Math.round(item.panels))
      item.qty = Math.max(1, Math.round(item.qty))
      item.accessories = accRows
        .filter((a) => str(a['Estimate ID']) === id && num(a['Item #']) === itemNo)
        .map((a) => ({ description: str(a['Description']), cost: num(a['Cost (AED)']) }))
      est.items.push(item)
    }
    result.estimates = [...byId.values()]
  }

  const settingRows = records(findSheet(sheets, SHEETS.settings))
  const ruleRows = records(findSheet(sheets, SHEETS.rules))
  if (settingRows.length || ruleRows.length) {
    const settings = { ...current.settings } as Record<string, unknown>
    const unconfirmed: string[] = []
    for (const row of settingRows) {
      const key = str(row['Key'])
      if (!(key in current.settings)) continue
      const before = current.settings[key as keyof Settings]
      settings[key] = typeof before === 'boolean' ? bool(row['Value']) : typeof before === 'number' ? num(row['Value']) : str(row['Value']) || before
      if (bool(row['Unconfirmed'])) unconfirmed.push(key)
    }
    const rules: PricingRule[] = ruleRows.length
      ? ruleRows.map((row) => {
          const other = str(row['Other default (AED)'])
          return {
            id: str(row['ID']),
            label: str(row['Origin']),
            fabricator: str(row['Business Unit']),
            keywords: str(row['Keywords']).split(',').map((k) => k.trim()).filter(Boolean),
            costMethod: str(row['Cost method']) as PricingRule['costMethod'],
            markup: num(row['Markup']),
            freight: { type: str(row['Freight basis']) as PricingRule['freight']['type'], value: num(row['Freight (AED)']) },
            otherCharges: other === '' ? null : num(other),
            glassLine: bool(row['Glass line']),
          }
        }).filter((r) => r.id)
      : current.rules
    result.rules = {
      ...current,
      settings: settings as unknown as Settings,
      unconfirmed: (settingRows.length ? unconfirmed : current.unconfirmed) as (keyof Settings)[],
      rules,
    }
  }
  return result
}

/** Reads the Zoho Creator "All_Products" export. Image columns are ignored. */
export function parseProducts(sheets: ReadSheet[]): Product[] {
  const sheet = sheets.find((s) => records(s)[0] && 'Oryx Code' in records(s)[0]) ?? sheets[0]
  const rows = records(sheet)
  if (!rows.length || !('Business Unit' in rows[0]) || !('Product Code' in rows[0])) {
    throw new Error('This is not the Zoho All_Products export. It needs "Business Unit" and "Product Code" columns.')
  }
  const clean = (v: unknown) => str(v).replace(/\s+/g, ' ')
  return rows.map((r) => ({
    id: clean(r['ID']) || clean(r['Oryx Code']),
    oryxCode: clean(r['Oryx Code']),
    name: clean(r['Product Code']),
    fabricator: clean(r['Fabricator']),
    businessUnit: clean(r['Business Unit']),
    productCode: clean(r['Product Code']),
    type: clean(r['Product Type']),
    sizeRange: clean(r['Size Range']),
    standardPricing: num(r['Standard Pricing Per SQM']),
    installDays: num(r['Estimated Time of Installation']),
    remarks: clean(r['Remarks']),
  }))
}
