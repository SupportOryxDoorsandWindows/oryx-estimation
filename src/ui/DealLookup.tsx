import { useEffect, useId, useRef, useState } from 'react'
import { dealDetails, searchDeals, type DealDetails, type DealHit } from '../zoho/crm'

/** Opportunity Name field: type to search Zoho CRM opportunities (Deals), pick one to fill the opportunity information. */
export function DealLookup({ value, onType, onPick }: {
  value: string
  onType: (name: string) => void
  onPick: (deal: DealDetails) => void
}) {
  const listId = useId()
  const [hits, setHits] = useState<DealHit[]>([])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [active, setActive] = useState(0)
  const typed = useRef(false)

  // Search as you type (after a short pause), only for text the user typed.
  useEffect(() => {
    if (!typed.current) return
    const q = value.trim()
    if (q.length < 2) { setHits([]); setStatus(''); return }
    let live = true
    setStatus('Searching Zoho CRM…')
    const t = setTimeout(() => {
      searchDeals(q)
        .then((d) => { if (!live) return; setHits(d); setActive(0); setStatus(d.length ? '' : 'No CRM opportunities match.') })
        .catch((e: Error) => live && (setHits([]), setStatus(e.message)))
    }, 350)
    return () => { live = false; clearTimeout(t) }
  }, [value])

  const pick = async (hit: DealHit) => {
    setOpen(false)
    typed.current = false
    setStatus('Loading the opportunity from Zoho…')
    try {
      onPick(await dealDetails(hit.id))
      setStatus('')
    } catch (e) {
      setStatus((e as Error).message)
    }
  }

  return (
    <div className="picker">
      <input
        type="search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Type to search Zoho CRM opportunities"
        value={value}
        onChange={(e) => { typed.current = true; onType(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && open && hits[active]) { e.preventDefault(); void pick(hits[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && hits.length > 0 && (
        <ul className="picker-list" id={listId} role="listbox">
          {hits.map((h, i) => (
            <li key={h.id} role="option" aria-selected={i === active} className={i === active ? 'active' : ''}
              onMouseDown={(e) => { e.preventDefault(); void pick(h) }} onMouseEnter={() => setActive(i)}>
              <span className="picker-main">{h.name}</span>
              <span className="picker-sub">{[h.company, h.stage].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}
      {status && <span className="field-hint">{status}</span>}
    </div>
  )
}
