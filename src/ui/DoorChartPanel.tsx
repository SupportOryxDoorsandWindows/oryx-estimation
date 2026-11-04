import { useEffect, useRef, useState } from 'react'
import { doorRate } from '../engine/doorChart'
import { fmtAed, fmtNum } from '../engine/format'
import type { DoorChart } from '../engine/types'
import { DoorChartTable } from './DoorChartTable'

export { isDoorProduct } from '../engine/defaults'

const nearest = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v / 100) * 100))

/** The door price chart inside a line item: this item's rate, a button to use it, and the SQM chart. */
export function DoorChartPanel({ chart, widthMm, heightMm, inUse, pricing, onUse }: {
  chart: DoorChart
  widthMm: number
  heightMm: number
  inUse: boolean
  /** Pricing (AED/m²) typed over the reference, if any. */
  pricing?: number | null
  onUse: () => void
}) {
  const [open, setOpen] = useState(true)
  const box = useRef<HTMLDivElement>(null)
  const r = doorRate(widthMm, heightMm, chart)
  const hasSize = widthMm > 0 && heightMm > 0
  const W = chart.widths, H = chart.heights
  const highlight = hasSize && r.inRange
    ? { widthMm: nearest(widthMm, W[0], W.at(-1)!), heightMm: nearest(heightMm, H[0], H.at(-1)!) }
    : undefined

  // Keep this door's size in view inside the scrolling chart.
  useEffect(() => {
    const el = box.current
    const cell = el?.querySelector<HTMLElement>('td.on')
    if (el && cell) el.scrollTop = Math.max(0, cell.offsetTop - el.clientHeight / 2)
  }, [open, highlight?.widthMm, highlight?.heightMm])

  return (
    <div className="door-panel">
      <div className="door-panel-head">
        <div>
          <span className="field-label">{chart.label} price chart</span>
          <div className="door-panel-rate">
            {!hasSize ? (
              <span className="muted small">Enter the width and height to see this door's rate.</span>
            ) : r.inRange ? (
              <>
                <strong>AED {fmtAed(Math.round(r.rate))}/m²</strong>
                <span className="muted small"> for {fmtNum(widthMm)} × {fmtNum(heightMm)} mm, between {fmtNum(r.widthLow)}–{fmtNum(r.widthHigh)} W and {fmtNum(r.heightLow)}–{fmtNum(r.heightHigh)} H</span>
              </>
            ) : (
              <span className="pill pill-amber">{fmtNum(widthMm)} × {fmtNum(heightMm)} mm is outside the chart (W {fmtNum(W[0])}–{fmtNum(W.at(-1)!)}, H {fmtNum(H[0])}–{fmtNum(H.at(-1)!)} mm). Refer to Production.</span>
            )}
          </div>
        </div>
        <div className="door-panel-actions">
          {inUse
            ? <span className="pill pill-green">{pricing ? `Using your Pricing: AED ${fmtAed(pricing)}/m²` : 'Using the chart rate'}</span>
            : <button type="button" className="btn btn-sm" disabled={!hasSize || !r.inRange} onClick={onUse}>Use this rate</button>}
          <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide chart' : 'Show chart'}</button>
        </div>
      </div>
      {open && (
        <>
          <div className="door-panel-table" ref={box}><DoorChartTable chart={chart} highlight={highlight} /></div>
          <p className="muted small">AED/m², 100 mm steps. Shaded rows and columns are costed sizes; others are interpolated. {highlight && 'The outlined value is the nearest step to this door.'}</p>
        </>
      )}
    </div>
  )
}
