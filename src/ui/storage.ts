import seedRules from '../../data/pricing-rules.json'
import seedProducts from '../../data/products.json'
import { blankLineItem } from '../engine/defaults'
import type { LineItemInput, PricingRules, Product } from '../engine/types'
import { blankProposal, type ProposalDetails } from './proposal'

export interface Estimate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  items: LineItemInput[]
  details: ProposalDetails
}

export type Role = 'estimator' | 'manager'

const KEYS = {
  rules: 'oryx-est:rules',
  // v2: the full Zoho list. Older saves held a one-product placeholder.
  products: 'oryx-est:products:v2',
  estimates: 'oryx-est:estimates',
  role: 'oryx-est:role',
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private window, quota). The app keeps working in memory.
  }
}

export const defaultRules = () => structuredClone(seedRules) as PricingRules
export const defaultProducts = () => structuredClone(seedProducts.products) as Product[]

/** Saved rules, with anything added since they were saved (new settings, the door chart) filled from the defaults. */
export const loadRules = (): PricingRules => {
  const seed = defaultRules()
  const saved = read<Partial<PricingRules>>(KEYS.rules, seed)
  return migrateRules({ ...seed, ...saved, settings: { ...seed.settings, ...saved.settings }, doorChart: saved.doorChart ?? seed.doorChart }, seed)
}

/** Brings rules saved under an older version up to date, keeping anything the user changed. */
export function migrateRules(rules: PricingRules, seed: PricingRules): PricingRules {
  const from = rules.version ?? 1
  if (from >= seed.version) return rules
  const r = structuredClone(rules)
  if (from < 2) {
    // v2: markup for products outside the pricing sheet 2.5 → 2.85, now confirmed.
    if (r.settings.defaultMarkupOther === 2.5) r.settings.defaultMarkupOther = 2.85
    const other = r.rules.find((x) => x.id === 'other')
    if (other && other.markup === 2.5) other.markup = 2.85
    r.unconfirmed = r.unconfirmed.filter((k) => k !== 'defaultMarkupOther')
  }
  if (from < 3) {
    // v3: glass area, glass weight factor, negative other charges and the discount % base confirmed;
    // the bonding default, curtain wall bonding rate and insurance rate are no longer settings.
    const gone = ['glassAreaBasis', 'glassDensityKgPerSqmPerMm', 'warnNegativeOtherCharges', 'percentageBase', 'curtainWallBondingRate', 'bondingDefault', 'insuranceRate']
    r.unconfirmed = r.unconfirmed.filter((k) => !gone.includes(k))
  }
  if (from < 4) {
    // v4: manpower charges default to 20% of the profile cost (Production, 5 Nov 2026), not yet confirmed.
    if (!r.unconfirmed.includes('manpowerRate')) r.unconfirmed = [...r.unconfirmed, 'manpowerRate']
  }
  return { ...r, version: seed.version }
}
export const saveRules = (r: PricingRules) => write(KEYS.rules, r)
export const loadProducts = () => read<Product[]>(KEYS.products, defaultProducts())
export const saveProducts = (p: Product[]) => write(KEYS.products, p)
export const loadEstimates = () => read<Estimate[]>(KEYS.estimates, [])
export const saveEstimates = (e: Estimate[]) => write(KEYS.estimates, e)
export const loadRole = () => read<Role>(KEYS.role, 'estimator')
export const saveRole = (r: Role) => write(KEYS.role, r)

export function newEstimate(): Estimate {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: 'New estimate', createdAt: now, updatedAt: now, items: [blankLineItem()], details: blankProposal() }
}

/** Fills fields missing from older saved items so the engine always gets a full input. */
export const normaliseItem = (i: Partial<LineItemInput>): LineItemInput => ({
  ...blankLineItem(),
  // Items saved before the 20% manpower default keep the manpower that was typed in (often none).
  ...(i.manpowerManual === undefined ? { manpowerManual: true } : {}),
  ...i,
})

/** Fills fields missing from older saved estimates (before proposal details existed). */
export const normaliseEstimate = (e: Estimate): Estimate => ({
  ...e,
  items: e.items.map(normaliseItem),
  // Keep only current fields, so removed ones (e.g. OC Generated) drop out of older saves.
  details: Object.fromEntries(
    Object.entries(blankProposal()).map(([k, v]) => [k, e.details && k in e.details ? e.details[k] : v]),
  ),
})
