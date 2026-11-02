import { useState } from 'react'
import { chartSizes, doorRate } from '../engine/doorChart'
import { fmtAed, fmtNum } from '../engine/format'
import type { DoorChart } from '../engine/types'
import { Card, Field, NumberInput } from './fields'
import type { Role } from './storage'

interface Props {
  chart: DoorChart
  onChange: (c: DoorChart) => void
  role: Role
}

export function DoorChartScreen({ chart, onChange, role }: Props) {
  const [width, setWidth] = useState(950)
  const [height, setHeight] = useState(2750)
  const r = doorRate(width, height, chart)
  const area = (width * height) / 1_000_000
  const sizes = chartSizes(chart)
  const costedW = new Set(chart.widths)
  const costedH = new Set(chart.heights)
  const canEdit = role === 'manager'
  const minW = chart.widths[0], maxW = chart.widths.at(-1)!, minH = chart.heights[0], maxH = chart.heights.at(-1)!
  const setRate = (hi: number, wi: number, v: number) =>
    onChange({ ...chart, rates: chart.rates.map((row, i) => (i === hi ? row.map((x, j) => (j === wi ? v : x)) : row)) })

  return (
    <div className="stack">
      <div className="estimate-grid">
        <div className="col-main">
          <Card title="Price lookup" aside={`Valid for W ${fmtNum(minW)}–${fmtNum(maxW)} mm, H ${fmtNum(minH)}–${fmtNum(maxH)} mm`}>
            <div className="grid grid-4">
              <Field label="Width (mm)"><NumberInput value={width} min={0} suffix="mm" group onChange={setWidth} /></Field>
              <Field label="Height (mm)"><NumberInput value={height} min={0} suffix="mm" group onChange={setHeight} /></Field>
            </div>
            {r.inRange ? (
              <div className="calc" role="table" aria-label="Workings">
                <div className="calc-row"><span className="calc-label">Width between</span><span className="calc-formula">{fmtNum(r.widthLow)} and {fmtNum(r.widthHigh)} mm: factor ({fmtNum(width)} − {fmtNum(r.widthLow)}) ÷ {fmtNum(r.widthHigh - r.widthLow)}</span><span className="calc-value">{fmtNum(r.widthFactor)}</span></div>
                <div className="calc-row"><span className="calc-label">Height between</span><span className="calc-formula">{fmtNum(r.heightLow)} and {fmtNum(r.heightHigh)} mm: factor ({fmtNum(height)} − {fmtNum(r.heightLow)}) ÷ {fmtNum(r.heightHigh - r.heightLow)}</span><span className="calc-value">{fmtNum(r.heightFactor)}</span></div>
                <div className="calc-row"><span className="calc-label">Costed rates (AED/m²)</span><span className="calc-formula">{fmtNum(r.heightLow)} H: {fmtNum(r.corners[0])} / {fmtNum(r.corners[1])} · {fmtNum(r.heightHigh)} H: {fmtNum(r.corners[2])} / {fmtNum(r.corners[3])}</span><span className="calc-value" /></div>
                <div className="calc-row"><span className="calc-label">Base rate (AED/m²)</span><span className="calc-formula">(1 − {fmtNum(r.heightFactor)}) × ((1 − {fmtNum(r.widthFactor)}) × {fmtNum(r.corners[0])} + {fmtNum(r.widthFactor)} × {fmtNum(r.corners[1])}) + {fmtNum(r.heightFactor)} × ((1 − {fmtNum(r.widthFactor)}) × {fmtNum(r.corners[2])} + {fmtNum(r.widthFactor)} × {fmtNum(r.corners[3])})</span><span className="calc-value">{fmtNum(Math.round(r.baseRate * 100) / 100)}</span></div>
                {chart.markupOnBase !== 0 && (
                  <div className="calc-row"><span className="calc-label">With markup on base</span><span className="calc-formula">{fmtNum(r.baseRate)} × (1 + {fmtNum(chart.markupOnBase)})</span><span className="calc-value">{fmtNum(Math.round(r.rate * 100) / 100)}</span></div>
                )}
                <div className="calc-row"><span className="calc-label">Door area (m²)</span><span className="calc-formula">{fmtNum(width)} × {fmtNum(height)} ÷ 1,000,000</span><span className="calc-value">{fmtNum(area)}</span></div>
              </div>
            ) : (
              <ul className="warnings"><li>Outside {fmtNum(minW)}–{fmtNum(maxW)} × {fmtNum(minH)}–{fmtNum(maxH)} mm. Refer to Production.</li></ul>
            )}
          </Card>
        </div>
        <aside className="col-side">
          <section className="card summary" aria-labelledby="door-result">
            <div className="card-head"><h2 id="door-result">{chart.label}</h2><span className="card-aside">{fmtNum(width)} × {fmtNum(height)} mm</span></div>
            <div className="card-body">
              <div className="figure">
                <span className="figure-label">Price per m² (AED)</span>
                <span className="figure-value">{r.inRange ? fmtAed(Math.round(r.rate)) : '–'}</span>
              </div>
              <div className="figure-row">
                <div className="figure"><span className="figure-label">Door area (m²)</span><span className="figure-value sm">{fmtNum(Math.round(area * 1000) / 1000)}</span></div>
                <div className="figure"><span className="figure-label">Price per door (AED)</span><span className="figure-value sm">{r.inRange ? fmtAed(Math.round(r.rate * area)) : '–'}</span></div>
              </div>
              <p className="muted small">To use this in an estimate, set <strong>Supplier price from</strong> to <em>Door price chart</em> in a line item's Pricing section. The rate then follows that item's width and height.</p>
            </div>
          </section>
        </aside>
      </div>

      <Card title="SQM price chart (AED/m²)" aside="Shaded rows and columns are costed sizes; others are interpolated. Click a value to look it up.">
        <div className="table-wrap">
          <table className="table door-chart">
            <thead>
              <tr><th>H \ W (mm)</th>{sizes.widths.map((w) => <th key={w} className={`num ${costedW.has(w) ? 'costed' : ''}`}>{fmtNum(w)}</th>)}</tr>
            </thead>
            <tbody>
              {sizes.heights.map((h) => (
                <tr key={h}>
                  <th className={costedH.has(h) ? 'costed' : ''}>{fmtNum(h)}</th>
                  {sizes.widths.map((w) => {
                    const on = w === width && h === height
                    return (
                      <td key={w} className={`num ${costedW.has(w) || costedH.has(h) ? 'costed' : ''} ${on ? 'on' : ''}`}>
                        <button type="button" className="cell-btn" onClick={() => { setWidth(w); setHeight(h) }}>{fmtAed(Math.round(doorRate(w, h, chart).rate))}</button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Base rates (AED/m²)" aside={canEdit ? 'Edit a rate and the chart and estimates update' : 'A manager can edit these'}>
        <p className="muted small">{chart.source}</p>
        <div className="table-wrap">
          <table className="table rules">
            <thead><tr><th>H \ W (mm)</th>{chart.widths.map((w) => <th key={w} className="num">{fmtNum(w)}</th>)}</tr></thead>
            <tbody>
              {chart.heights.map((h, hi) => (
                <tr key={h}>
                  <th>{fmtNum(h)}</th>
                  {chart.widths.map((w, wi) => (
                    <td key={w}><NumberInput value={chart.rates[hi][wi]} min={0} disabled={!canEdit} onChange={(v) => setRate(hi, wi, v)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-4">
          <Field label="Markup on base rate (%)" hint="Added to every chart rate. The line item's own markup still applies in an estimate.">
            <NumberInput value={Math.round(chart.markupOnBase * 10000) / 100} disabled={!canEdit} onChange={(v) => onChange({ ...chart, markupOnBase: v / 100 })} />
          </Field>
        </div>
      </Card>
    </div>
  )
}
