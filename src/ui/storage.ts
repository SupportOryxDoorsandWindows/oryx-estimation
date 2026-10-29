import seedRules from '../../data/pricing-rules.json'
import seedProducts from '../../data/products.json'
import { blankLineItem } from '../engine/defaults'
import type { LineItemInput, PricingRules, Product } from '../engine/types'

export interface Estimate {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  items: LineItemInput[]
}

export type Role = 'estimator' | 'manager'

const KEYS = {
  rules: 'oryx-est:rules',
  products: 'oryx-est:products',
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
  return { id: crypto.randomUUID(), name: 'New estimate', createdAt: now, updatedAt: now, items: [blankLineItem()] }
}

/** Fills fields missing from older saved items so the engine always gets a full input. */
export const normaliseItem = (i: Partial<LineItemInput>): LineItemInput => ({ ...blankLineItem(), ...i })

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function pickJson(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file selected'))
      try {
        resolve(JSON.parse(await file.text()))
      } catch {
        reject(new Error('The file is not valid JSON'))
      }
    }
    input.click()
  })
}
