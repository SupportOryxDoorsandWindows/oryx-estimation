import readXlsxFile from 'read-excel-file/universal'
import writeXlsxFile from 'write-excel-file/node'
import { describe, expect, it } from 'vitest'
import productsJson from '../../data/products.json'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from '../engine/calculate'
import { blankLineItem } from '../engine/defaults'
import type { PricingRules, Product } from '../engine/types'
import { blankProposal } from '../ui/proposal'
import type { Estimate } from '../ui/storage'
import { buildWorkbook, parseProducts, parseWorkbook, type ReadSheet, type SheetRows } from './workbook'

const rules = rulesJson as PricingRules
const products = productsJson.products as Product[]

// Write real .xlsx bytes and read them back, as the app does in the browser.
async function roundTrip(sheets: SheetRows[]): Promise<ReadSheet[]> {
  const buffer = await writeXlsxFile(sheets.map((s) => ({ sheet: s.sheet, data: s.data.map((r) => r.map((v) => v ?? null)) }))).toBuffer()
  return (await readXlsxFile(new Uint8Array(buffer).buffer)) as ReadSheet[]
}

const cw011: Estimate = {
  id: 'est-1',
  name: 'P268194R3',
  createdAt: '2026-10-29T00:00:00.000Z',
  updatedAt: '2026-10-29T00:00:00.000Z',
  details: {
    ...blankProposal(),
    additionalWorksVariation: true,
    dealName: 'Test deal',
    address: 'Villa 1, Street 2\nDubai',
    proposalReference: 'P268194R3',
    orderValueInCrm: 125000,
    quoteStatus: 'Accepted by the Client',
    proposalDate: '2026-10-01',
    revisionNumber: 3,
  },
  items: [
    {
      ...blankLineItem(),
      productId: '4543538000018465002', ruleId: 'fusion-a', ref: 'CW01.1', location: 'Ground floor',
      widthMm: 4789, heightMm: 3366, panels: 8, qty: 1, supplierPrice: 800, markup: 2.5,
      glassRate: 450, glassThicknessMm: 16, bondingMode: 'amount', bondingAmount: 16120, otherCharges: -5387,
      salespersonPrice: 48000,
    },
    {
      ...blankLineItem(), ref: 'W02', widthMm: 1000, heightMm: 1500, supplierPrice: 3000, insuranceEnabled: true,
      discountMode: 'percent', discountValue: 5,
      accessories: [{ description: 'Handle set', cost: 350 }, { description: 'Closer', cost: 900 }],
    },
  ],
}

describe('Excel export and import', () => {
  it('exports calculated figures next to the inputs', () => {
    const lines = buildWorkbook([cw011], rules, products).find((s) => s.sheet === 'Estimates')!
    const header = lines.data[0]
    const row = lines.data[1]
    expect(row[header.indexOf('Rate (AED)')]).toBe(50225)
    expect(row[header.indexOf('Product')]).toBe('Insulux · Fusion · C35 Reinforced · Curtain Wall')
  })

  it('round-trips estimates, accessories and settings through a real .xlsx file', async () => {
    const sheets = await roundTrip(buildWorkbook([cw011], rules, products))
    const { estimates, rules: imported } = parseWorkbook(sheets, rules)
    expect(estimates).toHaveLength(1)
    expect(estimates![0].name).toBe('P268194R3')
    expect(estimates![0].items).toEqual(cw011.items)
    expect(estimates![0].details).toEqual(cw011.details)
    expect(calculateLineItem(estimates![0].items[0], imported!).rate).toBe(50225)
    expect(imported).toEqual(rules)
  })

  it('rejects a workbook that was not exported from the app', async () => {
    const sheets = await roundTrip([{ sheet: 'Sheet1', data: [['a', 'b'], [1, 2]] }])
    expect(() => parseWorkbook(sheets, rules)).toThrow(/No "Estimates"/)
  })
})

describe('Zoho products import', () => {
  it('reads the All_Products columns and ignores the image columns', async () => {
    const sheets = await roundTrip([{
      sheet: 'All_Products',
      data: [
        ['Oryx Code', 'Fabricator', 'Business Unit', 'Product Code', 'Product Type', 'Size Range', 'Standard Pricing Per SQM', 'Estimated Time of Installation', 'Remarks', 'Brand Logo', 'ID'],
        ['Insulux-Fusion-C35 Reinforced-Curtain Wall', 'Insulux', 'Fusion', 'C35 Reinforced', 'Curtain Wall', '', 1800, 0, 'Get the quote from Insulux', 'https://example.test/logo.jpg', '4543538000018465002'],
      ],
    }])
    const [p] = parseProducts(sheets)
    expect(p).toEqual(products.find((x) => x.id === '4543538000018465002'))
  })

  it('rejects a sheet without the Zoho columns', async () => {
    const sheets = await roundTrip([{ sheet: 'Sheet1', data: [['Name'], ['x']] }])
    expect(() => parseProducts(sheets)).toThrow(/All_Products/)
  })
})

describe('Zoho BOQ_Summary import', () => {
  // Made-up proposal in the BOQ_Summary layout. Zoho repeats some column titles; the first one holds the data.
  const header = ['SN', 'Proposal Reference', 'Deal Name', 'Reference #', 'Location', 'Type of Frame', 'No. of Panels', 'Width (mm)', 'Height (mm)', 'Quantity', 'Amount (AED)',
    'Origin/Atlas/ABS/Radial (GBP)', 'Glass Rate (AED)', 'Freight (AED)', 'Other Charges (AED)', 'Equipment Rental (AED)', 'Distributed Additional Charges (AED)',
    "Salesperson's Item Pricing (AED)", 'Bonding Charges (AED)', 'Glass Thickness', 'Fusion Profile (AED per SQM)', 'Origin/Atlas/ABS/Radial (GBP)',
    'Mark Up', 'Margin Change', 'Search for Product Code']
  const rows = [
    ['', 'P000001R1', 'Test deal', '2', 'Hall', 'Fusion F44 Fixed Window', 1, 1600, 1900, 3, 20595, 0, 400, 0, 177, 0, 0, '', 0, 16, 600, '', 3, 1, 'Rabel-Fusion-F44-Fixed Window-max 7sqm'],
    ['', 'P000001R1', 'Test deal', '1', 'Study', 'Origin OW80 Top Hung Window', 3, 1600, 1900, 1, 8610, 501, 400, 1500, 0, 0, 0, 8610, 0, 16, 0, '', 2.85, 1, 'Origin-Origin-OW80-Top Hung Window'],
    ['', 'P000001R1', 'Test deal', '1 - FS', 'Study', 'Flyscreen', 1, 1600, 1900, 0, 0, 0, 0, 0, 0, 0, 0, '', 0, 16, 0, '', 3, 1, 'Freedom-Freedom-Zipline Flyscreen 80mm-Flyscreen'],
  ]

  it('builds one estimate per proposal with Zoho inputs and amounts', async () => {
    const sheets = await roundTrip([{ sheet: 'BOQ_Summary', data: [header, ...rows] }])
    const { estimates, notes } = parseWorkbook(sheets, rules, products)
    expect(estimates).toHaveLength(1)
    const [est] = estimates!
    expect(est.name).toBe('P000001R1 – Test deal')
    expect(est.details).toMatchObject({ dealName: 'Test deal', proposalReference: 'P000001R1', quoteStatus: 'Not Started' })
    expect(est.items.map((i) => i.ref)).toEqual(['1', '2'])
    expect(notes).toEqual(['Skipped 1 with quantity 0: 1 - FS.'])

    const [origin, fusion] = est.items
    expect(fusion.ruleId).toBe('fusion-a')
    expect(calculateLineItem(fusion, rules).amount).toBe(fusion.zohoAmount) // 6,865 × 3 = 20,595
    expect(origin.ruleId).toBe('origin')
    expect(origin.supplierPrice).toBe(501)
    expect(origin.salespersonPrice).toBe(8610)
    expect(calculateLineItem(origin, rules).rate).toBe(9855) // calculated rate stays independent of the salesperson price
  })
})
