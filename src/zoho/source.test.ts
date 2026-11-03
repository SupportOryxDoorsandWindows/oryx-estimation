import { describe, expect, it } from 'vitest'
import { isAccepted } from './source'

describe('Accepted proposals', () => {
  it('lists only "Accepted by the Client"', () => {
    expect(isAccepted('Accepted by the Client')).toBe(true)
    expect(isAccepted(' accepted by the client ')).toBe(true)
  })

  it('does not list replaced or unfinished proposals', () => {
    expect(isAccepted('Replaced Accepted Proposal')).toBe(false)
    expect(isAccepted('Work in Progress')).toBe(false)
    expect(isAccepted('Not Started')).toBe(false)
  })
})
