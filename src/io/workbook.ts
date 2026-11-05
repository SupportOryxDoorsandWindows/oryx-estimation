// Converts estimates, settings and products to and from spreadsheet rows.
// Pure functions: the Excel libraries only read and write the rows (see src/ui/excelFile.ts).
import { calculateLineItem } from '../engine/calculate'
import { blankLineItem, matchRule } from '../engine/defaults'
import { GLASS_TYPES, type GlassType, type LineItemInput, type PricingRule, type PricingRules, type Product, type Settings } from '../engine/types'
import { blankProposal, PROPOSAL_FIELDS, type ProposalDetails } from '../ui/proposal'
import type { Estimate } from '../ui/storage'

export type Cell = string | number | boolean | null
export interface SheetRows {
  sheet: string
  data: Cell[][]
  widths?: number[]
  /** Excel number format per column, e.g. '#,##0' (used for number cells only). */
  formats?: (string | undefined)[]
  /** Rows (by index) written in bold, besides the first row. */
  boldRows?: number[]
}
/** What a reader hands back: any cell value, including dates. */
export interface ReadSheet {
  sheet: string
  data: unknown[][]
}

export const SHEETS = {
  proposals: 'Proposal details',
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
  { title: 'Supplier price from', key: 'priceSource', width: 14, get: (_e, i) => (i.priceSource === 'doorChart' ? 'Door price chart' : 'Entered') },
  { title: 'Pricing (AED/m²)', key: 'doorPricing', width: 11, get: (_e, i) => i.doorPricing ?? null },
  { title: 'Markup', key: 'markup', width: 8, get: (_e, i) => i.markup },
  { title: 'Margin change', key: 'marginChange', width: 9, get: (_e, i) => i.marginChange },
  { title: 'Glass rate (AED/m²)', key: 'glassRate', width: 11, get: (_e, i) => i.glassRate },
  { title: 'Glass thickness (mm)', key: 'glassThicknessMm', width: 11, get: (_e, i) => i.glassThicknessMm },
  { title: 'Dual colour', key: 'dualColour', width: 9, get: (_e, i) => yesNo(!!i.dualColour) },
  { title: 'Glass type', key: 'glassType', width: 10, get: (_e, i) => i.glassType ?? '' },
  { title: 'Glazing spec', key: 'glazingSpec', width: 16, get: (_e, i) => i.glazingSpec },
  { title: 'Bonding mode', key: 'bondingMode', width: 11, get: (_e, i) => (i.bondingMode === 'perSqm' ? 'Per m²' : 'Amount') },
  { title: 'Bonding rate (AED/m²)', key: 'bondingRate', width: 11, get: (_e, i) => i.bondingRate },
  { title: 'Bonding amount (AED)', key: 'bondingAmount', width: 11, get: (_e, i) => i.bondingAmount },
  { title: 'Freight (AED)', key: 'freight', width: 11, get: (_e, i) => i.freight },
  { title: 'Other charges (AED)', key: 'otherCharges', width: 11, get: (_e, i) => i.otherCharges },
  { title: 'Installation (AED)', key: 'installation', width: 11, get: (_e, i) => i.installation },
  { title: 'Manpower charges (AED)', key: 'manpower', width: 11, get: (_e, i) => i.manpower },
  { title: 'Manpower entered by hand', key: 'manpowerManual', width: 10, get: (_e, i) => yesNo(i.manpowerManual) },
  { title: 'Equipment rental (AED)', key: 'equipmentRental', width: 11, get: (_e, i) => i.equipmentRental },
  { title: 'Other costs comments', key: 'costComments', width: 30, get: (_e, i) => i.costComments ?? '' },
  { title: 'Insurance applied', key: 'insuranceEnabled', width: 9, get: (_e, i) => yesNo(i.insuranceEnabled) },
  { title: 'Duties (%)', key: 'dutiesPercent', width: 8, get: (_e, i) => i.dutiesPercent },
  { title: 'Discount mode', key: 'discountMode', width: 10, get: (_e, i) => (i.discountMode === 'percent' ? 'Percent' : 'Amount') },
  { title: 'Discount value', key: 'discountValue', width: 10, get: (_e, i) => i.discountValue },
  { title: 'Salesperson price (AED)', key: 'salespersonPrice', width: 12, get: (_e, i) => i.salespersonPrice },
  { title: 'Zoho amount (AED)', key: 'zohoAmount', width: 12, get: (_e, i) => i.zohoAmount ?? null },
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
  dualColourSurcharge: 'Dual colour surcharge on profile price (0–1)',
  glassTypeRates: 'Glass rates by type (AED/m²)',
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
  manpowerRate: 'Manpower charges as a share of profile cost (0–1)',
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
    const cell: Cell = typeof v === 'boolean' ? yesNo(v)
      : typeof v === 'object' ? Object.entries(v).map(([k, n]) => `${k} ${n}`).join('; ') // e.g. "Standard 450; Special 800"
      : v
    settings.push([key, SETTING_LABELS[key], cell, yesNo(unconfirmed.has(key))])
  }

  const ruleRows: Cell[][] = [['ID', 'Origin', 'Business Unit', 'Keywords', 'Cost method', 'Markup', 'Freight basis', 'Freight (AED)', 'Other default (AED)', 'Glass line']]
  for (const r of rules.rules) {
    ruleRows.push([r.id, r.label, r.fabricator, r.keywords.join(', '), r.costMethod, r.markup, r.freight.type, r.freight.value, r.otherCharges, yesNo(r.glassLine)])
  }

  const proposals: Cell[][] = [['Estimate ID', 'Estimate name', ...PROPOSAL_FIELDS.map((f) => f.label)]]
  for (const e of estimates) {
    const d = { ...blankProposal(), ...e.details }
    proposals.push([e.id, e.name, ...PROPOSAL_FIELDS.map((f) => (f.type === 'checkbox' ? yesNo(!!d[f.key]) : (d[f.key] as Cell)))])
  }

  return [
    { sheet: SHEETS.proposals, data: proposals, widths: [12, 28, ...PROPOSAL_FIELDS.map((f) => (f.type === 'textarea' ? 40 : 18))] },
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
export function records(sheet: ReadSheet | undefined): Record<string, unknown>[] {
  if (!sheet || sheet.data.length === 0) return []
  const header = sheet.data[0].map(str)
  return sheet.data.slice(1)
    .filter((row) => row.some((c) => str(c) !== ''))
    .map((row) => {
      // Zoho repeats some titles (e.g. two "ID" columns); the first one wins.
      const rec: Record<string, unknown> = {}
      header.forEach((h, i) => {
        let key = h
        for (let n = 2; key in rec; n++) key = `${h} (${n})`
        rec[key] = row[i] ?? null
      })
      return rec
    })
}

const findSheet = (sheets: ReadSheet[], name: string) =>
  sheets.find((s) => s.sheet.trim().toLowerCase() === name.toLowerCase())

export interface ImportResult {
  estimates?: Estimate[]
  rules?: PricingRules
  /** Plain-English notes about the import, shown to the user. */
  notes?: string[]
}

export function parseWorkbook(sheets: ReadSheet[], current: PricingRules, products: Product[] = []): ImportResult {
  const boq = sheets.find(isBoqSheet)
  if (boq) return parseBoq(boq, current, products)
  const result: ImportResult = {}
  const lineRows = records(findSheet(sheets, SHEETS.estimates))
  if (!findSheet(sheets, SHEETS.estimates) && !findSheet(sheets, SHEETS.settings) && !findSheet(sheets, SHEETS.proposals)) {
    throw new Error(`No "${SHEETS.estimates}" or "${SHEETS.settings}" sheet found. Use a file exported from this app.`)
  }

  if (findSheet(sheets, SHEETS.estimates) || findSheet(sheets, SHEETS.proposals)) {
    const accRows = records(findSheet(sheets, SHEETS.accessories))
    const byId = new Map<string, Estimate>()
    for (const row of lineRows) {
      const id = str(row['Estimate ID']) || crypto.randomUUID()
      let est = byId.get(id)
      if (!est) {
        const updated = str(row['Updated']) || new Date().toISOString()
        est = { id, name: str(row['Estimate name']) || 'Imported estimate', createdAt: updated, updatedAt: updated, items: [], details: blankProposal() }
        byId.set(id, est)
      }
      const itemNo = num(row['Item #']) || est.items.length + 1
      // Files exported before the manpower default have no 'Manpower entered by hand' column: keep their typed amount.
      const item: LineItemInput = { ...blankLineItem(), manpowerManual: true }
      for (const col of INPUT_COLS) {
        if (!col.key || !(col.title in row)) continue
        const v = row[col.title]
        switch (col.key) {
          case 'bondingMode': item.bondingMode = /m²|sqm|per/i.test(str(v)) ? 'perSqm' : 'amount'; break
          case 'discountMode': item.discountMode = /percent|%/i.test(str(v)) ? 'percent' : 'amount'; break
          case 'insuranceEnabled': item.insuranceEnabled = bool(v); break
          case 'dualColour': item.dualColour = bool(v); break
          case 'manpowerManual': item.manpowerManual = bool(v); break
          case 'salespersonPrice': item.salespersonPrice = str(v) === '' ? null : num(v) || null; break
          case 'zohoAmount': if (str(v) !== '') item.zohoAmount = num(v); break
          case 'priceSource': item.priceSource = /door/i.test(str(v)) ? 'doorChart' : 'entered'; break
          case 'doorPricing': item.doorPricing = str(v) === '' ? null : num(v) || null; break
          case 'glassType': item.glassType = (GLASS_TYPES as readonly string[]).find((t) => t.toLowerCase() === str(v).toLowerCase()) as GlassType ?? ''; break
          case 'ref': case 'location': case 'remarks': case 'productId': case 'ruleId': case 'glazingSpec': case 'costComments':
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
    // Proposal details: one row per estimate, matched on Estimate ID.
    for (const row of records(findSheet(sheets, SHEETS.proposals))) {
      const id = str(row['Estimate ID'])
      if (!id) continue
      let est = byId.get(id)
      if (!est) {
        const now = new Date().toISOString()
        est = { id, name: str(row['Estimate name']) || 'Imported estimate', createdAt: now, updatedAt: now, items: [blankLineItem()], details: blankProposal() }
        byId.set(id, est)
      }
      est.details = readProposal(row)
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
      settings[key] = typeof before === 'boolean' ? bool(row['Value'])
        : typeof before === 'number' ? num(row['Value'])
        : typeof before === 'object' ? { ...before, ...Object.fromEntries(str(row['Value']).split(';').map((p) => p.trim().match(/^(.*\S)\s+(-?[\d.,]+)$/)).filter((m): m is RegExpMatchArray => !!m).map((m) => [m[1], num(m[2])])) }
        : str(row['Value']) || before
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

function readProposal(row: Record<string, unknown>): ProposalDetails {
  const d = blankProposal()
  for (const f of PROPOSAL_FIELDS) {
    const title = f.label in row ? f.label : f.legacyLabel && f.legacyLabel in row ? f.legacyLabel : null
    if (!title) continue
    const v = row[title]
    d[f.key] = f.type === 'checkbox' ? bool(v)
      : f.type === 'number' ? num(v)
      : f.type === 'date' && v instanceof Date ? v.toISOString().slice(0, 10)
      : str(v)
  }
  return d
}

// ---- Zoho BOQ_Summary ----

const isBoqSheet = (s: ReadSheet) => {
  const header = (s.data[0] ?? []).map(str)
  return header.includes('Proposal Reference') && header.includes('Reference #')
}

/**
 * Reads the Zoho BOQ_Summary export: one estimate per proposal, one line item per row.
 * Inputs come straight from Zoho, so the calculated rate can be checked against Zoho's Amount.
 */
export function parseBoq(sheet: ReadSheet, rules: PricingRules, products: Product[]): ImportResult {
  const byCode = new Map(products.map((p) => [str(p.oryxCode).replace(/\s+/g, ' '), p]))
  const estimates = new Map<string, Estimate>()
  const notes: string[] = []
  const skipped: string[] = []
  const unmatched: string[] = []
  let extraCharges = 0

  for (const row of records(sheet)) {
    const proposal = str(row['Proposal Reference']) || 'BOQ import'
    const ref = str(row['Reference #'])
    const qty = num(row['Quantity'])
    if (qty <= 0) { skipped.push(ref || '(no ref)'); continue }

    let est = estimates.get(proposal)
    if (!est) {
      const added = row['Added Time'] instanceof Date ? (row['Added Time'] as Date).toISOString() : new Date().toISOString()
      const deal = str(row['Deal Name'])
      const closing = row['Closing Date']
      est = {
        id: `zoho-${proposal}`,
        name: deal ? `${proposal} – ${deal}` : proposal,
        createdAt: added,
        updatedAt: new Date().toISOString(),
        items: [],
        details: {
          ...blankProposal(),
          dealName: deal,
          proposalReference: proposal,
          orderNumber: str(row['Order Number']),
          quoteStatus: str(row['Quote Status']) || 'Not Started',
          closingDate: closing instanceof Date ? closing.toISOString().slice(0, 10) : str(closing),
        },
      }
      estimates.set(proposal, est)
    }

    const { item, product, code } = boqRowToItem(row, rules, byCode)
    if (!product) unmatched.push(`${ref} (${code || str(row['Type of Frame'])})`)
    extraCharges += num(row['Distributed Additional Charges (AED)'])
    est.items.push(item)
  }

  if (!estimates.size) throw new Error('The BOQ has no rows with a quantity above 0.')
  for (const e of estimates.values()) e.items.sort((x, y) => x.ref.localeCompare(y.ref, 'en', { numeric: true }))
  if (skipped.length) notes.push(`Skipped ${skipped.length} with quantity 0: ${skipped.join(', ')}.`)
  if (unmatched.length) notes.push(`No matching product for ${unmatched.join(', ')}.`)
  if (extraCharges) notes.push(`Distributed additional charges (AED ${extraCharges}) were not imported; the app has no field for them yet.`)
  return { estimates: [...estimates.values()], notes }
}

/** One BOQ_Summary row as pricing inputs. Zoho's Amount is kept as zohoAmount. */
export function boqRowToItem(row: Record<string, unknown>, rules: PricingRules, byCode: Map<string, Product>) {
    const ref = str(row['Reference #'])
    const qty = num(row['Quantity'])
    const code = str(row['Search for Product Code']).replace(/\s+/g, ' ')
    const product = byCode.get(code)
    const rule = matchRule(product, rules)

    const widthMm = num(row['Width (mm)'])
    const heightMm = num(row['Height (mm)'])
    const area = (widthMm * heightMm) / 1_000_000
    const aedPerSqm = num(row['Fusion Profile (AED per SQM)'])
    const gbp = num(row['Origin/Atlas/ABS/Radial (GBP)'])
    const eur = num(row['Inotherm/Kobbe/Tenni/Otif/Renson Pergola/Velux/Renson Sun Protection (EUR)'])

    // Use the supplier price in the rule's own currency. If the rule expects something else,
    // carry Zoho's AED profile cost over as a lump supplier quote and switch to the manual rule.
    let ruleId = rule.id
    let supplierPrice = 0
    const given = aedPerSqm ? 'aedPerSqm' : gbp ? 'gbp' : eur ? 'eur' : null
    const fits = given === rule.costMethod || (given === 'eur' && rule.costMethod === 'eurDiscounted')
    if (given && fits) supplierPrice = given === 'aedPerSqm' ? aedPerSqm : given === 'gbp' ? gbp : eur
    else if (given) {
      ruleId = 'other'
      supplierPrice = given === 'aedPerSqm' ? area * aedPerSqm
        : given === 'gbp' ? gbp * rules.settings.gbpToAed
        : eur * rules.settings.eurToAed
    }

    const sp = num(row["Salesperson's Item Pricing (AED)"])
    const item: LineItemInput = {
      ...blankLineItem(),
      // Zoho BOQ lines carry no manpower; keep it at 0 so imported lines still match Zoho.
      manpowerManual: true,
      productId: product?.id ?? '',
      ruleId,
      ref,
      location: str(row['Location']),
      remarks: str(row['Type of Frame']),
      widthMm,
      heightMm,
      panels: Math.max(1, Math.round(num(row['No. of Panels']))),
      qty: Math.round(qty),
      supplierPrice,
      markup: num(row['Mark Up']) || rule.markup,
      marginChange: num(row['Margin Change']) || 1,
      glassRate: num(row['Glass Rate (AED)']),
      glassThicknessMm: num(row['Glass Thickness']),
      bondingMode: 'amount',
      bondingAmount: num(row['Bonding Charges (AED)']),
      freight: num(row['Freight (AED)']),
      otherCharges: num(row['Other Charges (AED)']),
      equipmentRental: num(row['Equipment Rental (AED)']),
      salespersonPrice: sp > 0 ? sp : null,
      zohoAmount: num(row['Amount (AED)']),
    }
    return { item, product, code }
}

