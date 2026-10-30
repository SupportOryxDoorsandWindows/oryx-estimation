import readXlsxFile from 'read-excel-file/universal'
import writeXlsxFile from 'write-excel-file/node'
import { describe, expect, it } from 'vitest'
import productsJson from '../../data/products.json'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from '../engine/calculate'
import { blankLineItem } from '../engine/defaults'
import type { PricingRules, Product } from '../engine/types'
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
    const [lines] = buildWorkbook([cw011], rules, products)
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
