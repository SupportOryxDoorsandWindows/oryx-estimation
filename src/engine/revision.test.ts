import { describe, expect, it } from 'vitest'
import rulesJson from '../../data/pricing-rules.json'
import { calculateLineItem } from './calculate'
import { blankLineItem } from './defaults'
import {
  addItem, cancelItem, parseReference, replaceItem, sizeRevision, snapshot, startRevision, totals, undoLine,
  type RevisionLine,
} from './revision'
import type { PricingRules } from './types'

const rules = rulesJson as PricingRules

// Two accepted lines, priced as in a BOQ: a Fusion F44 window (6,865 each) and a fixed AED 3,000 item.
const f44 = { ...blankLineItem(), ruleId: 'fusion-a', ref: '1', widthMm: 1600, heightMm: 1900, qty: 3, supplierPrice: 600, markup: 3, glassRate: 400, otherCharges: 177 }
const accepted = (): RevisionLine[] => {
  const rate = calculateLineItem(f44, rules).rate
  return [
    { id: 'a', zohoId: 'z1', status: 'original', input: f44,
      original: snapshot({ ref: '1', location: 'Hall', description: 'Fusion F44 Fixed Window', productId: 'p1', widthMm: 1600, heightMm: 1900, panels: 1, qty: 3, rate }),
      current: snapshot({ ref: '1', location: 'Hall', description: 'Fusion F44 Fixed Window', productId: 'p1', widthMm: 1600, heightMm: 1900, panels: 1, qty: 3, rate }) },
    { id: 'b', zohoId: 'z2', status: 'original',
      original: snapshot({ ref: '2', location: 'Study', description: 'Door', productId: '', widthMm: 900, heightMm: 2100, panels: 1, qty: 1, rate: 3000 }),
      current: snapshot({ ref: '2', location: 'Study', description: 'Door', productId: '', widthMm: 900, heightMm: 2100, panels: 1, qty: 1, rate: 3000 }) },
  ]
}
const draft = () => startRevision({ reference: 'P266308R5', base: 'P266308', revision: 5, dealName: 'Test' }, accepted())
const newItem = { ref: '2A', location: 'Study', description: 'Pivot door', productId: '', widthMm: 1000, heightMm: 2400, panels: 1, qty: 1, rate: 4500 }

describe('Revisions', () => {
  it('numbers the next revision above any already used', () => {
    expect(draft().reference).toBe('P266308R6')
    expect(startRevision(draft().source, [], [5, 7]).reference).toBe('P266308R8')
    expect(parseReference('P266534R3')).toEqual({ base: 'P266534', revision: 3 })
  })

  it('starts with the accepted total', () => {
    expect(totals(draft())).toMatchObject({ original: 6865 * 3 + 3000, revised: 6865 * 3 + 3000, variation: 0 })
  })

  it('Cancel Item: qty and value become 0, the line stays with its original', () => {
    const d = cancelItem(draft(), 'b')
    const b = d.lines.find((l) => l.id === 'b')!
    expect(b.status).toBe('cancelled')
    expect(b.current).toMatchObject({ qty: 0, amount: 0 })
    expect(b.original).toMatchObject({ qty: 1, amount: 3000 })
    expect(d.lines).toHaveLength(2)
    expect(totals(d).variation).toBe(-3000)
    expect(d.history[0].text).toMatch(/Cancelled 2/)
  })

  it('Add Item: a new line marked Additional Item, with no original', () => {
    const d = addItem(draft(), newItem)
    const added = d.lines.at(-1)!
    expect(added).toMatchObject({ status: 'additional', current: { amount: 4500 } })
    expect(added.original).toBeUndefined()
    expect(totals(d).variation).toBe(4500)
  })

  it('Replace Item: original zeroed as Replaced Item, new line as Item Replacement, linked both ways', () => {
    const d = replaceItem(draft(), 'b', newItem)
    const old = d.lines.find((l) => l.id === 'b')!
    const repl = d.lines.find((l) => l.replacesId === 'b')!
    expect(old).toMatchObject({ status: 'replaced', replacedById: repl.id, current: { qty: 0, amount: 0 } })
    expect(repl).toMatchObject({ status: 'replacement', current: { amount: 4500 } })
    expect(d.lines.map((l) => l.id).indexOf(repl.id)).toBe(d.lines.map((l) => l.id).indexOf('b') + 1)
    expect(totals(d).variation).toBe(1500)
  })

  it('Size Revision with price change recalculates from the pricing engine', () => {
    const d = sizeRevision(draft(), 'a', 1600, 2100, 'withPrice', rules)
    const a = d.lines.find((l) => l.id === 'a')!
    const expected = calculateLineItem({ ...f44, heightMm: 2100 }, rules).rate
    expect(a).toMatchObject({ status: 'sizeRevised', sizeMode: 'withPrice', current: { heightMm: 2100, rate: expected, amount: expected * 3 } })
    expect(a.original!.heightMm).toBe(1900)
  })

  it('Size Revision without price change keeps the agreed rate and amount', () => {
    const d = sizeRevision(draft(), 'a', 1610, 1905, 'withoutPrice', rules)
    const a = d.lines.find((l) => l.id === 'a')!
    expect(a).toMatchObject({ sizeMode: 'withoutPrice', current: { widthMm: 1610, heightMm: 1905, rate: 6865, amount: 20595 } })
    expect(totals(d).variation).toBe(0)
  })

  it('cannot recalculate a line that has no pricing inputs', () => {
    expect(() => sizeRevision(draft(), 'b', 1000, 2100, 'withPrice', rules)).toThrow(/no pricing inputs/)
  })

  it('does not cancel or replace a line twice', () => {
    const d = cancelItem(draft(), 'b')
    expect(() => cancelItem(d, 'b')).toThrow()
    expect(() => replaceItem(d, 'b', newItem)).toThrow()
  })

  it('Undo restores an original and removes its replacement', () => {
    const replaced = replaceItem(draft(), 'b', newItem)
    const undone = undoLine(replaced, 'b')
    expect(undone.lines).toHaveLength(2)
    expect(undone.lines.find((l) => l.id === 'b')).toMatchObject({ status: 'original', current: { amount: 3000 } })
    const viaReplacement = undoLine(replaced, replaced.lines.find((l) => l.replacesId === 'b')!.id)
    expect(viaReplacement.lines.find((l) => l.id === 'b')!.status).toBe('original')
    expect(undone.history.map((h) => h.action)).toEqual(['replace', 'undo'])
  })

  it('never changes the draft it is given', () => {
    const d = draft()
    const before = structuredClone(d)
    cancelItem(d, 'a'); addItem(d, newItem); replaceItem(d, 'b', newItem); sizeRevision(d, 'a', 1, 1, 'withoutPrice', rules)
    expect(d).toEqual(before)
  })
})
