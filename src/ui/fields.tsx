import type { ReactNode } from 'react'

export function Unconfirmed() {
  return <span className="pill pill-amber" title="Rule not yet confirmed by the business (SPEC §4)">Unconfirmed</span>
}

export function Field({ label, children, badge, hint }: { label: string; children: ReactNode; badge?: boolean; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {badge && <Unconfirmed />}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
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

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
}

export function Card({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="card" aria-labelledby={id}>
      <div className="card-head">
        <h2 id={id}>{title}</h2>
        {aside && <span className="card-aside">{aside}</span>}
      </div>
      <div className="card-body">{children}</div>
    </section>
  )
}
