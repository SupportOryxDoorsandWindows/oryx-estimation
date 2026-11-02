// A revision as spreadsheet rows: every line with its original and revised values, plus the history.
import { STATUS_LABEL, totals, type RevisionDraft } from '../engine/revision'
import type { Cell, SheetRows } from './workbook'

export function revisionSheets(d: RevisionDraft): SheetRows[] {
  const refOf = (id?: string) => d.lines.find((l) => l.id === id)?.current.ref ?? ''
  const header = [
    'Revision', 'Status', 'Ref #', 'Location', 'Description', 'Replaces', 'Replaced by', 'Size revision',
    'Original width (mm)', 'Original height (mm)', 'Original qty', 'Original rate (AED)', 'Original amount (AED)',
    'Revised width (mm)', 'Revised height (mm)', 'Revised qty', 'Revised rate (AED)', 'Revised amount (AED)',
    'Difference (AED)', 'Zoho BOQ ID',
  ]
  const rows: Cell[][] = [header]
  for (const l of d.lines) {
    const o = l.original
    rows.push([
      d.reference, STATUS_LABEL[l.status], l.current.ref, l.current.location, l.current.description,
      refOf(l.replacesId), refOf(l.replacedById),
      l.sizeMode === 'withPrice' ? 'With price change' : l.sizeMode === 'withoutPrice' ? 'Without price change' : '',
      o?.widthMm ?? null, o?.heightMm ?? null, o?.qty ?? null, o ? Math.round(o.rate) : null, o ? Math.round(o.amount) : null,
      l.current.widthMm, l.current.heightMm, l.current.qty, Math.round(l.current.rate), Math.round(l.current.amount),
      Math.round(l.current.amount - (o?.amount ?? 0)), l.zohoId ?? '',
    ])
  }
  const t = totals(d)
  rows.push([])
  rows.push(['Totals', '', '', '', '', '', '', '', '', '', '', '', Math.round(t.original), '', '', '', '', Math.round(t.revised), Math.round(t.variation), ''])

  const summary: Cell[][] = [
    ['Item', 'Value'],
    ['Deal', d.source.dealName],
    ['Accepted proposal', d.source.reference],
    ['This revision', d.reference],
    ['Original total (AED)', Math.round(t.original)],
    ['Revised total (AED)', Math.round(t.revised)],
    ['Variation (AED)', Math.round(t.variation)],
    ...Object.entries(t.counts).filter(([, n]) => n).map(([k, n]): Cell[] => [STATUS_LABEL[k as keyof typeof STATUS_LABEL], n]),
  ]
  const history: Cell[][] = [['Time', 'Action', 'Ref #', 'Details'], ...d.history.map((h): Cell[] => [h.at, h.action, refOf(h.lineId), h.text])]

  return [
    { sheet: 'Summary', data: summary, widths: [24, 50] },
    { sheet: 'Revised BOQ', data: rows, widths: [12, 16, 8, 22, 30, 9, 11, 18, 10, 10, 8, 11, 12, 10, 10, 8, 11, 12, 12, 20] },
    { sheet: 'History', data: history, widths: [22, 13, 8, 90] },
  ]
}
