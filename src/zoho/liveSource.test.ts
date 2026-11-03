import { describe, expect, it } from 'vitest'
import productsJson from '../../data/products.json'
import rulesJson from '../../data/pricing-rules.json'
import type { PricingRules, Product } from '../engine/types'
import { liveLineToRevisionLine } from './liveSource'

const rules = rulesJson as PricingRules
const products = productsJson.products as Product[]
const byCode = new Map(products.map((p) => [String(p.oryxCode), p]))

// A BOQ line as the server function returns it (made-up values, real field names).
const f44 = {
  ID: '4543538000000000001', Reference1: '1', Location1: 'Hall', Type_of_Frame: 'Fusion F44 Fixed Window', No_of_Panels: '1',
  Width: '1600', Height: '1900', Quantity1: '3', Unit_Rate_AED: '6865', Amount_AED: '20595',
  Fusion_Profile_AED_per_SQM: '600', Origin_Profile_GBP: '0', Inotherm_Door_EUR: '0', Glass_Rate: '400', Glass_Thickness: '16',
  Freight_AED: '0', Other_Charges_AED: '177', Equipment_Rental_AED: '0', Bonding_Charges_AED: '0', Distributed_Equipment_Rental_AED: '0',
  Salesperson_s_Item_Pricing: '', Mark_Up: '3', Margin_Change: '1', Order_Type: '', Sequence: '',
  Product_Code: 'Rabel-Fusion-F44-Fixed Window-max 7sqm',
}

describe('Live Zoho BOQ lines', () => {
  it('prices a live line like the Excel import, matching Zoho', () => {
    const l = liveLineToRevisionLine(f44, rules, byCode)
    expect(l).toMatchObject({ zohoId: f44.ID, status: 'original', current: { ref: '1', qty: 3, rate: 6865, amount: 20595, widthMm: 1600 } })
    expect(l.input).toMatchObject({ ruleId: 'fusion-a', supplierPrice: 600, markup: 3, glassRate: 400, otherCharges: 177 })
    expect(l.priceNote).toBeUndefined()
  })

  it('flags a line Zoho priced from the salesperson price', () => {
    const sp = liveLineToRevisionLine({ ...f44, Salesperson_s_Item_Pricing: '6000', Amount_AED: '18000' }, rules, byCode)
    expect(sp.priceNote).toBe('salesperson')
  })

  it('keeps a quantity-0 line without pricing inputs', () => {
    const z = liveLineToRevisionLine({ ...f44, Quantity1: '0', Amount_AED: '0' }, rules, byCode)
    expect(z.input).toBeUndefined()
    expect(z.current.amount).toBe(0)
  })
})
