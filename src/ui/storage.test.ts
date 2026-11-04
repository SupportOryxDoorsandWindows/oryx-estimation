import { describe, expect, it } from 'vitest'
import { defaultRules, migrateRules } from './storage'

describe('Saved pricing rules', () => {
  it('moves the default markup from 2.5 to 2.85 in rules saved before the change', () => {
    const old = defaultRules()
    old.version = 1
    old.settings.defaultMarkupOther = 2.5
    old.rules.find((r) => r.id === 'other')!.markup = 2.5
    old.unconfirmed.push('defaultMarkupOther')
    const r = migrateRules(old, defaultRules())
    expect(r.settings.defaultMarkupOther).toBe(2.85)
    expect(r.rules.find((x) => x.id === 'other')!.markup).toBe(2.85)
    expect(r.unconfirmed).not.toContain('defaultMarkupOther')
    expect(r.version).toBe(3)
  })

  it('marks glass area, weight factor, negative other charges and the discount base as confirmed', () => {
    const old = defaultRules()
    old.version = 2
    old.unconfirmed = ['rounding', 'glassAreaBasis', 'glassDensityKgPerSqmPerMm', 'warnNegativeOtherCharges', 'percentageBase', 'insuranceRate', 'warnBelowStandardPricing']
    expect(migrateRules(old, defaultRules()).unconfirmed).toEqual(['rounding', 'warnBelowStandardPricing'])
  })

  it('keeps a markup the user changed themselves', () => {
    const old = defaultRules()
    old.version = 1
    old.settings.defaultMarkupOther = 3
    expect(migrateRules(old, defaultRules()).settings.defaultMarkupOther).toBe(3)
  })
})
