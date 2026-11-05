import { GLASS_TYPES, type PricingRule, type PricingRules, type Settings } from '../engine/types'
import { Card, Field, NumberInput, TextInput } from './fields'

interface Props {
  rules: PricingRules
  onChange: (r: PricingRules) => void
}

const numericSettings: { key: keyof Settings; label: string }[] = [
  { key: 'gbpToAed', label: 'GBP to AED' },
  { key: 'eurToAed', label: 'EUR to AED' },
  { key: 'inothermDiscount', label: 'Inotherm discount (0–1)' },
  { key: 'glassDensityKgPerSqmPerMm', label: 'Glass weight factor (kg/m²/mm)' },
  { key: 'dualColourSurcharge', label: 'Dual colour surcharge on profile price (0–1)' },
  { key: 'manpowerRate', label: 'Manpower charges as a share of profile cost (0–1)' },
  { key: 'defaultMarkupOther', label: 'Markup for products outside the pricing sheet' },
]

export function SettingsScreen({ rules, onChange }: Props) {
  const s = rules.settings
  const unconfirmed = new Set<string>(rules.unconfirmed)
  const setS = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...rules, settings: { ...s, [k]: v } })
  const setRule = (id: string, patch: Partial<PricingRule>) =>
    onChange({ ...rules, rules: rules.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  return (
    <div className="stack">
      <Card title="Calculation settings" aside="Editable without code changes">
        <div className="grid">
          <Field label="Rounding" badge={unconfirmed.has('rounding')}>
            <select value={s.rounding} onChange={(e) => setS('rounding', e.target.value as Settings['rounding'])}>
              <option value="floor">Floor each component (live system)</option>
              <option value="round">Round each component (Excel)</option>
            </select>
          </Field>
          {numericSettings.map(({ key, label }) => (
            <Field key={key} label={label} badge={unconfirmed.has(key)}>
              <NumberInput value={s[key] as number} onChange={(v) => setS(key, v as never)} />
            </Field>
          ))}
          <Field label="Warn when other charges are negative" badge={unconfirmed.has('warnNegativeOtherCharges')}>
            <select value={s.warnNegativeOtherCharges ? 'yes' : 'no'} onChange={(e) => setS('warnNegativeOtherCharges', e.target.value === 'yes')}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Warn below Standard Pricing" badge={unconfirmed.has('warnBelowStandardPricing')}>
            <select value={s.warnBelowStandardPricing ? 'yes' : 'no'} onChange={(e) => setS('warnBelowStandardPricing', e.target.value === 'yes')}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>
        <p className="muted small">
          Glass area uses the full item area. Insurance, duties and discount % use the subtotal before discount. Both are unconfirmed (SPEC §4).
        </p>
      </Card>

      <Card title="Glass rates by type (AED/m²)" aside="Filled in when a glass type is chosen; estimators can change them per item">
        <div className="grid grid-4">
          {GLASS_TYPES.map((t) => (
            <Field key={t} label={t}>
              <NumberInput value={s.glassTypeRates?.[t] ?? 0} min={0} group onChange={(v) => setS('glassTypeRates', { ...s.glassTypeRates, [t]: v })} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Pricing rules by origin" aside="SPEC §3">
        <div className="table-wrap">
        <table className="table rules">
          <thead>
            <tr><th>Origin</th><th>Markup</th><th>Freight (AED)</th><th>Freight basis</th><th>Other default (AED)</th></tr>
          </thead>
          <tbody>
            {rules.rules.map((r) => (
              <tr key={r.id}>
                <td><TextInput value={r.label} onChange={(v) => setRule(r.id, { label: v })} /></td>
                <td><NumberInput value={r.markup} onChange={(v) => setRule(r.id, { markup: v })} /></td>
                <td><NumberInput value={r.freight.value} disabled={r.freight.type === 'manual'} onChange={(v) => setRule(r.id, { freight: { ...r.freight, value: v } })} /></td>
                <td>{r.freight.type === 'perPanel' ? 'Per panel' : r.freight.type === 'fixed' ? 'Per item' : 'Manual'}</td>
                <td>
                  {r.otherCharges === null ? 'Manual' : (
                    <NumberInput value={r.otherCharges} onChange={(v) => setRule(r.id, { otherCharges: v })} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  )
}
