import type { Estimate } from './storage'

// Oryx proposal references look like P266534R3: proposal P266534, revision 3.
const REF = /\b(P\d+)R(\d+)\b/i

/** Proposal base and revision of an estimate, from its proposal reference or else its name. */
export function revisionOf(e: Estimate): { base: string; revision: number } | null {
  const m = String(e.details?.proposalReference ?? '').match(REF) ?? e.name.match(REF)
  return m ? { base: m[1].toUpperCase(), revision: Number(m[2]) } : null
}

/**
 * A copy of `source` as the next revision. The number is one above the highest revision of
 * the same proposal in `all`, so creating twice from R3 gives R4 and then R5.
 */
export function createRevision(source: Estimate, all: Estimate[]): Estimate {
  const now = new Date().toISOString()
  const copy: Estimate = structuredClone(source)
  const parsed = revisionOf(source)

  let next: number
  if (parsed) {
    const taken = all.map(revisionOf).filter((r) => r?.base === parsed.base).map((r) => r!.revision)
    next = Math.max(parsed.revision, ...taken) + 1
    const ref = `${parsed.base}R${next}`
    const swap = (s: string) => s.replace(REF, ref)
    copy.name = REF.test(copy.name) ? swap(copy.name) : `${copy.name} – ${ref}`
    copy.details.proposalReference = ref
  } else {
    next = Number(source.details?.revisionNumber ?? 0) + 1
    copy.name = `${source.name.replace(/\s*\(Revision \d+\)$/, '')} (Revision ${next})`
  }
  copy.details.revisionNumber = next
  return { ...copy, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
}
