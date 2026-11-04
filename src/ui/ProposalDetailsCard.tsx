import { useId, useState } from 'react'
import { PROPOSAL_FIELDS, missingRequired, type ProposalDetails, type ProposalField } from './proposal'
import { applyDeal, DEAL_SOURCES } from '../zoho/dealMapping'
import { dealDetails } from '../zoho/crm'
import { DealLookup } from './DealLookup'
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
  { id: 'deal', title: 'Opportunity information' },
  { id: 'proposal', title: 'Proposal information' },
] as const

export function ProposalDetailsCard({ details, onChange }: { details: ProposalDetails; onChange: (d: ProposalDetails) => void }) {
  const [open, setOpen] = useState(true)
  const missing = missingRequired(details)
  const summary = [details.proposalReference, details.dealName, details.quoteStatus].filter(Boolean).join(' · ')
  const fromZoho = new Set(String(details.crmFilled || '').split(',').filter(Boolean))
  const [refreshing, setRefreshing] = useState('')
  const set = (key: string, v: string | number | boolean) => {
    // A field edited by hand is no longer tagged as coming from Zoho.
    const rest = [...fromZoho].filter((k) => k !== key)
    onChange({ ...details, [key]: v, crmFilled: rest.join(',') })
  }
  const refresh = async () => {
    setRefreshing('Refreshing from Zoho…')
    try {
      onChange(applyDeal(details, await dealDetails(String(details.crmDealId))).details)
      setRefreshing('')
    } catch (e) {
      setRefreshing((e as Error).message)
    }
  }

  return (
    <section className="card" aria-labelledby="sec-proposal">
      <div className="card-head">
        <h2 id="sec-proposal">Proposal details</h2>
        <span className="card-aside head-actions">
          {missing.length > 0 && <span className="pill pill-amber">{missing.length} required {missing.length === 1 ? 'field' : 'fields'} empty</span>}
          {!open && summary && <span>{summary}</span>}
          {details.crmDealId && <button type="button" className="link" onClick={refresh}>Refresh from Zoho</button>}
          {refreshing && <span>{refreshing}</span>}
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
                      <Input field={f} value={details[f.key]} onChange={(v) => set(f.key, v)} />
                      {f.label}
                    </label>
                  ) : (
                    <label key={f.key} className={`field ${f.wide ? 'wide' : ''}`}>
                      <span className="field-label">
                        {f.label}
                        {f.required && <span className="req" aria-label="required">*</span>}
                        {fromZoho.has(f.key) && <span className="chip zoho-tag">From {DEAL_SOURCES[f.key]}</span>}
                      </span>
                      {f.key === 'dealName' ? (
                        <DealLookup
                          value={String(details.dealName)}
                          // Typing a new name unlinks the CRM deal until one is picked again.
                          onType={(name) => onChange({ ...details, dealName: name, crmDealId: '', crmFilled: '' })}
                          onPick={(deal) => onChange(applyDeal(details, deal).details)}
                        />
                      ) : (
                        <Input field={f} value={details[f.key]} onChange={(v) => set(f.key, v)} />
                      )}
                    </label>
                  ),
                )}
              </div>
            </div>
          ))}
          <p className="muted small">File uploads from Zoho (proposal Word file, revised proposal and order confirmation, QR image) are not stored here.</p>
        </div>
      )}
    </section>
  )
}
