import { useId, useState } from 'react'
import { PROPOSAL_FIELDS, missingRequired, type ProposalDetails, type ProposalField } from './proposal'
import { NumberInput } from './fields'

function Input({ field, value, onChange }: { field: ProposalField; value: string | number | boolean; onChange: (v: string | number | boolean) => void }) {
  const listId = useId()
  switch (field.type) {
    case 'checkbox':
      return <input type="checkbox" className="check" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
    case 'textarea':
      return <textarea rows={3} value={String(value)} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <NumberInput value={Number(value) || 0} min={0} group onChange={onChange} />
    case 'select':
      return (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {field.options!.map((o) => <option key={o} value={o}>{o || 'Select'}</option>)}
        </select>
      )
    default:
      return (
        <>
          <input
            type={field.type}
            value={String(value)}
            placeholder={field.type === 'url' ? 'https://' : undefined}
            list={field.suggestions ? listId : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.suggestions && (
            <datalist id={listId}>{field.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          )}
        </>
      )
  }
}

const GROUPS = [
  { id: 'deal', title: 'Deal information' },
  { id: 'proposal', title: 'Proposal information' },
] as const

export function ProposalDetailsCard({ details, onChange }: { details: ProposalDetails; onChange: (d: ProposalDetails) => void }) {
  const [open, setOpen] = useState(true)
  const missing = missingRequired(details)
  const summary = [details.proposalReference, details.dealName, details.quoteStatus].filter(Boolean).join(' · ')

  return (
    <section className="card" aria-labelledby="sec-proposal">
      <div className="card-head">
        <h2 id="sec-proposal">Proposal details</h2>
        <span className="card-aside head-actions">
          {missing.length > 0 && <span className="pill pill-amber">{missing.length} required {missing.length === 1 ? 'field' : 'fields'} empty</span>}
          {!open && summary && <span>{summary}</span>}
          <button type="button" className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
        </span>
      </div>
      {open && (
        <div className="card-body">
          {GROUPS.map((g) => (
            <div key={g.id} className="stack-sm">
              <h3>{g.title}</h3>
              <div className="grid grid-bottom">
                {PROPOSAL_FIELDS.filter((f) => f.group === g.id).map((f) =>
                  f.type === 'checkbox' ? (
                    <label key={f.key} className="check-field wide">
                      <Input field={f} value={details[f.key]} onChange={(v) => onChange({ ...details, [f.key]: v })} />
                      {f.label}
                    </label>
                  ) : (
                    <label key={f.key} className={`field ${f.wide ? 'wide' : ''}`}>
                      <span className="field-label">
                        {f.label}
                        {f.required && <span className="req" aria-label="required">*</span>}
                      </span>
                      <Input field={f} value={details[f.key]} onChange={(v) => onChange({ ...details, [f.key]: v })} />
                    </label>
                  ),
                )}
              </div>
            </div>
          ))}
          <p className="muted small">File and image uploads from Zoho (proposal Word file, revised proposal and order confirmation, QR image) are not stored here yet.</p>
        </div>
      )}
    </section>
  )
}
