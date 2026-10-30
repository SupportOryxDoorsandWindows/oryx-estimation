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

export const loadRules = () => read<PricingRules>(KEYS.rules, defaultRules())
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
export const normaliseItem = (i: Partial<LineItemInput>): LineItemInput => ({ ...blankLineItem(), ...i })

/** Fills fields missing from older saved estimates (before proposal details existed). */
export const normaliseEstimate = (e: Estimate): Estimate => ({
  ...e,
  items: e.items.map(normaliseItem),
  details: { ...blankProposal(), ...(e.details ?? {}) },
})
