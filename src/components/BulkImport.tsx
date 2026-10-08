import { useMemo, useState } from 'react'
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { downloadXlsx, readSheet } from '../lib/export'
import { Badge, Button, Modal, cx } from './ui'

/** One spreadsheet column. `key` is the exact header and the field name on the record. */
export interface BulkColumn {
  key: string
  required?: boolean
  /** Returns an error message when the (non-empty) cell is invalid. */
  check?: (raw: string) => string | undefined
  /** Turns the cell text into the stored value. Defaults to the trimmed text. */
  coerce?: (raw: string) => unknown
}

// ---- reusable column helpers ----
export const oneOf = (opts: readonly string[]) => (raw: string) => (opts.some(o => o.toLowerCase() === raw.toLowerCase()) ? undefined : `must be one of: ${opts.join(', ')}`)
export const pickOf = (opts: readonly string[]) => (raw: string) => opts.find(o => o.toLowerCase() === raw.toLowerCase()) ?? raw
export const isNumber = (raw: string) => (Number.isFinite(Number(raw.replace(/,/g, ''))) ? undefined : 'must be a number')
export const toNumber = (raw: string) => Number(raw.replace(/,/g, ''))
/** Excel may turn dates into serial numbers; accept both that and YYYY-MM-DD. */
export const toDate = (raw: string) => (/^\d+(\.\d+)?$/.test(raw) ? new Date(Math.round((Number(raw) - 25569) * 864e5)).toISOString().slice(0, 10) : raw)
export const isDate = (raw: string) => (/^\d{4}-\d{2}-\d{2}$/.test(toDate(raw)) ? undefined : 'use the date format YYYY-MM-DD')
/** Excel drops the leading 0 of BD mobile numbers stored as numbers. */
export const toPhone = (raw: string) => { const d = raw.replace(/[^\d+]/g, ''); return /^1\d{9}$/.test(d) ? '0' + d : d }

interface Parsed { line: number; id: string; action: 'add' | 'update'; values: Record<string, unknown>; errors: string[] }

export default function BulkImport({ entity, columns, examples, existingIds, onApply, onClose }: {
  entity: string // singular, lower case: "student"
  columns: BulkColumn[]
  examples: Record<string, unknown>[]
  existingIds: Set<string>
  onApply: (rows: Record<string, unknown>[]) => void
  onClose: () => void
}) {
  const [file, setFile] = useState<string>()
  const [rows, setRows] = useState<Parsed[]>()
  const [readError, setReadError] = useState<string>()

  const template = () => downloadXlsx(`${entity}_import_template.xlsx`, {
    [`${entity}s`]: examples.map(e => Object.fromEntries(columns.map(c => [c.key, e[c.key] ?? '']))),
  })

  const load = async (f: File | undefined) => {
    if (!f) return
    setFile(f.name); setReadError(undefined)
    try {
      const raw = await readSheet(f)
      setRows(raw.map((r, i): Parsed => {
        // match headers case/space-insensitively
        const cell = (key: string) => { const k = Object.keys(r).find(h => h.trim().toLowerCase() === key.toLowerCase()); return k == null ? '' : String(r[k] ?? '').trim() }
        const id = cell('id')
        const action = id && existingIds.has(id) ? 'update' : 'add'
        const values: Record<string, unknown> = {}
        const errors: string[] = []
        for (const c of columns) {
          const v = cell(c.key)
          if (!v) { if (c.required && action === 'add') errors.push(`${c.key} is required`); continue } // blank cell on update = keep current value
          const err = c.check?.(v)
          if (err) errors.push(`${c.key} ${err}`)
          else values[c.key] = c.coerce ? c.coerce(v) : v
        }
        return { line: i + 2, id, action, values, errors }
      }).filter(r => Object.keys(r.values).length || r.errors.length))
    } catch {
      setRows(undefined); setReadError('Could not read this file. Save it as .xlsx or .csv and try again.')
    }
  }

  const counts = useMemo(() => ({
    add: rows?.filter(r => !r.errors.length && r.action === 'add').length ?? 0,
    update: rows?.filter(r => !r.errors.length && r.action === 'update').length ?? 0,
    bad: rows?.filter(r => r.errors.length).length ?? 0,
  }), [rows])
  const valid = counts.add + counts.update

  const apply = () => { onApply(rows!.filter(r => !r.errors.length).map(r => r.values)); onClose() }

  const step = (n: number, title: string, done: boolean) => (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={cx('grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold', done ? 'bg-teal text-white' : 'bg-ink/5 text-ink')}>{done ? <CheckCircle2 size={16} /> : n}</span>
      <h3 className="font-semibold">{title}</h3>
    </div>
  )

  return (
    <Modal wide title={`Bulk import or update ${entity}s`} onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!valid} onClick={apply}>{valid ? `Save ${valid} ${entity}${valid > 1 ? 's' : ''}` : `Save ${entity}s`}</Button>
      </>}>
      <div className="space-y-6">
        <section>
          {step(1, 'Download the template', false)}
          <div className="rounded-2xl bg-paper p-4 text-sm text-ink-soft">
            <p>Fill one row per {entity}. Keep the column names as they are.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>A row with an existing <b className="text-ink">id</b> updates that {entity}. Blank cells keep the current value.</li>
              <li>A row with an empty <b className="text-ink">id</b> adds a new {entity}.</li>
              <li>Tip: export the current list, edit it in Excel and upload it here to update many {entity}s at once.</li>
            </ul>
            <Button variant="outline" size="sm" icon={Download} className="mt-3" onClick={template}>Download template</Button>
          </div>
        </section>

        <section>
          {step(2, 'Upload the filled file', !!rows)}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-7 text-center hover:border-ink/40 hover:bg-paper">
            {file ? <FileSpreadsheet size={26} className="text-teal" /> : <Upload size={26} className="text-ink-soft" />}
            <span className="text-sm font-semibold">{file ?? 'Choose an .xlsx or .csv file'}</span>
            <span className="text-xs text-ink-soft">{file ? 'Click to choose a different file' : 'Excel or CSV, first sheet is used'}</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={e => { load(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {readError && <p className="mt-2 text-sm font-medium text-rose">{readError}</p>}
        </section>

        {rows && (
          <section>
            {step(3, 'Check and save', false)}
            {rows.length === 0 ? <p className="text-sm text-ink-soft">The file has no rows. Fill the template and upload it again.</p> : <>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="teal">{counts.add} will be added</Badge>
                <Badge tone="sky">{counts.update} will be updated</Badge>
                <Badge tone={counts.bad ? 'rose' : 'ink'}>{counts.bad} {counts.bad === 1 ? 'has' : 'have'} errors</Badge>
              </div>
              {counts.bad > 0 && <p className="mb-3 text-sm text-ink-soft">Rows with errors are skipped. Fix them in the file and upload again, or save the valid rows now.</p>}
              <div className="scrollbar-thin max-h-80 overflow-auto rounded-xl border border-line">
                <table className="tbl">
                  <thead><tr><th>Row</th><th>Result</th>{columns.map(c => <th key={c.key}>{c.key}</th>)}</tr></thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.line} className={r.errors.length ? 'bg-rose-soft/40' : ''}>
                        <td className="text-ink-soft">{r.line}</td>
                        <td className="min-w-48">
                          {r.errors.length
                            ? <span className="text-[13px] font-medium text-rose">{r.errors.join('; ')}</span>
                            : <Badge tone={r.action === 'add' ? 'teal' : 'sky'}>{r.action === 'add' ? 'Add' : 'Update'}</Badge>}
                        </td>
                        {columns.map(c => <td key={c.key} className="whitespace-nowrap">{String(r.values[c.key] ?? (c.key === 'id' ? r.id : ''))}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>}
          </section>
        )}
      </div>
    </Modal>
  )
}
