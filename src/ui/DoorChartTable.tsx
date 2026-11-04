import { chartSizes, doorRate } from '../engine/doorChart'
import { fmtAed, fmtNum } from '../engine/format'
import type { DoorChart } from '../engine/types'

/**
 * The SQM price chart (AED/m²) in 100 mm steps. Costed rows and columns are shaded.
 * `highlight` marks one size; `onPick` makes the values clickable.
 */
export function DoorChartTable({ chart, highlight, onPick }: {
  chart: DoorChart
  highlight?: { widthMm: number; heightMm: number }
  onPick?: (widthMm: number, heightMm: number) => void
}) {
  const sizes = chartSizes(chart)
  const costedW = new Set(chart.widths)
  const costedH = new Set(chart.heights)
  return (
    <table className="table door-chart">
      <thead>
        <tr><th>H \ W (mm)</th>{sizes.widths.map((w) => <th key={w} className={`num ${costedW.has(w) ? 'costed' : ''}`}>{fmtNum(w)}</th>)}</tr>
      </thead>
      <tbody>
        {sizes.heights.map((h) => (
          <tr key={h}>
            <th className={costedH.has(h) ? 'costed' : ''}>{fmtNum(h)}</th>
            {sizes.widths.map((w) => {
              const on = !!highlight && w === highlight.widthMm && h === highlight.heightMm
              const value = fmtAed(Math.round(doorRate(w, h, chart).rate))
              return (
                <td key={w} className={`num ${costedW.has(w) || costedH.has(h) ? 'costed' : ''} ${on ? 'on' : ''}`}>
                  {onPick
                    ? <button type="button" className="cell-btn" onClick={() => onPick(w, h)}>{value}</button>
                    : <span className="cell-val">{value}</span>}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
