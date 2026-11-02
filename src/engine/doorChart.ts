import type { DoorChart } from './types'

export interface DoorRate {
  inRange: boolean
  /** AED/m² after the markup on base rate. 0 when out of range. */
  rate: number
  /** Interpolated base rate before markup. */
  baseRate: number
  widthLow: number
  widthHigh: number
  heightLow: number
  heightHigh: number
  widthFactor: number
  heightFactor: number
  /** Rates at [low height, low width], [low, high], [high, low], [high, high]. */
  corners: [number, number, number, number]
}

/** Index of the costed segment holding `v` (like Excel MATCH(v, list, 1), capped at the last segment). */
function segment(v: number, list: number[]): number {
  let i = 0
  while (i < list.length - 2 && v >= list[i + 1]) i++
  return i
}

/**
 * Bilinear interpolation between the four nearest costed sizes, as in the
 * Single Door Order Estimator (Price Lookup and SQM Price Chart tabs).
 */
export function doorRate(widthMm: number, heightMm: number, chart: DoorChart): DoorRate {
  const { widths: W, heights: H, rates: R } = chart
  const inRange = widthMm >= W[0] && widthMm <= W[W.length - 1] && heightMm >= H[0] && heightMm <= H[H.length - 1]
  const wi = segment(widthMm, W)
  const hi = segment(heightMm, H)
  const widthFactor = (widthMm - W[wi]) / (W[wi + 1] - W[wi])
  const heightFactor = (heightMm - H[hi]) / (H[hi + 1] - H[hi])
  const corners: DoorRate['corners'] = [R[hi][wi], R[hi][wi + 1], R[hi + 1][wi], R[hi + 1][wi + 1]]
  const [a, b, c, d] = corners
  const baseRate =
    (1 - heightFactor) * ((1 - widthFactor) * a + widthFactor * b) + heightFactor * ((1 - widthFactor) * c + widthFactor * d)
  return {
    inRange,
    rate: inRange ? baseRate * (1 + chart.markupOnBase) : 0,
    baseRate: inRange ? baseRate : 0,
    widthLow: W[wi], widthHigh: W[wi + 1], heightLow: H[hi], heightHigh: H[hi + 1],
    widthFactor, heightFactor, corners,
  }
}

/** Sizes for the SQM price chart: every `step` mm across the costed range. */
export function chartSizes(chart: DoorChart, step = 100) {
  const range = (lo: number, hi: number) => Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step)
  return { widths: range(chart.widths[0], chart.widths.at(-1)!), heights: range(chart.heights[0], chart.heights.at(-1)!) }
}
