import { describe, expect, it } from 'vitest'
import rulesJson from '../../data/pricing-rules.json'
import { addItem, cancelItem, replaceItem, sizeRevision, snapshot, startRevision, type RevisionLine } from '../engine/revision'
import type { PricingRules } from '../engine/types'
import { revisionSheets } from './revisionWorkbook'

const rules = rulesJson as PricingRules
const line = (id: string, ref: string, rate: number, qty = 1): RevisionLine => {
  const s = snapshot({ ref, location: 'Hall', description: `Item ${ref}`, productId: '', widthMm: 1000, heightMm: 2000, panels: 1, qty, rate })
  return { id, zohoId: `z${id}`, status: 'original', original: s, current: { ...s } }
}

describe('Revision export', () => {
  it('lists original and revised values, links and totals', () => {
    let d = startRevision({ reference: 'P1R2', base: 'P1', revision: 2, dealName: 'Deal' }, [line('a', '1', 1000, 2), line('b', '2', 500), line('c', '3', 800)])
    d = cancelItem(d, 'a')
    d = replaceItem(d, 'b', { ref: '2R', location: 'Hall', description: 'New', productId: '', widthMm: 900, heightMm: 2000, panels: 1, qty: 1, rate: 700 })
    d = sizeRevision(d, 'c', 1010, 2000, 'withoutPrice', rules)
    d = addItem(d, { ref: '4', location: 'Hall', description: 'Extra', productId: '', widthMm: 600, heightMm: 600, panels: 1, qty: 2, rate: 100 })

    const [summary, boq, history] = revisionSheets(d)
    const h = boq.data[0] as string[]
    const row = (ref: string) => boq.data.find((r) => r[h.indexOf('Ref #')] === ref)!
    const col = (r: unknown[], name: string) => r[h.indexOf(name)]

    expect(col(row('1'), 'Status')).toBe('Cancelled Item')
    expect([col(row('1'), 'Original amount (AED)'), col(row('1'), 'Revised amount (AED)'), col(row('1'), 'Difference (AED)')]).toEqual([2000, 0, -2000])
    expect(col(row('2'), 'Replaced by')).toBe('2R')
    expect(col(row('2R'), 'Replaces')).toBe('2')
    expect(col(row('3'), 'Size revision')).toBe('Without price change')
    expect(col(row('4'), 'Status')).toBe('Additional Item')
    expect(col(row('1'), 'Zoho BOQ ID')).toBe('za')
    expect(summary.data).toContainEqual(['This revision', 'P1R3'])
    expect(summary.data).toContainEqual(['Variation (AED)', -2000 + 200 + 200])
    expect(history.data).toHaveLength(5)
  })
})
