import { useEffect, useState } from 'react'
import { calculateLineItem } from './engine/calculate'
import { blankLineItem } from './engine/defaults'
import { fmtAed } from './engine/format'
import type { LineItemInput, PricingRules, Product } from './engine/types'
import { buildWorkbook, parseProducts, parseWorkbook } from './io/workbook'
import { downloadWorkbook, pickWorkbook } from './ui/excelFile'
import { Card } from './ui/fields'
import { Icon, type IconName } from './ui/icons'
import { LineItemForm } from './ui/LineItemForm'
import { ProposalDetailsCard } from './ui/ProposalDetailsCard'
import { missingRequired } from './ui/proposal'
import { SettingsScreen } from './ui/SettingsScreen'
import {
  defaultRules, type Estimate, loadEstimates, loadProducts, loadRole, loadRules,
  newEstimate, normaliseEstimate, normaliseItem, type Role, saveEstimates, saveProducts, saveRole, saveRules,
} from './ui/storage'

type View = 'estimate' | 'saved' | 'settings'

const NAV: { title: string; items: { view: View; label: string; icon: IconName }[] }[] = [
  {
    title: 'Estimating',
    items: [
      { view: 'estimate', label: 'Estimate', icon: 'estimate' },
      { view: 'saved', label: 'Saved estimates', icon: 'saved' },
    ],
  },
  { title: 'Setup', items: [{ view: 'settings', label: 'Settings', icon: 'settings' }] },
]

const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function App() {
  const [view, setView] = useState<View>('estimate')
  const [menuOpen, setMenuOpen] = useState(false)
  const [rules, setRules] = useState<PricingRules>(loadRules)
  const [products, setProducts] = useState<Product[]>(loadProducts)
  const [estimates, setEstimates] = useState<Estimate[]>(() => loadEstimates().map(normaliseEstimate))
  const [role, setRole] = useState<Role>(loadRole)
  const [current, setCurrent] = useState<Estimate>(() => { const e = loadEstimates()[0]; return e ? normaliseEstimate(e) : newEstimate() })
  const [itemIndex, setItemIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'ok' | 'warn' | 'error'>('ok')
  const notify = (text: string, tone: 'ok' | 'warn' | 'error' = 'ok') => { setMessage(text); setMessageTone(tone) }

  useEffect(() => saveRules(rules), [rules])
  useEffect(() => saveProducts(products), [products])
  useEffect(() => saveEstimates(estimates), [estimates])
  useEffect(() => saveRole(role), [role])

  const item = current.items[itemIndex] ?? current.items[0]
  const results = current.items.map((i) => calculateLineItem(i, rules))
  const total = results.reduce((t, r) => t + r.amount, 0)
  const hasZoho = current.items.some((i) => i.zohoAmount != null)

  const go = (v: View) => { setView(v); setMenuOpen(false) }

  const updateItem = (next: LineItemInput) =>
    setCurrent({ ...current, items: current.items.map((x, i) => (i === itemIndex ? next : x)) })

  const save = () => {
    const saved = { ...current, updatedAt: new Date().toISOString() }
    setCurrent(saved)
    setEstimates([saved, ...estimates.filter((e) => e.id !== saved.id)])
    const missing = missingRequired(saved.details)
    if (missing.length) notify(`Saved "${saved.name}". Still required: ${missing.join(', ')}.`, 'warn')
    else notify(`Saved "${saved.name}".`)
  }

  const open = (e: Estimate) => {
    setCurrent(normaliseEstimate(e))
    setItemIndex(0)
    go('estimate')
  }

  const exportAll = async () => {
    try {
      await downloadWorkbook(`oryx-estimation-${new Date().toISOString().slice(0, 10)}.xlsx`, buildWorkbook(estimates, rules, products))
    } catch (err) {
      notify(`Export failed: ${(err as Error).message}`, 'error')
    }
  }

  const importAll = async () => {
    try {
      const data = parseWorkbook(await pickWorkbook(), rules, products)
      if (data.estimates) {
        // Imported estimates replace saved ones with the same ID; others are kept.
        const ids = new Set(data.estimates.map((e) => e.id))
        setEstimates([...data.estimates.map(normaliseEstimate), ...estimates.filter((e) => !ids.has(e.id))])
      }
      if (data.rules) setRules(data.rules)
      const n = data.estimates?.length ?? 0
      const parts = [`Imported ${n} ${n === 1 ? 'estimate' : 'estimates'}${data.rules ? ' and the settings' : ''}.`]
      const compared = (data.estimates ?? []).flatMap((e) => e.items).filter((i) => i.zohoAmount != null)
      if (compared.length) {
        const same = compared.filter((i) => calculateLineItem(i, data.rules ?? rules).amount === i.zohoAmount).length
        parts.push(`${same} of ${compared.length} line items match the Zoho amount.`)
      }
      notify([...parts, ...(data.notes ?? [])].join(' '))
    } catch (err) {
      notify(`Import failed: ${(err as Error).message}`, 'error')
    }
  }

  const importProducts = async () => {
    try {
      const list = parseProducts(await pickWorkbook())
      if (!list.length) throw new Error('No products found in the file')
      setProducts(list)
      notify(`Imported ${list.length} products.`)
    } catch (err) {
      notify(`Import failed: ${(err as Error).message}`, 'error')
    }
  }

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="sidebar-inner">
          <div className="brand">
            <div className="brand-mark">O</div>
            <div>
              <div className="brand-name">ORYX</div>
              <div className="brand-sub">Estimation</div>
            </div>
            <button type="button" className="menu-btn" aria-expanded={menuOpen} aria-controls="nav-links" onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name="menu" /> Menu
            </button>
          </div>

          <div id="nav-links" className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {NAV.map((group) => (
              <div className="nav-group" key={group.title}>
                <div className="nav-title">{group.title}</div>
                {group.items.map((n) => (
                  <button
                    key={n.view}
                    type="button"
                    className={`nav-link ${view === n.view ? 'active' : ''}`}
                    aria-current={view === n.view ? 'page' : undefined}
                    onClick={() => go(n.view)}
                  >
                    <Icon name={n.icon} />
                    {n.label}
                    {n.view === 'saved' && estimates.length > 0 && <span className="nav-count">{estimates.length}</span>}
                  </button>
                ))}
              </div>
            ))}

            <div className="nav-user">
              <div className="avatar" aria-hidden="true">{role === 'manager' ? 'MG' : 'ES'}</div>
              <div className="nav-user-text">
                <label htmlFor="role" className="nav-user-label">Signed in as</label>
                <select id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="estimator">Estimator</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="content">
        <div className="content-inner">
          {message && (
            <button type="button" className={`toast ${messageTone === 'error' ? 'toast-error' : messageTone === 'warn' ? 'toast-warn' : ''}`} onClick={() => setMessage('')}>
              {message} <span className="muted">Dismiss</span>
            </button>
          )}

          {view === 'estimate' && (
            <>
              <header className="page-head">
                <div className="page-title">
                  <div className="eyebrow">{today}</div>
                  <input
                    className="title-input"
                    value={current.name}
                    onChange={(e) => setCurrent({ ...current, name: e.target.value })}
                    aria-label="Estimate name"
                  />
                </div>
                <div className="actions">
                  <button type="button" className="btn" onClick={() => { setCurrent(newEstimate()); setItemIndex(0) }}>New estimate</button>
                  <button type="button" className="btn btn-primary" onClick={save}>Save estimate</button>
                </div>
              </header>

              <ProposalDetailsCard details={current.details} onChange={(details) => setCurrent({ ...current, details })} />

              <Card title="Line items" aside={`${current.items.length} ${current.items.length === 1 ? 'item' : 'items'} · Total AED ${fmtAed(total)}`}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Ref #</th><th>Location</th><th>Product</th>
                        <th className="num">Qty</th><th className="num">Rate (AED)</th><th className="num">Amount (AED)</th>
                        {hasZoho && <th className="num">Zoho amount (AED)</th>}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {current.items.map((i, idx) => (
                        <tr key={idx} className={idx === itemIndex ? 'selected' : ''} onClick={() => setItemIndex(idx)}>
                          <td><span className="ref">{i.ref || `Item ${idx + 1}`}</span></td>
                          <td>{i.location || <span className="muted">—</span>}</td>
                          <td>{products.find((p) => p.id === i.productId)?.name ?? <span className="muted">Not selected</span>}</td>
                          <td className="num">{i.qty}</td>
                          <td className="num">{fmtAed(results[idx].rate)}</td>
                          <td className="num strong">{fmtAed(results[idx].amount)}</td>
                          {hasZoho && (
                            <td className="num">
                              {i.zohoAmount == null ? <span className="muted">—</span> : (
                                <span className={`pill ${i.zohoAmount === results[idx].amount ? 'pill-green' : 'pill-amber'}`}>{fmtAed(i.zohoAmount)}</span>
                              )}
                            </td>
                          )}
                          <td className="num">
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
                    <tfoot>
                      <tr>
                        <td colSpan={5}>Total (AED)</td><td className="num strong">{fmtAed(total)}</td>
                        {hasZoho && <td className="num">{fmtAed(current.items.reduce((t, i) => t + (i.zohoAmount ?? 0), 0))}</td>}
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => {
                  setCurrent({ ...current, items: [...current.items, blankLineItem()] })
                  setItemIndex(current.items.length)
                }}>
                  <Icon name="plus" size={16} /> Add line item
                </button>
              </Card>

              <LineItemForm item={item} onChange={updateItem} rules={rules} products={products} role={role} />
            </>
          )}

          {view === 'saved' && (
            <>
              <header className="page-head">
                <div className="page-title">
                  <div className="eyebrow">{products.length} {products.length === 1 ? 'product' : 'products'} loaded</div>
                  <h1>Saved estimates</h1>
                </div>
                <div className="actions">
                  <button type="button" className="btn" onClick={importProducts}>Import products (Excel)</button>
                  <button type="button" className="btn" onClick={importAll}>Import Excel</button>
                  <button type="button" className="btn btn-primary" onClick={exportAll}>Export Excel</button>
                </div>
              </header>
              <Card title="Estimates" aside="Saved in this browser only">
                {estimates.length === 0 ? <p className="muted">No saved estimates yet. Use Save estimate on the Estimate screen.</p> : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Name</th><th>Proposal reference</th><th>Quote status</th><th className="num">Items</th><th>Updated</th><th className="num">Total (AED)</th><th /></tr></thead>
                      <tbody>
                        {estimates.map((e) => (
                          <tr key={e.id}>
                            <td className="strong">{e.name}</td>
                            <td>{String(e.details?.proposalReference || '') || <span className="muted">—</span>}</td>
                            <td>{String(e.details?.quoteStatus || '') || <span className="muted">—</span>}</td>
                            <td className="num">{e.items.length}</td>
                            <td>{new Date(e.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                            <td className="num strong">{fmtAed(e.items.reduce((t, i) => t + calculateLineItem(normaliseItem(i), rules).amount, 0))}</td>
                            <td className="num nowrap">
                              <button type="button" className="btn btn-sm" onClick={() => open(e)}>Open</button>
                              <button type="button" className="link link-gap" onClick={() => setEstimates(estimates.filter((x) => x.id !== e.id))}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {view === 'settings' && (
            <>
              <header className="page-head">
                <div className="page-title">
                  <div className="eyebrow">Pricing defaults from SPEC §3 and open rules from §4</div>
                  <h1>Settings</h1>
                </div>
                <div className="actions">
                  <button type="button" className="btn" onClick={() => setRules(defaultRules())}>Reset to SPEC defaults</button>
                </div>
              </header>
              <SettingsScreen rules={rules} onChange={setRules} />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
