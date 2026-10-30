import { describe, expect, it } from 'vitest'
import { blankLineItem } from '../engine/defaults'
import { blankProposal } from './proposal'
import { createRevision } from './revision'
import type { Estimate } from './storage'

const r3: Estimate = {
  id: 'zoho-P266534R3',
  name: 'P266534R3 – OC00000 Test deal',
  createdAt: '2026-10-30T09:00:00.000Z',
  updatedAt: '2026-10-30T09:00:00.000Z',
  items: [{ ...blankLineItem(), ref: 'W1', widthMm: 1000, accessories: [{ description: 'Handle', cost: 100 }] }],
  details: { ...blankProposal(), dealName: 'Test deal', proposalReference: 'P266534R3', revisionNumber: 3, address: 'Dubai' },
}

describe('Create revision', () => {
  it('turns R3 into R4 and keeps the details and items', () => {
    const r4 = createRevision(r3, [r3])
    expect(r4.name).toBe('P266534R4 – OC00000 Test deal')
    expect(r4.details).toEqual({ ...r3.details, proposalReference: 'P266534R4', revisionNumber: 4 })
    expect(r4.items).toEqual(r3.items)
    expect(r4.id).not.toBe(r3.id)
  })

  it('leaves the original untouched', () => {
    const before = structuredClone(r3)
    const r4 = createRevision(r3, [r3])
    r4.items[0].accessories[0].cost = 999
    expect(r3).toEqual(before)
  })

  it('never reuses a revision number', () => {
    const r4 = createRevision(r3, [r3])
    expect(createRevision(r3, [r3, r4]).details.proposalReference).toBe('P266534R5')
  })

  it('reads the revision from the name when the reference is empty', () => {
    const old = { ...r3, details: { ...r3.details, proposalReference: '' } }
    expect(createRevision(old, [old]).details.proposalReference).toBe('P266534R4')
  })

  it('numbers estimates without a proposal reference from the Revision Number', () => {
    const plain = { ...r3, name: 'Villa 12', details: { ...blankProposal(), revisionNumber: 0 } }
    const next = createRevision(plain, [plain])
    expect(next.name).toBe('Villa 12 (Revision 1)')
    expect(createRevision(next, [plain, next]).name).toBe('Villa 12 (Revision 2)')
  })
})
