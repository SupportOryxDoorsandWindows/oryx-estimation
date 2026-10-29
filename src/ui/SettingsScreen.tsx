import type { PricingRule, PricingRules, Settings } from '../engine/types'
import { Field, NumberInput, Section, TextInput } from './fields'

interface Props {
  rules: PricingRules
  onChange: (r: PricingRules) => void
  onReset: () => void
}

const numericSettings: { key: keyof Settings; label: string }[] = [
  { key: 'gbpToAed', label: 'GBP to AED' },
  { key: 'eurToAed', label: 'EUR to AED' },
  { key: 'inothermDiscount', label: 'Inotherm discount (0–1)' },
  { key: 'curtainWallBondingRate', label: 'Curtain wall bonding rate (AED/m²)' },
  { key: 'glassDensityKgPerSqmPerMm', label: 'Glass weight factor (kg/m²/mm)' },
  { key: 'defaultMarkupOther', label: 'Markup for products outside the pricing sheet' },
  { key: 'insuranceRate', label: 'Insurance rate (0–1)' },
]

export function SettingsScreen({ rules, onChange, onReset }: Props) {
  const s = rules.settings
  const unconfirmed = new Set<string>(rules.unconfirmed)
  const setS = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...rules, settings: { ...s, [k]: v } })
  const setRule = (id: string, patch: Partial<PricingRule>) =>
    onChange({ ...rules, rules: rules.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  return (
    <div className="form">
      <Section title="Settings">
        <div className="grid">
          <Field label="Rounding" badge={unconfirmed.has('rounding')}>
            <select value={s.rounding} onChange={(e) => setS('rounding', e.target.value as Settings['rounding'])}>
              <option value="floor">Floor each component (live system)</option>
              <option value="round">Round each component (Excel)</option>
            </select>
          </Field>
          <Field label="Bonding default" badge={unconfirmed.has('bondingDefault')}>
            <select value={s.bondingDefault} onChange={(e) => setS('bondingDefault', e.target.value as Settings['bondingDefault'])}>
              <option value="curtainWallPerSqm">Curtain walls: rate per m²</option>
              <option value="manual">Always manual</option>
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
        <p className="meta">
          Glass area uses the full item area. Insurance, duties and discount % use the subtotal before discount. Both are unconfirmed (SPEC §4).
        </p>
      </Section>

      <Section title="Pricing rules by origin">
        <table className="rules">
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
        <button type="button" className="secondary" onClick={onReset}>Reset to SPEC defaults</button>
      </Section>
    </div>
  )
}
