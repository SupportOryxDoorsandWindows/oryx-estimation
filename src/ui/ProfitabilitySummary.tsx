import { fmtAed } from '../engine/format'
import {
  COST_CATEGORIES, OTHER_PARTS, marginLabel, markupLabel, type Profitability,
} from '../engine/profitability'

/**
 * Project Profitability Summary: estimated selling price, cost, profit and margin for the
 * whole estimate. Figures come from projectProfitability() (src/engine/profitability.ts),
 * worked out from the same line-item results as the Line items table, so they update with
 * every change. Estimated only: actual project costs are kept apart.
 */
export function ProfitabilitySummary({ p, onExport }: { p: Profitability; onExport: () => void }) {
  const loss = p.profit < 0
  const tone = p.marginPercent === null ? '' : loss ? 'neg' : 'pos'
  const signed = (v: number) => (v < 0 ? `−${fmtAed(-v)}` : fmtAed(v))

  return (
    <section className="card profit" aria-labelledby="sec-profit">
      <div className="card-head">
        <h2 id="sec-profit">Project Profitability Summary</h2>
        <span className="card-aside">Estimated · {p.itemCount} {p.itemCount === 1 ? 'line item' : 'line items'}</span>
      </div>
      <div className="card-body">
        <div className="profit-figures">
          <div className="profit-figure">
            <span className="figure-label">Selling price (AED)</span>
            <span className="profit-value">{fmtAed(p.sellingPrice)}</span>
            <span className="field-hint">Charged to the client, after markup and discounts</span>
          </div>
          <div className="profit-figure">
            <span className="figure-label">Total estimated cost (AED)</span>
            <span className="profit-value">{fmtAed(p.totalCost)}</span>
            <span className="field-hint">What the project costs us, before markup</span>
          </div>
          <div className={`profit-figure highlight ${tone}`}>
            <span className="figure-label">Estimated profit (AED)</span>
            <span className="profit-value" data-testid="profit">{signed(p.profit)}</span>
            <span className="field-hint">Selling price − total estimated cost</span>
          </div>
          <div className={`profit-figure highlight ${tone}`}>
            <span className="figure-label">Profit margin</span>
            <span className="profit-value" data-testid="margin">{marginLabel(p.marginPercent)}</span>
            <span className="field-hint">{p.marginPercent === null ? 'Shown once there is a selling price' : 'Estimated profit ÷ selling price × 100'}</span>
          </div>
        </div>

        {loss && <div className="pill pill-red pill-block">The estimated cost is higher than the selling price. Check the markup and discounts.</div>}

        <div className="profit-tables">
          <div>
            <h3>Cost breakdown</h3>
            <table className="table profit-table">
              <tbody>
                {COST_CATEGORIES.map((c) => (
                  <FragmentRows key={c.key} label={c.label} value={p.costs[c.key]}
                    sub={c.key === 'other' ? OTHER_PARTS.filter((o) => p.otherParts[o.key]).map((o) => [o.label, p.otherParts[o.key]] as const) : []} />
                ))}
              </tbody>
              <tfoot>
                <tr><td>Total estimated cost</td><td className="num strong">{fmtAed(p.totalCost)}</td></tr>
              </tfoot>
            </table>
          </div>
          <div>
            <h3>Price build-up</h3>
            <table className="table profit-table">
              <tbody>
                <tr><td>Total estimated cost</td><td className="num">{fmtAed(p.totalCost)}</td></tr>
                <tr><td>Markup on profile <span className="muted small">{markupLabel(p.markups)}</span></td><td className="num">{signed(p.markupAmount)}</td></tr>
                {p.dualColour !== 0 && <tr><td>Dual colour</td><td className="num">{signed(p.dualColour)}</td></tr>}
                {p.marginChangeAmount !== 0 && <tr><td>Margin change</td><td className="num">{signed(p.marginChangeAmount)}</td></tr>}
                <tr><td>Discounts</td><td className="num">{p.discount ? signed(-p.discount) : '0'}</td></tr>
                {p.priceReductions !== 0 && (
                  <tr><td>Negative other charges <span className="muted small">reduce the price, not a cost</span></td><td className="num">{signed(-p.priceReductions)}</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr><td>Selling price</td><td className="num strong">{fmtAed(p.sellingPrice)}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="profit-foot">
          <p className="muted small">Estimated from this proposal's pricing. It is not the actual project profitability.</p>
          <button type="button" className="btn btn-sm" onClick={onExport}>Export to Excel</button>
        </div>
      </div>
    </section>
  )
}

function FragmentRows({ label, value, sub }: { label: string; value: number; sub: readonly (readonly [string, number])[] }) {
  return (
    <>
      <tr><td>{label}</td><td className="num">{fmtAed(value)}</td></tr>
      {sub.map(([l, v]) => (
        <tr key={l} className="profit-sub"><td>{l}</td><td className="num">{fmtAed(v)}</td></tr>
      ))}
    </>
  )
}
