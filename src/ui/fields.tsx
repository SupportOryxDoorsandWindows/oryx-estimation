import type { ReactNode } from 'react'

export function Unconfirmed() {
  return <span className="badge" title="Rule not yet confirmed by the business (SPEC §4)">unconfirmed</span>
}

export function Field({ label, children, badge }: { label: string; children: ReactNode; badge?: boolean }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {badge && <Unconfirmed />}
      </span>
      {children}
    </label>
  )
}

export function NumberInput({
  value, onChange, step = 'any', disabled, min,
}: { value: number; onChange: (n: number) => void; step?: string; disabled?: boolean; min?: number }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      disabled={disabled}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  )
}

export function TextInput({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
