import { useEffect, useState } from 'react'
import { fmtAed, fmtNum } from '../engine/format'
import {
  addItem, canRevise, cancelItem, recalculatedRate, replaceItem, sizeRevision, startRevision, STATUS_LABEL, totals, undoLine,
  type LineSnapshot, type LineStatus, type RevisionDraft, type RevisionLine,
} from '../engine/revision'
import type { PricingRules, Product } from '../engine/types'
import { revisionSheets } from '../io/revisionWorkbook'
import { boqFileSource, isAccepted, type DealSummary, type ProposalSummary, type ZohoSource } from '../zoho/source'
import { downloadWorkbook, pickWorkbook } from './excelFile'
import { Card, Field, NumberInput, TextInput } from './fields'
import { Icon } from './icons'
import { ProductPicker } from './ProductPicker'

const TONE: Record<LineStatus, string> = {
  original: '', cancelled: 'pill-red', replaced: 'pill-red', additional: 'pill-green', replacement: 'pill-green', sizeRevised: 'pill-amber',
}

type ItemFields = Omit<LineSnapshot, 'amount'>
const blankItem = (): ItemFields => ({ ref: '', location: '', description: '', productId: '', widthMm: 0, heightMm: 0, panels: 1, qty: 1, rate: 0 })

/** Item details for Add Item and Replace Item. */
function ItemForm({ title, initial, products, onSave, onCancel }: {
  title: string; initial: ItemFields; products: Product[]; onSave: (i: ItemFields) => void; onCancel: () => void
}) {
  const [i, setI] = useState(initial)
  const set = <K extends keyof ItemFields>(k: K, v: ItemFields[K]) => setI({ ...i, [k]: v })
  const product = products.find((p) => p.id === i.productId)
  const valid = i.qty > 0 && i.rate >= 0 && (i.description.trim() !== '' || !!product)
  return (
    <div className="panel">
      <h3>{title}</h3>
      <div className="grid">
        <Field label="Ref #"><TextInput value={i.ref} onChange={(v) => set('ref', v)} /></Field>
        <Field label="Location"><TextInput value={i.location} onChange={(v) => set('location', v)} /></Field>
        <div className="field span-2">
          <span className="field-label">Product</span>
          <ProductPicker products={products} selectedId={i.productId} onPick={(id) => {
            const p = products.find((x) => x.id === id)
            setI({ ...i, productId: id, description: i.description || (p ? `${p.businessUnit} ${p.productCode} ${p.type}` : '') })
          }} />
        </div>
        <Field label="Description"><TextInput value={i.description} onChange={(v) => set('description', v)} /></Field>
      </div>
      <div className="grid grid-4">
        <Field label="Width (mm)"><NumberInput value={i.widthMm} min={0} suffix="mm" group onChange={(v) => set('widthMm', v)} /></Field>
        <Field label="Height (mm)"><NumberInput value={i.heightMm} min={0} suffix="mm" group onChange={(v) => set('heightMm', v)} /></Field>
        <Field label="No. of panels"><NumberInput value={i.panels} step="1" min={1} stepper onChange={(v) => set('panels', Math.max(1, Math.round(v)))} /></Field>
        <Field label="Qty"><NumberInput value={i.qty} step="1" min={1} stepper onChange={(v) => set('qty', Math.max(1, Math.round(v)))} /></Field>
        <Field label="Rate (AED)" hint="Price per item"><NumberInput value={i.rate} min={0} group onChange={(v) => set('rate', v)} /></Field>
        <Field label="Amount (AED)"><input type="text" disabled value={fmtAed(Math.round(i.rate * i.qty))} /></Field>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={!valid} onClick={() => onSave(i)}>Save</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        {!valid && <span className="muted small">Enter a description or product, a quantity and a rate.</span>}
      </div>
    </div>
  )
}

/** Size Revision, with or without price change. */
function SizePanel({ line, rules, onSave, onCancel }: {
  line: RevisionLine; rules: PricingRules; onSave: (w: number, h: number, mode: 'withPrice' | 'withoutPrice') => void; onCancel: () => void
}) {
  const o = line.original!
  const [w, setW] = useState(line.current.widthMm)
  const [h, setH] = useState(line.current.heightMm)
  const [mode, setMode] = useState<'withPrice' | 'withoutPrice'>(line.sizeMode ?? 'withoutPrice')
  const newRate = mode === 'withPrice' ? recalculatedRate(line, w, h, rules) : o.rate
  return (
    <div className="panel">
      <h3>Size revision – {line.current.ref}</h3>
      <div className="grid grid-4">
        <Field label="Width (mm)" hint={`Accepted: ${fmtNum(o.widthMm)}`}><NumberInput value={w} min={0} suffix="mm" group onChange={setW} /></Field>
        <Field label="Height (mm)" hint={`Accepted: ${fmtNum(o.heightMm)}`}><NumberInput value={h} min={0} suffix="mm" group onChange={setH} /></Field>
      </div>
      <div className="choice">
        <label className="check-field">
          <input type="radio" name={`mode-${line.id}`} className="check" checked={mode === 'withPrice'} disabled={!line.input} onChange={() => setMode('withPrice')} />
          With price change <span className="muted small">– recalculate the rate for the new size</span>
        </label>
        <label className="check-field">
          <input type="radio" name={`mode-${line.id}`} className="check" checked={mode === 'withoutPrice'} onChange={() => setMode('withoutPrice')} />
          Without price change <span className="muted small">– keep the agreed rate and amount</span>
        </label>
      </div>
      {!line.input && <p className="muted small">This line has no pricing inputs, so only “without price change” is available.</p>}
      {mode === 'withPrice' && line.priceNote === 'salesperson' && (
        <ul className="warnings"><li>Zoho's agreed rate for this line came from a salesperson price. The recalculated rate uses the pricing engine, so it may differ a lot from the agreed rate.</li></ul>
      )}
      <div className="calc">
        <div className="calc-row"><span className="calc-label">Rate (AED)</span><span className="calc-formula">{mode === 'withPrice' ? `Recalculated for ${fmtNum(w)} × ${fmtNum(h)} mm` : 'Agreed rate kept'}</span><span className="calc-value">{newRate === null ? '–' : fmtAed(Math.round(newRate))}</span></div>
        <div className="calc-row"><span className="calc-label">Amount (AED)</span><span className="calc-formula">{newRate === null ? '' : `${fmtAed(Math.round(newRate))} × ${o.qty} (accepted ${fmtAed(Math.round(o.amount))})`}</span><span className="calc-value">{newRate === null ? '–' : fmtAed(Math.round(newRate * o.qty))}</span></div>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled={newRate === null || w <= 0 || h <= 0} onClick={() => onSave(w, h, mode)}>Apply size revision</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

type Panel = { kind: 'add' } | { kind: 'replace'; id: string } | { kind: 'size'; id: string } | null

export function RevisionScreen({ rules, products, notify }: { rules: PricingRules; products: Product[]; notify: (t: string, tone?: 'ok' | 'warn' | 'error') => void }) {
  const [source, setSource] = useState<ZohoSource | null>(null)
  const [dealQuery, setDealQuery] = useState('')
  const [deals, setDeals] = useState<DealSummary[]>([])
  const [deal, setDeal] = useState<string>('')
  const [proposals, setProposals] = useState<ProposalSummary[]>([])
  const [draft, setDraft] = useState<RevisionDraft | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)

  // Nothing is stored, so warn before leaving with unsent changes.
  useEffect(() => {
    if (!draft?.history.length) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [draft])

  useEffect(() => {
    if (!source) return
    let live = true
    source.searchDeals(dealQuery).then((d) => live && setDeals(d.slice(0, 20)))
    return () => { live = false }
  }, [source, dealQuery])

  const loadTestFile = async () => {
    try {
      const sheets = await pickWorkbook()
      const src = boqFileSource('BOQ export', sheets, rules, products)
      setSource(src); setDeal(''); setProposals([]); setDraft(null)
      notify('BOQ export loaded for testing. It is held in this page only and is not saved.')
    } catch (err) {
      notify(`Could not load the BOQ export: ${(err as Error).message}`, 'error')
    }
  }

  const pickDeal = async (name: string) => {
    if (draft?.history.length && !confirm('Discard the revision in progress?')) return
    setDeal(name); setDraft(null); setPanel(null)
    setProposals(await source!.proposals(name))
  }

  const open = async (p: ProposalSummary) => {
    if (draft?.history.length && !confirm('Discard the revision in progress?')) return
    setBusy(true)
    try {
      const lines = await source!.boq(p)
      setDraft(startRevision(p, lines, proposals.map((x) => x.revision)))
      setPanel(null)
    } finally {
      setBusy(false)
    }
  }

  const act = (fn: (d: RevisionDraft) => RevisionDraft) => {
    try {
      setDraft(fn(draft!)); setPanel(null)
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  const accepted = proposals.filter((p) => isAccepted(p.status))
  const hidden = proposals.length - accepted.length
  const t = draft ? totals(draft) : null
  const refOf = (id?: string) => draft?.lines.find((l) => l.id === id)?.current.ref || '—'

  return (
    <div className="stack">
      <div className={`source-bar ${source?.live ? 'live' : ''}`}>
        <div>
          <strong>{source?.live ? 'Connected to Zoho' : 'Zoho is not connected yet'}</strong>
          <span className="muted small">
            {source
              ? ` · ${source.label}. Held in this page only; nothing is saved in the app.`
              : ' · Deals and accepted proposals will come from Zoho CRM and Zoho Creator once the connection is set up. For now, load a BOQ_Summary export to test revisions.'}
          </span>
        </div>
        <button type="button" className="btn btn-sm" onClick={loadTestFile}>{source ? 'Load another export' : 'Load BOQ export for testing'}</button>
      </div>

      {source && (
        <Card title="Select the accepted proposal">
          <div className="grid">
            <div className="field span-2">
              <span className="field-label">Deal Name</span>
              <input type="search" value={dealQuery} placeholder="Search deals" onChange={(e) => setDealQuery(e.target.value)} />
              <div className="choice-list">
                {deals.length === 0 && <span className="muted small">No deals match.</span>}
                {deals.map((d) => (
                  <button key={d.name} type="button" className={`choice-item ${d.name === deal ? 'on' : ''}`} onClick={() => pickDeal(d.name)}>{d.name}</button>
                ))}
              </div>
            </div>
            {deal && (
              <div className="field span-2">
                <span className="field-label">Accepted proposal</span>
                <div className="choice-list">
                  {accepted.length === 0 && <span className="muted small">This deal has no accepted proposal.</span>}
                  {accepted.map((p) => (
                    <button key={p.reference} type="button" disabled={busy} className={`choice-item ${draft?.source.reference === p.reference ? 'on' : ''}`} onClick={() => open(p)}>
                      <strong>{p.reference}</strong> <span className="muted">· {p.status} · {p.lineCount} lines · AED {fmtAed(Math.round(p.total))}</span>
                    </button>
                  ))}
                </div>
                {hidden > 0 && <span className="field-hint">{hidden} other {hidden === 1 ? 'proposal is' : 'proposals are'} not accepted and not shown.</span>}
              </div>
            )}
          </div>
        </Card>
      )}

      {draft && t && (
        <>
          <section className="card summary rev-bar" aria-labelledby="rev-summary">
            <div className="card-head"><h2 id="rev-summary">Revision {draft.reference}</h2><span className="card-aside">from {draft.source.reference} · {draft.source.dealName}</span></div>
            <div className="card-body rev-bar-body">
              <div className="figure">
                <span className="figure-label">Variation (AED)</span>
                <span className="figure-value">{t.variation > 0 ? '+' : ''}{fmtAed(Math.round(t.variation))}</span>
              </div>
              <div className="figure"><span className="figure-label">Accepted total (AED)</span><span className="figure-value sm">{fmtAed(Math.round(t.original))}</span></div>
              <div className="figure"><span className="figure-label">Revised total (AED)</span><span className="figure-value sm">{fmtAed(Math.round(t.revised))}</span></div>
              <div className="chips rev-counts">
                {(Object.keys(t.counts) as LineStatus[]).filter((k) => k !== 'original' && t.counts[k]).map((k) => (
                  <span key={k} className={`pill ${TONE[k]}`}>{t.counts[k]} {STATUS_LABEL[k]}</span>
                ))}
                {draft.history.length === 0 && <span className="muted small">No changes yet</span>}
              </div>
              <div className="rev-buttons">
                <button type="button" className="btn" onClick={() => downloadWorkbook(`${draft.reference}-revision.xlsx`, revisionSheets(draft))}>Export revision (Excel)</button>
                <button type="button" className="btn btn-primary" disabled={!source?.submit || !draft.history.length}
                  title={source?.submit ? undefined : 'Needs the live Zoho connection'}
                  onClick={async () => { await source!.submit!(draft); notify(`${draft.reference} sent to Zoho.`) }}>
                  Submit to Zoho
                </button>
              </div>
            </div>
            {!source?.submit && <p className="muted small rev-note">Submitting needs the live Zoho connection. Until then, export the revision to Excel.</p>}
          </section>

            <Card title={`BOQ – ${draft.source.reference} → ${draft.reference}`} aside={`${draft.lines.length} lines`}>
              <div className="table-wrap">
                <table className="table revision">
                  <thead>
                    <tr>
                      <th>Ref #</th><th>Description</th><th className="num">Size (mm)</th><th className="num">Qty</th>
                      <th className="num">Rate (AED)</th><th className="num">Amount (AED)</th><th>Status</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((l) => {
                      const o = l.original
                      const changed = (a?: number, b?: number) => o && a !== b
                      return [
                        <tr key={l.id} className={`${l.status === 'cancelled' || l.status === 'replaced' ? 'struck' : ''} ${l.replacesId ? 'child' : ''}`}>
                          <td><span className="ref">{l.current.ref || '—'}</span></td>
                          <td>
                            <div>{l.replacesId && <span className="muted">↳ </span>}{l.current.description || <span className="muted">—</span>}</div>
                            <div className="muted small">
                              {l.current.location}
                              {l.replacesId && ` · replaces ${refOf(l.replacesId)}`}
                              {l.replacedById && ` · replaced by ${refOf(l.replacedById)}`}
                            </div>
                          </td>
                          <td className="num">
                            {changed(l.current.widthMm, o?.widthMm) || changed(l.current.heightMm, o?.heightMm)
                              ? <><s className="muted">{fmtNum(o!.widthMm)} × {fmtNum(o!.heightMm)}</s><br />{fmtNum(l.current.widthMm)} × {fmtNum(l.current.heightMm)}</>
                              : `${fmtNum(l.current.widthMm)} × ${fmtNum(l.current.heightMm)}`}
                          </td>
                          <td className="num">{changed(l.current.qty, o?.qty) ? <><s className="muted">{o!.qty}</s> {l.current.qty}</> : l.current.qty}</td>
                          <td className="num">{changed(Math.round(l.current.rate), Math.round(o?.rate ?? 0)) && l.status === 'sizeRevised' ? <><s className="muted">{fmtAed(Math.round(o!.rate))}</s><br />{fmtAed(Math.round(l.current.rate))}</> : fmtAed(Math.round(l.current.rate))}</td>
                          <td className="num strong">{changed(Math.round(l.current.amount), Math.round(o?.amount ?? 0)) ? <><s className="muted">{fmtAed(Math.round(o!.amount))}</s><br />{fmtAed(Math.round(l.current.amount))}</> : fmtAed(Math.round(l.current.amount))}</td>
                          <td>
                            {l.status === 'original' ? <span className="chip">Original</span> : <span className={`pill ${TONE[l.status]}`}>{STATUS_LABEL[l.status]}</span>}
                            {l.sizeMode && <div className="muted small">{l.sizeMode === 'withPrice' ? 'With price change' : 'Without price change'}</div>}
                          </td>
                          <td><div className="row-actions">
                            {canRevise(l) && (
                              <>
                                <button type="button" className="link" onClick={() => setPanel({ kind: 'size', id: l.id })}>Size revision</button>
                                <button type="button" className="link" onClick={() => setPanel({ kind: 'replace', id: l.id })}>Replace</button>
                                <button type="button" className="link danger" onClick={() => act((d) => cancelItem(d, l.id))}>Cancel item</button>
                              </>
                            )}
                            {l.status !== 'original' && l.status !== 'replacement' && (
                              <button type="button" className="link" onClick={() => act((d) => undoLine(d, l.id))}>{o ? 'Undo' : 'Remove'}</button>
                            )}
                          </div></td>
                        </tr>,
                        panel && panel.kind !== 'add' && panel.id === l.id && (
                          <tr key={`${l.id}-panel`} className="panel-row">
                            <td colSpan={8}>
                              {panel.kind === 'size' ? (
                                <SizePanel line={l} rules={rules} onCancel={() => setPanel(null)}
                                  onSave={(w, h, mode) => act((d) => sizeRevision(d, l.id, w, h, mode, rules))} />
                              ) : (
                                <ItemForm title={`Replacement for ${l.current.ref}`} products={products} onCancel={() => setPanel(null)}
                                  initial={{ ...l.original!, ref: `${l.current.ref}R` }}
                                  onSave={(i) => act((d) => replaceItem(d, l.id, i))} />
                              )}
                            </td>
                          </tr>
                        ),
                      ]
                    })}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={5}>Revised total (AED)</td><td className="num strong">{fmtAed(Math.round(t.revised))}</td><td colSpan={2} /></tr>
                  </tfoot>
                </table>
              </div>
              {panel?.kind === 'add' ? (
                <ItemForm title="Additional item" products={products} initial={blankItem()} onCancel={() => setPanel(null)}
                  onSave={(i) => act((d) => addItem(d, i))} />
              ) : (
                <button type="button" className="btn btn-sm" onClick={() => setPanel({ kind: 'add' })}><Icon name="plus" size={16} /> Add item</button>
              )}
            </Card>

            <Card title="Revision history" aside={`${draft.history.length} ${draft.history.length === 1 ? 'change' : 'changes'}`}>
              {draft.history.length === 0 ? <p className="muted">No changes yet. Use the actions on each BOQ line.</p> : (
                <ol className="history">
                  {draft.history.map((h, i) => (
                    <li key={i}><span className="muted small">{new Date(h.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> {h.text}</li>
                  ))}
                </ol>
              )}
            </Card>
        </>
      )}
    </div>
  )
}
