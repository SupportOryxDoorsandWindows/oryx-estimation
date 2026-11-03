// Revisions straight from Zoho: CRM deals, Creator proposals and BOQ lines,
// fetched through the estimation-zoho server function when selected. Nothing is kept.
import { calculateLineItem } from '../engine/calculate'
import { parseReference, snapshot, type RevisionLine } from '../engine/revision'
import type { PricingRules, Product } from '../engine/types'
import { boqRowToItem } from '../io/workbook'
import { dealProposals, proposalBoq, searchDeals, type ZohoBoqLine } from './crm'
import type { ZohoSource } from './source'

/**
 * A BOQ line in the column titles of the BOQ_Summary export, so the live source
 * prices lines exactly like the tested Excel import (boqRowToItem).
 */
export function liveLineToRow(l: ZohoBoqLine): Record<string, unknown> {
  return {
    'Reference #': l.Reference1,
    Location: l.Location1,
    'Type of Frame': l.Type_of_Frame,
    'No. of Panels': l.No_of_Panels,
    'Width (mm)': l.Width,
    'Height (mm)': l.Height,
    Quantity: l.Quantity1,
    'Amount (AED)': l.Amount_AED,
    'Fusion Profile (AED per SQM)': l.Fusion_Profile_AED_per_SQM,
    'Origin/Atlas/ABS/Radial (GBP)': l.Origin_Profile_GBP,
    'Inotherm/Kobbe/Tenni/Otif/Renson Pergola/Velux/Renson Sun Protection (EUR)': l.Inotherm_Door_EUR,
    'Glass Rate (AED)': l.Glass_Rate,
    'Glass Thickness': l.Glass_Thickness,
    'Freight (AED)': l.Freight_AED,
    'Other Charges (AED)': l.Other_Charges_AED,
    'Equipment Rental (AED)': l.Equipment_Rental_AED,
    'Bonding Charges (AED)': l.Bonding_Charges_AED,
    'Distributed Additional Charges (AED)': l.Distributed_Equipment_Rental_AED,
    "Salesperson's Item Pricing (AED)": l.Salesperson_s_Item_Pricing,
    'Mark Up': l.Mark_Up,
    'Margin Change': l.Margin_Change,
    'Search for Product Code': l.Product_Code,
  }
}

const num = (v: unknown) => Number(String(v ?? '').replace(/,/g, '')) || 0

export function liveLineToRevisionLine(l: ZohoBoqLine, rules: PricingRules, byCode: Map<string, Product>): RevisionLine {
  const { item } = boqRowToItem(liveLineToRow(l), rules, byCode)
  const qty = Math.round(num(l.Quantity1))
  const amount = num(l.Amount_AED)
  const snap = snapshot({
    ref: item.ref, location: item.location, description: l.Type_of_Frame ?? '', productId: item.productId,
    widthMm: item.widthMm, heightMm: item.heightMm, panels: item.panels, qty, rate: qty ? amount / qty : 0,
  })
  const reproducible = qty > 0 && calculateLineItem(item, rules).amount === amount
  return {
    id: `zoho-${l.ID}`,
    zohoId: l.ID,
    status: 'original',
    original: snap,
    current: { ...snap },
    input: qty > 0 ? { ...item, qty } : undefined,
    ...(qty > 0 && !reproducible ? { priceNote: 'salesperson' as const } : {}),
  }
}

export function liveZohoSource(rules: PricingRules, products: Product[]): ZohoSource {
  const byCode = new Map(products.map((p) => [String(p.oryxCode ?? '').trim().replace(/\s+/g, ' '), p]))
  return {
    label: 'Zoho CRM and Creator (read-only)',
    live: true,
    async searchDeals(query) {
      if (query.trim().length < 2) return []
      return (await searchDeals(query)).map((d) => ({ name: d.name, zohoId: d.id, details: { company: d.company, stage: d.stage } }))
    },
    async proposals(deal) {
      if (!deal.zohoId) return []
      return (await dealProposals(deal.zohoId))
        .map((p) => ({ ...parseReference(p.reference), reference: p.reference, dealName: p.dealName || deal.name, zohoId: p.id, status: p.status, lineCount: 0, total: p.total }))
        .sort((a, b) => b.revision - a.revision)
    },
    async boq(proposal) {
      if (!proposal.zohoId) return []
      return (await proposalBoq(proposal.zohoId))
        .map((l) => liveLineToRevisionLine(l, rules, byCode))
        .sort((a, b) => a.current.ref.localeCompare(b.current.ref, 'en', { numeric: true }))
    },
  }
}
