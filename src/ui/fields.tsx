import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

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

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 })

interface NumberInputProps {
  value: number
  onChange: (n: number) => void
  step?: string
  disabled?: boolean
  min?: number
  /** Unit shown inside the field, e.g. "mm". */
  suffix?: string
  /** Show − and + buttons that move by `step` (default 1). */
  stepper?: boolean
  /** Show thousands separators when the field is not being edited. */
  group?: boolean
}

export function NumberInput({ value, onChange, step = 'any', disabled, min, suffix, stepper, group }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  const selectAll = useRef(false)
  // Select the whole value once the raw (unformatted) text is in place, so typing replaces it.
  useLayoutEffect(() => {
    if (selectAll.current && ref.current) {
      selectAll.current = false
      ref.current.select()
    }
  })
  const shown = draft ?? (Number.isFinite(value) ? (group ? grouped.format(value) : String(value)) : '')
  const clamp = (n: number) => (min !== undefined ? Math.max(min, n) : n)
  const delta = step === 'any' ? 1 : Number(step)

  const commit = (text: string) => {
    const n = Number(text.replace(/,/g, '').trim())
    if (text.trim() === '' || text.trim() === '-') onChange(clamp(0))
    else if (Number.isFinite(n)) onChange(clamp(n))
  }

  const input = (
    <input
      ref={ref}
      type="text"
      inputMode={min !== undefined && min >= 0 ? 'decimal' : 'text'}
      disabled={disabled}
      value={shown}
      onFocus={(e) => { selectAll.current = true; setDraft(Number.isFinite(value) ? String(value) : ''); e.target.select() }}
      onMouseUp={(e) => e.preventDefault()}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = e.target.value
        if (!/^-?[\d,]*\.?\d*$/.test(text)) return
        setDraft(text)
        commit(text)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const next = clamp(value + (e.key === 'ArrowUp' ? delta : -delta))
          onChange(next)
          setDraft(String(next))
        }
      }}
    />
  )

  if (!suffix && !stepper) return input
  return (
    <div className={`num-field ${disabled ? 'disabled' : ''}`}>
      {stepper && (
        <button type="button" className="num-step" aria-label="Decrease" disabled={disabled || (min !== undefined && value <= min)}
          onClick={() => onChange(clamp(value - delta))}>−</button>
      )}
      {input}
      {suffix && <span className="num-suffix">{suffix}</span>}
      {stepper && (
        <button type="button" className="num-step" aria-label="Increase" disabled={disabled}
          onClick={() => onChange(clamp(value + delta))}>+</button>
      )}
    </div>
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
