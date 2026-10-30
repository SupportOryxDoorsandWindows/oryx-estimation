import { calculateLineItem, standardPricingWarning } from '../engine/calculate'
import { applyRuleDefaults, matchRule } from '../engine/defaults'
import { fmtAed, fmtNum } from '../engine/format'
import type { CostMethod, LineItemInput, LineItemResult, PricingRules, Product } from '../engine/types'
import { Card, Field, NumberInput, TextInput, Unconfirmed } from './fields'
import { Icon } from './icons'
import { ProductPicker } from './ProductPicker'
import type { Role } from './storage'

const supplierLabel: Record<CostMethod, string> = {
  aedPerSqm: 'Supplier price (AED/m²)',
  gbp: 'Supplier price (GBP)',
  eur: 'Supplier price (EUR)',
  eurDiscounted: 'Supplier list price (EUR)',
  manual: 'Supplier quote (AED, lump sum)',
}

function Calc({ result, keys }: { result: LineItemResult; keys: string[] }) {
  const rows = result.steps.filter((s) => keys.includes(s.key))
  return (
    <div className="calc" role="table" aria-label="Calculation">
      {rows.map((s) => (
        <div className="calc-row" role="row" key={s.key}>
          <span className="calc-label" role="rowheader">{s.label}</span>
          <span className="calc-formula" role="cell">{s.formula}</span>
          <span className="calc-value" role="cell">{s.key === 'area' ? fmtNum(s.value) : fmtAed(s.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  item: LineItemInput
  onChange: (item: LineItemInput) => void
  rules: PricingRules
  products: Product[]
  role: Role
}

export function LineItemForm({ item, onChange, rules, products, role }: Props) {
  const set = <K extends keyof LineItemInput>(k: K, v: LineItemInput[K]) => onChange({ ...item, [k]: v })
  const product = products.find((p) => p.id === item.productId)
  const rule = rules.rules.find((r) => r.id === item.ruleId) ?? rules.rules[rules.rules.length - 1]
  const result = calculateLineItem(item, rules)
  const unconfirmed = new Set<string>(rules.unconfirmed)
  const stdWarning = product ? standardPricingWarning(result.pricePerSqm, product.standardPricing, rules) : null
  const warnings = [...result.warnings, ...(stdWarning ? [stdWarning] : [])]
  const spDiff = item.salespersonPrice ? item.salespersonPrice - result.rate : null

  const pickProduct = (id: string) => {
    const p = products.find((x) => x.id === id)
    onChange(applyRuleDefaults({ ...item, productId: id }, matchRule(p, rules), rules, p))
  }
  const pickRule = (id: string) => {
    const r = rules.rules.find((x) => x.id === id)
    if (r) onChange(applyRuleDefaults(item, r, rules, product))
  }

  return (
    <div className="estimate-grid">
      <div className="col-main">
        <Card title="Product" id="sec-product">
          <div className="grid">
            <div className="field span-2">
              <span className="field-label">Product</span>
              <ProductPicker products={products} selectedId={item.productId} onPick={pickProduct} />
              <span className="field-hint">{products.length} products. One match is selected automatically.</span>
            </div>
            <Field label="Pricing rule">
              <select value={item.ruleId} onChange={(e) => pickRule(e.target.value)}>
                {rules.rules.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
            <Field label="Ref #"><TextInput value={item.ref} placeholder="e.g. CW01.1" onChange={(v) => set('ref', v)} /></Field>
            <Field label="Location"><TextInput value={item.location} onChange={(v) => set('location', v)} /></Field>
            <Field label="Remarks"><TextInput value={item.remarks} onChange={(v) => set('remarks', v)} /></Field>
          </div>
          {product && (
            <div className="chips">
              <span className="chip">Origin: {product.businessUnit || 'not set'}</span>
              <span className="chip">Fabricator: {product.fabricator || 'not set'}</span>
              {product.type && <span className="chip">{product.type}</span>}
              {product.sizeRange && <span className="chip">{product.sizeRange}</span>}
              <span className="chip">
                Standard Pricing (reference): {product.standardPricing ? `AED ${fmtAed(product.standardPricing)}/m²` : 'not set'}
              </span>
              {unconfirmed.has('warnBelowStandardPricing') && <Unconfirmed />}
              {!!product.installDays && <span className="chip">Est. installation time: {fmtNum(product.installDays)}</span>}
            </div>
          )}
          {product?.remarks && <p className="note">{product.remarks}</p>}
        </Card>

        <Card title="Dimensions" id="sec-dimensions">
          <div className="grid grid-4">
            <Field label="Width (mm)"><NumberInput value={item.widthMm} min={0} suffix="mm" group onChange={(v) => set('widthMm', v)} /></Field>
            <Field label="Height (mm)"><NumberInput value={item.heightMm} min={0} suffix="mm" group onChange={(v) => set('heightMm', v)} /></Field>
            <Field label="No. of panels"><NumberInput value={item.panels} step="1" min={1} stepper onChange={(v) => set('panels', Math.max(1, Math.round(v)))} /></Field>
            <Field label="Qty"><NumberInput value={item.qty} step="1" min={1} stepper onChange={(v) => set('qty', Math.max(1, Math.round(v)))} /></Field>
          </div>
          <Calc result={result} keys={['area']} />
        </Card>

        <Card title="Pricing" id="sec-pricing" aside={rule.label}>
          <div className="grid">
            <Field label={supplierLabel[rule.costMethod]}>
              <NumberInput value={item.supplierPrice} onChange={(v) => set('supplierPrice', v)} />
            </Field>
            <Field
              label="Markup"
              badge={rule.id === 'other' && unconfirmed.has('defaultMarkupOther')}
              hint={role !== 'manager' ? 'Set by the pricing rule. A manager can change it.' : undefined}
            >
              <NumberInput value={item.markup} disabled={role !== 'manager'} onChange={(v) => set('markup', v)} />
            </Field>
            <Field label="Margin change"><NumberInput value={item.marginChange} onChange={(v) => set('marginChange', v)} /></Field>
          </div>
          <Calc result={result} keys={['profileCost', 'profilePrice']} />
        </Card>

        <Card title="Glass" id="sec-glass">
          <div className="grid">
            <Field label="Glass rate (AED/m²)" hint={!rule.glassLine ? `No glass line for ${rule.label}` : undefined}>
              <NumberInput value={item.glassRate} disabled={!rule.glassLine} onChange={(v) => set('glassRate', v)} />
            </Field>
            <Field label="Glass thickness (mm)"><NumberInput value={item.glassThicknessMm} onChange={(v) => set('glassThicknessMm', v)} /></Field>
            <Field label="Glazing spec"><TextInput value={item.glazingSpec} onChange={(v) => set('glazingSpec', v)} /></Field>
          </div>
          <div className="chips">
            <span className="chip">Glass area: full item area</span><Unconfirmed />
            <span className="chip">Weight factor: {fmtNum(rules.settings.glassDensityKgPerSqmPerMm)} kg/m²/mm</span><Unconfirmed />
          </div>
          <Calc result={result} keys={['glassCost', 'glassWeight']} />
        </Card>

        <Card title="Other costs" id="sec-other">
          <div className="grid">
            <Field label="Bonding" badge={unconfirmed.has('bondingDefault')}>
              <select value={item.bondingMode} onChange={(e) => set('bondingMode', e.target.value as LineItemInput['bondingMode'])}>
                <option value="perSqm">Rate per m²</option>
                <option value="amount">Fixed amount</option>
              </select>
            </Field>
            {item.bondingMode === 'perSqm' ? (
              <Field label="Bonding rate (AED/m²)"><NumberInput value={item.bondingRate} onChange={(v) => set('bondingRate', v)} /></Field>
            ) : (
              <Field label="Bonding charges (AED)"><NumberInput value={item.bondingAmount} onChange={(v) => set('bondingAmount', v)} /></Field>
            )}
            <Field
              label="Freight (AED)"
              hint={rule.freight.type === 'perPanel' ? `Default: AED ${fmtAed(rule.freight.value)} per panel` : undefined}
            >
              <NumberInput value={item.freight} onChange={(v) => set('freight', v)} />
            </Field>
            <Field label="Other charges (AED)" badge={unconfirmed.has('warnNegativeOtherCharges')}>
              <NumberInput value={item.otherCharges} onChange={(v) => set('otherCharges', v)} />
            </Field>
            <Field label="Installation (AED)"><NumberInput value={item.installation} onChange={(v) => set('installation', v)} /></Field>
            <Field label="Equipment rental (AED)"><NumberInput value={item.equipmentRental} onChange={(v) => set('equipmentRental', v)} /></Field>
            <Field label="Duties (%)" badge={unconfirmed.has('percentageBase')}>
              <NumberInput value={item.dutiesPercent} onChange={(v) => set('dutiesPercent', v)} />
            </Field>
            <Field label={`Insurance (${fmtNum(rules.settings.insuranceRate * 100)}%)`} badge={unconfirmed.has('insuranceRate')}>
              <select value={item.insuranceEnabled ? 'yes' : 'no'} onChange={(e) => set('insuranceEnabled', e.target.value === 'yes')}>
                <option value="no">Not applied</option>
                <option value="yes">Applied</option>
              </select>
            </Field>
          </div>

          <h3>Accessories</h3>
          {item.accessories.length === 0 && <p className="muted">No accessories added.</p>}
          {item.accessories.map((a, i) => (
            <div className="acc-row" key={i}>
              <TextInput value={a.description} placeholder="Description" onChange={(v) => set('accessories', item.accessories.map((x, j) => (j === i ? { ...x, description: v } : x)))} />
              <NumberInput value={a.cost} onChange={(v) => set('accessories', item.accessories.map((x, j) => (j === i ? { ...x, cost: v } : x)))} />
              <button type="button" className="btn btn-sm" onClick={() => set('accessories', item.accessories.filter((_, j) => j !== i))}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => set('accessories', [...item.accessories, { description: '', cost: 0 }])}>
            <Icon name="plus" size={16} /> Add accessory
          </button>

          <h3>Discount</h3>
          <div className="grid">
            <Field label="Discount (AED)" badge={unconfirmed.has('percentageBase')}>
              <NumberInput
                value={item.discountMode === 'amount' ? item.discountValue : result.discountAmount}
                onChange={(v) => onChange({ ...item, discountMode: 'amount', discountValue: v })}
              />
            </Field>
            <Field label="Discount (%)">
              <NumberInput
                value={item.discountMode === 'percent' ? item.discountValue : Number(result.discountPercent.toFixed(4))}
                onChange={(v) => onChange({ ...item, discountMode: 'percent', discountValue: v })}
              />
            </Field>
          </div>
          <Calc result={result} keys={['bonding', 'freight', 'otherCharges', 'accessories', 'installation', 'equipment', 'insurance', 'duties']} />
        </Card>
      </div>

      <aside className="col-side">
        <section className="card summary" aria-labelledby="sec-summary">
          <div className="card-head">
            <h2 id="sec-summary">Summary</h2>
            <span className="card-aside">{item.ref || 'Unnamed item'}</span>
          </div>
          <div className="card-body">
            <div className="figure">
              <span className="figure-label">Calculated rate (AED)</span>
              <span className="figure-value">{fmtAed(result.rate)}</span>
            </div>
            <div className="figure-row">
              <div className="figure">
                <span className="figure-label">Amount (AED)</span>
                <span className="figure-value sm">{fmtAed(result.amount)}</span>
              </div>
              <div className="figure">
                <span className="figure-label">Price per m² (AED)</span>
                <span className="figure-value sm">{fmtAed(result.pricePerSqm)}</span>
              </div>
            </div>

            <Field label="Salesperson price (AED)" hint="Shown for comparison. It never changes the calculated rate.">
              <NumberInput value={item.salespersonPrice ?? 0} onChange={(v) => set('salespersonPrice', v || null)} />
            </Field>
            {spDiff !== null && (
              <div className={`pill ${spDiff < 0 ? 'pill-red' : 'pill-green'} pill-block`}>
                {spDiff < 0 ? 'Below' : 'Above'} calculated rate by AED {fmtAed(Math.abs(spDiff))}
              </div>
            )}

            {item.zohoAmount != null && (
              <div className={`pill pill-block ${item.zohoAmount === result.amount ? 'pill-green' : 'pill-amber'}`}>
                Zoho amount: AED {fmtAed(item.zohoAmount)}
                {item.zohoAmount === result.amount
                  ? ' (matches)'
                  : ` (${item.zohoAmount > result.amount ? 'above' : 'below'} by AED ${fmtAed(Math.abs(item.zohoAmount - result.amount))}${
                      item.salespersonPrice && item.zohoAmount === item.salespersonPrice * item.qty ? '; Zoho used the salesperson price' : ''
                    })`}
              </div>
            )}

            {warnings.length > 0 && (
              <ul className="warnings">
                {warnings.map((w) => (
                  <li key={w}><Icon name="warning" size={16} /> <span>{w}</span></li>
                ))}
              </ul>
            )}

            <Calc result={result} keys={['subtotal', 'margin', 'discount', 'rate', 'amount', 'pricePerSqm']} />
            <p className="muted small">Rounding: {rules.settings.rounding} on each component <Unconfirmed /></p>
          </div>
        </section>
      </aside>
    </div>
  )
}
