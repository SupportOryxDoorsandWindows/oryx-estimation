import { calculateLineItem, standardPricingWarning } from '../engine/calculate'
import { applyRuleDefaults, matchRule } from '../engine/defaults'
import { fmtAed, fmtNum } from '../engine/format'
import type { CostMethod, LineItemInput, LineItemResult, PricingRules, Product } from '../engine/types'
import { Field, NumberInput, Section, TextInput, Unconfirmed } from './fields'
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
    <table className="calc">
      <tbody>
        {rows.map((s) => (
          <tr key={s.key}>
            <th>{s.label}</th>
            <td className="formula">{s.formula}</td>
            <td className="value">{s.key === 'area' ? fmtNum(s.value) : fmtAed(s.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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

  const pickProduct = (id: string) => {
    const p = products.find((x) => x.id === id)
    onChange(applyRuleDefaults({ ...item, productId: id }, matchRule(p, rules), rules, p))
  }
  const pickRule = (id: string) => {
    const r = rules.rules.find((x) => x.id === id)
    if (r) onChange(applyRuleDefaults(item, r, rules, product))
  }

  return (
    <div className="form">
      <Section title="Product">
        <div className="grid">
          <Field label="Product">
            <select value={item.productId} onChange={(e) => pickProduct(e.target.value)}>
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.businessUnit, p.fabricator, p.name].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pricing rule">
            <select value={item.ruleId} onChange={(e) => pickRule(e.target.value)}>
              {rules.rules.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Ref #"><TextInput value={item.ref} onChange={(v) => set('ref', v)} /></Field>
          <Field label="Location"><TextInput value={item.location} onChange={(v) => set('location', v)} /></Field>
          <Field label="Remarks"><TextInput value={item.remarks} onChange={(v) => set('remarks', v)} /></Field>
        </div>
        {product && (
          <p className="meta">
            {product.productCode} · {product.type}
            {product.sizeRange && ` · ${product.sizeRange}`}
            {' · '}Standard Pricing (reference): {product.standardPricing ? `AED ${fmtAed(product.standardPricing)}/m²` : 'not set'}
            {unconfirmed.has('warnBelowStandardPricing') && <> <Unconfirmed /></>}
          </p>
        )}
      </Section>

      <Section title="Dimensions">
        <div className="grid">
          <Field label="Width (mm)"><NumberInput value={item.widthMm} min={0} onChange={(v) => set('widthMm', v)} /></Field>
          <Field label="Height (mm)"><NumberInput value={item.heightMm} min={0} onChange={(v) => set('heightMm', v)} /></Field>
          <Field label="No. of panels"><NumberInput value={item.panels} step="1" min={1} onChange={(v) => set('panels', Math.max(1, Math.round(v)))} /></Field>
          <Field label="Qty"><NumberInput value={item.qty} step="1" min={1} onChange={(v) => set('qty', Math.max(1, Math.round(v)))} /></Field>
        </div>
        <Calc result={result} keys={['area']} />
      </Section>

      <Section title="Pricing">
        <div className="grid">
          <Field label={supplierLabel[rule.costMethod]}>
            <NumberInput value={item.supplierPrice} onChange={(v) => set('supplierPrice', v)} />
          </Field>
          <Field label="Markup" badge={rule.id === 'other' && unconfirmed.has('defaultMarkupOther')}>
            <NumberInput value={item.markup} disabled={role !== 'manager'} onChange={(v) => set('markup', v)} />
          </Field>
          <Field label="Margin change"><NumberInput value={item.marginChange} onChange={(v) => set('marginChange', v)} /></Field>
        </div>
        {role !== 'manager' && <p className="meta">Markup is set by the pricing rule. A manager can change it.</p>}
        <Calc result={result} keys={['profileCost', 'profilePrice']} />
      </Section>

      <Section title="Glass">
        <div className="grid">
          <Field label="Glass rate (AED/m²)"><NumberInput value={item.glassRate} disabled={!rule.glassLine} onChange={(v) => set('glassRate', v)} /></Field>
          <Field label="Glass thickness (mm)"><NumberInput value={item.glassThicknessMm} onChange={(v) => set('glassThicknessMm', v)} /></Field>
          <Field label="Glazing spec"><TextInput value={item.glazingSpec} onChange={(v) => set('glazingSpec', v)} /></Field>
        </div>
        <p className="meta">
          Glass area uses the full item area <Unconfirmed /> · Glass weight factor {fmtNum(rules.settings.glassDensityKgPerSqmPerMm)} kg/m²/mm <Unconfirmed />
        </p>
        <Calc result={result} keys={['glassCost', 'glassWeight']} />
      </Section>

      <Section title="Other costs">
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
          <Field label="Freight (AED)"><NumberInput value={item.freight} onChange={(v) => set('freight', v)} /></Field>
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
        {rule.freight.type === 'perPanel' && (
          <p className="meta">Freight default for {rule.label}: AED {fmtAed(rule.freight.value)} per panel.</p>
        )}

        <h3>Accessories</h3>
        {item.accessories.map((a, i) => (
          <div className="row" key={i}>
            <TextInput value={a.description} onChange={(v) => set('accessories', item.accessories.map((x, j) => (j === i ? { ...x, description: v } : x)))} />
            <NumberInput value={a.cost} onChange={(v) => set('accessories', item.accessories.map((x, j) => (j === i ? { ...x, cost: v } : x)))} />
            <button type="button" className="link" onClick={() => set('accessories', item.accessories.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={() => set('accessories', [...item.accessories, { description: '', cost: 0 }])}>
          Add accessory
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
      </Section>

      <Section title="Summary">
        {warnings.length > 0 && (
          <ul className="warnings">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        )}
        <Calc result={result} keys={['subtotal', 'margin', 'discount', 'rate', 'amount', 'pricePerSqm']} />
        <div className="totals">
          <div>
            <span className="field-label">Calculated rate (AED)</span>
            <strong>{fmtAed(result.rate)}</strong>
          </div>
          <div>
            <span className="field-label">Amount (AED)</span>
            <strong>{fmtAed(result.amount)}</strong>
          </div>
          <div>
            <span className="field-label">Salesperson price (AED)</span>
            <NumberInput
              value={item.salespersonPrice ?? 0}
              onChange={(v) => set('salespersonPrice', v || null)}
            />
            {item.salespersonPrice ? (
              <span className="meta">
                Difference from calculated rate: AED {fmtAed(item.salespersonPrice - result.rate)}
              </span>
            ) : null}
          </div>
        </div>
        <p className="meta">Rounding: {rules.settings.rounding} on each component <Unconfirmed /></p>
      </Section>
    </div>
  )
}
