import { useEffect, useId, useRef, useState } from 'react'
import type { Product } from '../engine/types'

export const productLabel = (p: Product) =>
  [p.fabricator, p.businessUnit, p.productCode, p.type, p.sizeRange].filter(Boolean).join(' · ')

const MAX_SHOWN = 50

interface Props {
  products: Product[]
  selectedId: string
  onPick: (id: string) => void
}

/** Search-as-you-type product field. A single match is picked automatically. */
export function ProductPicker({ products, selectedId, onPick }: Props) {
  const listId = useId()
  const selected = products.find((p) => p.id === selectedId)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = terms.length
    ? products.filter((p) => terms.every((t) => `${productLabel(p)} ${p.oryxCode ?? ''}`.toLowerCase().includes(t)))
    : products
  const shown = matches.slice(0, MAX_SHOWN)

  // One match left: select it straight away.
  useEffect(() => {
    if (terms.length && matches.length === 1 && matches[0].id !== selectedId) onPick(matches[0].id)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (p: Product) => {
    onPick(p.id)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const start = () => {
    window.clearTimeout(closeTimer.current)
    if (open) return
    setQuery('')
    setOpen(true)
    setActive(0)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]) }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur() }
  }

  // While searching, the field holds only what was typed; otherwise it shows the selected product.
  const value = open ? query : selected ? productLabel(selected) : ''

  return (
    <div className="picker">
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        ref={inputRef}
        placeholder={open && selected ? productLabel(selected) : 'Type to search, e.g. Fusion C35'}
        value={value}
        onFocus={start}
        onMouseDown={start}
        onBlur={() => { closeTimer.current = window.setTimeout(() => { setOpen(false); setQuery('') }, 150) }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="picker-list" id={listId} role="listbox">
          {shown.length === 0 && <li className="picker-empty">No products match “{query}”.</li>}
          {shown.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={p.id === selectedId}
              className={`${i === active ? 'active' : ''} ${p.id === selectedId ? 'selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(p) }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="picker-main">{p.productCode} <span className="muted">· {p.type}</span></span>
              <span className="picker-sub">{[p.fabricator, p.businessUnit, p.sizeRange].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
          {matches.length > MAX_SHOWN && (
            <li className="picker-empty">{matches.length - MAX_SHOWN} more. Keep typing to narrow the list.</li>
          )}
        </ul>
      )}
    </div>
  )
}
