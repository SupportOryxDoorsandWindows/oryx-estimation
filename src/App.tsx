import { useEffect, useState } from 'react'
import { calculateLineItem } from './engine/calculate'
import { blankLineItem } from './engine/defaults'
import { fmtAed } from './engine/format'
import type { LineItemInput, PricingRules, Product } from './engine/types'
import { LineItemForm } from './ui/LineItemForm'
import { SettingsScreen } from './ui/SettingsScreen'
import {
  defaultRules, downloadJson, type Estimate, loadEstimates, loadProducts, loadRole, loadRules,
  newEstimate, normaliseItem, pickJson, type Role, saveEstimates, saveProducts, saveRole, saveRules,
} from './ui/storage'

type View = 'estimate' | 'saved' | 'settings'

export default function App() {
  const [view, setView] = useState<View>('estimate')
  const [rules, setRules] = useState<PricingRules>(loadRules)
  const [products, setProducts] = useState<Product[]>(loadProducts)
  const [estimates, setEstimates] = useState<Estimate[]>(loadEstimates)
  const [role, setRole] = useState<Role>(loadRole)
  const [current, setCurrent] = useState<Estimate>(() => loadEstimates()[0] ?? newEstimate())
  const [itemIndex, setItemIndex] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => saveRules(rules), [rules])
  useEffect(() => saveProducts(products), [products])
  useEffect(() => saveEstimates(estimates), [estimates])
  useEffect(() => saveRole(role), [role])

  const item = current.items[itemIndex] ?? current.items[0]
  const results = current.items.map((i) => calculateLineItem(i, rules))
  const total = results.reduce((t, r) => t + r.amount, 0)

  const updateItem = (next: LineItemInput) =>
    setCurrent({ ...current, items: current.items.map((x, i) => (i === itemIndex ? next : x)) })

  const save = () => {
    const saved = { ...current, updatedAt: new Date().toISOString() }
    setCurrent(saved)
    setEstimates([saved, ...estimates.filter((e) => e.id !== saved.id)])
    setMessage(`Saved "${saved.name}".`)
  }

  const open = (e: Estimate) => {
    setCurrent({ ...e, items: e.items.map(normaliseItem) })
    setItemIndex(0)
    setView('estimate')
  }

  const exportAll = () =>
    downloadJson(`oryx-estimation-${new Date().toISOString().slice(0, 10)}.json`, { estimates, rules })

  const importAll = async () => {
    try {
      const data = (await pickJson()) as { estimates?: Estimate[]; rules?: PricingRules }
      if (data.estimates) setEstimates(data.estimates.map((e) => ({ ...e, items: e.items.map(normaliseItem) })))
      if (data.rules?.settings && data.rules.rules) setRules(data.rules)
      setMessage('Import complete.')
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`)
    }
  }

  const importProducts = async () => {
    try {
      const data = (await pickJson()) as { products?: Product[] } | Product[]
      const list = Array.isArray(data) ? data : data.products
      if (!list?.length) throw new Error('No products found in the file')
      setProducts(list)
      setMessage(`Imported ${list.length} products.`)
    } catch (err) {
      setMessage(`Import failed: ${(err as Error).message}`)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Oryx Estimation</h1>
        <nav>
          {(['estimate', 'saved', 'settings'] as View[]).map((v) => (
            <button key={v} type="button" className={view === v ? 'tab active' : 'tab'} onClick={() => setView(v)}>
              {v === 'estimate' ? 'Estimate' : v === 'saved' ? 'Saved estimates' : 'Settings'}
            </button>
          ))}
        </nav>
        <select className="role" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
          <option value="estimator">Estimator</option>
          <option value="manager">Manager</option>
        </select>
      </header>

      {message && <p className="message" onClick={() => setMessage('')}>{message}</p>}

      {view === 'estimate' && (
        <main>
          <div className="toolbar">
            <input className="title-input" value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} aria-label="Estimate name" />
            <button type="button" onClick={save}>Save estimate</button>
            <button type="button" className="secondary" onClick={() => { setCurrent(newEstimate()); setItemIndex(0) }}>New estimate</button>
          </div>
          <table className="items">
            <thead><tr><th>Ref #</th><th>Location</th><th>Qty</th><th className="value">Rate (AED)</th><th className="value">Amount (AED)</th><th /></tr></thead>
            <tbody>
              {current.items.map((i, idx) => (
                <tr key={idx} className={idx === itemIndex ? 'selected' : ''} onClick={() => setItemIndex(idx)}>
                  <td>{i.ref || `Item ${idx + 1}`}</td>
                  <td>{i.location}</td>
                  <td>{i.qty}</td>
                  <td className="value">{fmtAed(results[idx].rate)}</td>
                  <td className="value">{fmtAed(results[idx].amount)}</td>
                  <td>
                    {current.items.length > 1 && (
                      <button type="button" className="link" onClick={(e) => {
                        e.stopPropagation()
                        setCurrent({ ...current, items: current.items.filter((_, j) => j !== idx) })
                        setItemIndex(0)
                      }}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={4}>Total (AED)</th><td className="value">{fmtAed(total)}</td><td /></tr></tfoot>
          </table>
          <button type="button" className="secondary" onClick={() => {
            setCurrent({ ...current, items: [...current.items, blankLineItem()] })
            setItemIndex(current.items.length)
          }}>Add line item</button>
          <LineItemForm item={item} onChange={updateItem} rules={rules} products={products} role={role} />
        </main>
      )}

      {view === 'saved' && (
        <main>
          <div className="toolbar">
            <button type="button" onClick={exportAll}>Export JSON</button>
            <button type="button" className="secondary" onClick={importAll}>Import JSON</button>
            <button type="button" className="secondary" onClick={importProducts}>Import products.json</button>
            <span className="meta">{products.length} products loaded</span>
          </div>
          {estimates.length === 0 ? <p className="meta">No saved estimates yet.</p> : (
            <table className="items">
              <thead><tr><th>Name</th><th>Items</th><th>Updated</th><th className="value">Total (AED)</th><th /></tr></thead>
              <tbody>
                {estimates.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name}</td>
                    <td>{e.items.length}</td>
                    <td>{new Date(e.updatedAt).toLocaleString('en-GB')}</td>
                    <td className="value">{fmtAed(e.items.reduce((t, i) => t + calculateLineItem(normaliseItem(i), rules).amount, 0))}</td>
                    <td>
                      <button type="button" className="link" onClick={() => open(e)}>Open</button>{' '}
                      <button type="button" className="link" onClick={() => setEstimates(estimates.filter((x) => x.id !== e.id))}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      )}

      {view === 'settings' && (
        <main>
          <SettingsScreen rules={rules} onChange={setRules} onReset={() => setRules(defaultRules())} />
        </main>
      )}
    </div>
  )
}
