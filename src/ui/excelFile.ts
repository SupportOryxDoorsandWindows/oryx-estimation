// The universal reader also opens Zoho exports (zip entries with data descriptors).
import readXlsxFile from 'read-excel-file/universal'
import writeXlsxFile from 'write-excel-file/browser'
import type { ReadSheet, SheetRows } from '../io/workbook'

export async function downloadWorkbook(fileName: string, sheets: SheetRows[]) {
  await writeXlsxFile(
    sheets.map((s) => ({
      sheet: s.sheet,
      data: s.data.map((row, r) => row.map((value) => (value === null ? null : r === 0 ? { value, fontWeight: 'bold' as const } : value))),
      columns: s.widths?.map((width) => ({ width })),
      stickyRowsCount: 1,
    })),
    { fontFamily: 'Calibri', fontSize: 11 },
  ).toFile(fileName)
}

/** Asks the user for an .xlsx file and returns every sheet in it. */
export function pickWorkbook(): Promise<ReadSheet[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return reject(new Error('No file selected'))
      try {
        resolve((await readXlsxFile(await file.arrayBuffer())) as ReadSheet[])
      } catch {
        reject(new Error('The file could not be read as an Excel (.xlsx) workbook'))
      }
    }
    input.click()
  })
}
