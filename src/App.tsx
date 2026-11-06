import { useEffect, useState } from 'react'
import { calculateLineItem } from './engine/calculate'
import { projectProfitability } from './engine/profitability'
import { blankLineItem } from './engine/defaults'
import { fmtAed } from './engine/format'
import type { LineItemInput, PricingRules, Product } from './engine/types'
import { buildWorkbook, parseProducts, parseWorkbook } from './io/workbook'
import { buildProfitabilityWorkbook, projectNameOf } from './io/profitabilityWorkbook'
import { downloadWorkbook, pickWorkbook } from './ui/excelFile'
import type { SignedInUser } from './auth/catalyst'
import { Card } from './ui/fields'
import { Icon, type IconName } from './ui/icons'
import { LineItemForm } from './ui/LineItemForm'
import { ProposalDetailsCard } from './ui/ProposalDetailsCard'
import { ProfitabilitySummary } from './ui/ProfitabilitySummary'
import { missingRequired } from './ui/proposal'
import { createRevision, revisionOf } from './ui/revision'
import { DoorChartScreen } from './ui/DoorChartScreen'
import { RevisionScreen } from './ui/RevisionScreen'
import { SettingsScreen } from './ui/SettingsScreen'
import {
  defaultRules, type Estimate, loadEstimates, loadProducts, loadRules,
  newEstimate, normaliseEstimate, normaliseItem, type Role, saveEstimates, saveProducts, saveRules,
} from './ui/storage'

function initials(email: string): string {
  const words = (email.split('@')[0] ?? '').split(/[._-]+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)).toUpperCase() || '?'
}

type View = 'estimate' | 'saved' | 'revisions' | 'doors' | 'settings'

const NAV: { title: string; items: { view: View; label: string; icon: IconName }[] }[] = [
  {
    title: 'Estimating',
    items: [
      { view: 'estimate', label: 'Estimate', icon: 'estimate' },
      { view: 'saved', label: 'Saved estimates', icon: 'saved' },
      { view: 'revisions', label: 'Revisions', icon: 'revision' },
    ],
  },
  { title: 'Pricing tools', items: [{ view: 'doors', label: 'Door price chart', icon: 'door' }] },
  { title: 'Setup', items: [{ view: 'settings', label: 'Settings', icon: 'settings' }] },
]

const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function App({ user, onSignOut }: { user: SignedInUser; onSignOut: () => void }) {
  const [view, setView] = useState<View>('estimate')
  const [menuOpen, setMenuOpen] = useState(false)
  const [rules, setRules] = useState<PricingRules>(loadRules)
  const [products, setProducts] = useState<Product[]>(loadProducts)
  const [estimates, setEstimates] = useState<Estimate[]>(() => loadEstimates().map(normaliseEstimate))
  // Only Admins can sign in for now, and Admins have manager rights (markup, base rates).
  const role: Role = 'manager'
  // Every visit starts with a blank estimate; saved ones open from Saved estimates.
  const [current, setCurrent] = useState<Estimate>(newEstimate)
  const [itemIndex, setItemIndex] = useState(0)
  // Saved estimates: the one clicked shows its Project Profitability Summary below the list.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'ok' | 'warn' | 'error'>('ok')
  const notify = (text: string, tone: 'ok' | 'warn' | 'error' = 'ok') => { setMessage(text); setMessageTone(tone) }

  useEffect(() => saveRules(rules), [rules])
  useEffect(() => saveProducts(products), [products])
  useEffect(() => saveEstimates(estimates), [estimates])
  // Bring the clicked estimate's summary into view (the list can be long).
  useEffect(() => {
    if (selectedId) document.getElementById('sec-profit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedId])

  const item = current.items[itemIndex] ?? current.items[0]
  const results = current.items.map((i) => calculateLineItem(i, rules))
  const total = results.reduce((t, r) => t + r.amount, 0)
  // Worked out from the same results as the Line items table, so it follows every change at once.
  const profitability = projectProfitability(current.items, results)
  const selected = estimates.find((e) => e.id === selectedId) ?? null
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

  const proposalRef = (e: Estimate) => {
    const r = revisionOf(e)
    return String(e.details?.proposalReference || '') || (r ? `${r.base}R${r.revision}` : '')
  }

  const revise = (e: Estimate) => {
    const next = createRevision(normaliseEstimate(e), estimates)
    // Newest revision first: place it above the first revision of the same proposal.
    const base = revisionOf(e)?.base
    const sameProposal = estimates.findIndex((x) => base !== undefined && revisionOf(x)?.base === base)
    const at = sameProposal >= 0 ? sameProposal : estimates.findIndex((x) => x.id === e.id)
    setEstimates([...estimates.slice(0, at), next, ...estimates.slice(at)])
    notify(`Created "${next.name}". "${e.name}" is unchanged.`)
  }

  const exportAll = async () => {
    try {
      await downloadWorkbook(`oryx-estimations-${new Date().toISOString().slice(0, 10)}.xlsx`, buildWorkbook(estimates, rules, products))
    } catch (err) {
      notify(`Export failed: ${(err as Error).message}`, 'error')
    }
  }

  const exportProfitability = async (e: Estimate) => {
    const safe = (t: string) => t.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    const proposal = String(e.details?.proposalNumber ?? '').trim() || proposalRef(e)
    const name = safe(proposal || projectNameOf(e.name, e.details)) || 'estimate'
    try {
      await downloadWorkbook(`profitability-${name}-${new Date().toISOString().slice(0, 10)}.xlsx`, buildProfitabilityWorkbook({
        name: e.name, details: e.details, items: e.items.map(normaliseItem), rules, products,
        exportedOn: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      }))
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
              <div className="brand-sub">Estimations</div>
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
              <div className="avatar" aria-hidden="true">{initials(user.email)}</div>
              <div className="nav-user-text">
                <span className="nav-user-email" title={user.email}>{user.email}</span>
                <span className="nav-user-label">Admin · <button type="button" className="nav-signout" onClick={onSignOut}>Sign out</button></span>
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

              {/* Keyed by estimate, so New estimate also clears the lookups' search text and lists. */}
              <ProposalDetailsCard key={current.id} details={current.details} onChange={(details) => setCurrent({ ...current, details })} />

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

              <LineItemForm key={`${current.id}-${itemIndex}`} item={item} onChange={updateItem} rules={rules} products={products} role={role} />

              {/* Shown once the estimate has a price; a blank estimate has nothing to summarise. */}
              {profitability.sellingPrice > 0 && <ProfitabilitySummary p={profitability} onExport={() => exportProfitability(current)} />}
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
              <Card title="Estimates" aside="Saved in this browser only · click an estimate to see its profitability">
                {estimates.length === 0 ? <p className="muted">No saved estimates yet. Use Save estimate on the Estimate screen.</p> : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Name</th><th>Proposal reference</th><th>Quote status</th><th className="num">Items</th><th>Updated</th><th className="num">Total (AED)</th><th /></tr></thead>
                      <tbody>
                        {estimates.map((e) => (
                          <tr key={e.id} className={e.id === selectedId ? 'selected' : ''} aria-selected={e.id === selectedId}
                            onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}>
                            <td className="strong">{e.name}</td>
                            <td className="nowrap">{proposalRef(e) || <span className="muted">—</span>}</td>
                            <td className="nowrap">{String(e.details?.quoteStatus || '') || <span className="muted">—</span>}</td>
                            <td className="num">{e.items.length}</td>
                            <td>{new Date(e.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                            <td className="num strong">{fmtAed(e.items.reduce((t, i) => t + calculateLineItem(normaliseItem(i), rules).amount, 0))}</td>
                            <td className="num nowrap" onClick={(ev) => ev.stopPropagation()}>
                              <button type="button" className="btn btn-sm" onClick={() => open(e)}>Open</button>{' '}
                              <button type="button" className="btn btn-sm" onClick={() => revise(e)}>Create revision</button>
                              <button type="button" className="link link-gap" onClick={() => setEstimates(estimates.filter((x) => x.id !== e.id))}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {selected && (
                <ProfitabilitySummary
                  title={selected.name}
                  p={projectProfitability(selected.items.map(normaliseItem), selected.items.map((i) => calculateLineItem(normaliseItem(i), rules)))}
                  onExport={() => exportProfitability(selected)}
                />
              )}
            </>
          )}

          {/* Kept mounted so a revision in progress survives switching pages. */}
          <div className="stack" hidden={view !== 'revisions'}>
            <header className="page-head">
              <div className="page-title">
                <div className="eyebrow">Revision and variation management</div>
                <h1>Revisions</h1>
              </div>
            </header>
            <RevisionScreen rules={rules} products={products} notify={notify} />
          </div>

          {view === 'doors' && (
            <>
              <header className="page-head">
                <div className="page-title">
                  <div className="eyebrow">{rules.doorChart.label} · price per m² from the production costing grid</div>
                  <h1>Door price chart</h1>
                </div>
                {role === 'manager' && (
                  <div className="actions">
                    <button type="button" className="btn" onClick={() => setRules({ ...rules, doorChart: defaultRules().doorChart })}>Reset base rates</button>
                  </div>
                )}
              </header>
              <DoorChartScreen chart={rules.doorChart} onChange={(doorChart) => setRules({ ...rules, doorChart })} role={role} />
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
