import { useMemo, useState } from 'react'
import { BellRing, FileSpreadsheet, FilePlus2, HandCoins, Percent, Receipt, Search, Wallet, AlertCircle } from 'lucide-react'
import { useStore } from '../lib/store'
import { CLASSES, SECTIONS, SHIFTS, TODAY, monthLabel, taka, type FeeInvoice, type Student } from '../lib/data'
import { downloadReceipt, downloadXlsx } from '../lib/export'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Stat, Tabs, cx, inputCls, type Tone } from '../components/ui'

type Method = NonNullable<FeeInvoice['method']>
type Status = 'paid' | 'partial' | 'due'
const METHODS: Method[] = ['Cash', 'bKash', 'Nagad', 'Bank']
const STATUS: Record<Status, { label: string; tone: Tone }> = { paid: { label: 'Paid', tone: 'teal' }, partial: { label: 'Partial', tone: 'marigold' }, due: { label: 'Due', tone: 'rose' } }
const statusOf = (f: FeeInvoice): Status => (f.paidAmount >= f.amount ? 'paid' : f.paidAmount > 0 ? 'partial' : 'due')
const receiptNo = (f: FeeInvoice) => `PS-${f.month.replace('-', '')}-${f.id}`
const nextMonth = (m: string) => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 7) }
const fmtDate = (d?: string) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—')
const sel = cx(inputCls, 'w-auto')

export default function Fees() {
  const { db, collectFee, generateInvoices, toast } = useStore()
  const months = useMemo(() => [...new Set(db.fees.map(f => f.month))].sort(), [db.fees])
  const [month, setMonth] = useState(months.includes(TODAY.slice(0, 7)) ? TODAY.slice(0, 7) : months[months.length - 1])
  const [cls, setCls] = useState('')
  const [section, setSection] = useState('')
  const [shift, setShift] = useState('')
  const [status, setStatus] = useState<'all' | Status>('all')
  const [q, setQ] = useState('')
  const [collecting, setCollecting] = useState<FeeInvoice | null>(null)
  const [ledger, setLedger] = useState<Student | null>(null)
  const [generating, setGenerating] = useState(false)

  const students = useMemo(() => new Map(db.students.map(s => [s.id, s])), [db.students])
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.fees.filter(f => f.month === month).flatMap(f => {
      const s = students.get(f.studentId)
      if (!s) return []
      if ((cls && s.cls !== cls) || (section && s.section !== section) || (shift && s.shift !== shift)) return []
      if (status !== 'all' && statusOf(f) !== status) return []
      if (t && !s.name.toLowerCase().includes(t) && !s.id.toLowerCase().includes(t)) return []
      return [{ f, s }]
    }).sort((a, b) => CLASSES.indexOf(a.s.cls as never) - CLASSES.indexOf(b.s.cls as never) || a.s.section.localeCompare(b.s.section) || a.s.shift.localeCompare(b.s.shift) || a.s.roll - b.s.roll)
  }, [db.fees, students, month, cls, section, shift, status, q])

  const billed = rows.reduce((a, r) => a + r.f.amount, 0)
  const collected = rows.reduce((a, r) => a + r.f.paidAmount, 0)
  const dueRows = rows.filter(r => r.f.paidAmount < r.f.amount)

  const exportDues = () => {
    if (!dueRows.length) return toast('No dues to export', 'err')
    downloadXlsx(`Fee_dues_${month}.xlsx`, { Dues: dueRows.map(({ f, s }) => ({ 'Student ID': s.id, Name: s.name, Class: s.cls, Section: s.section, Shift: s.shift, Roll: s.roll, Guardian: s.guardian, Phone: s.phone, Month: monthLabel(month), Amount: f.amount, Paid: f.paidAmount, Due: f.amount - f.paidAmount })) })
    toast(`Exported ${dueRows.length} dues`)
  }
  // Demo only: real SMS goes through an SMS gateway (e.g. via a Supabase edge function) later.
  const remind = () => {
    const n = new Set(dueRows.map(r => r.s.phone)).size
    toast(n ? `Reminder SMS queued for ${n} guardians` : 'Nobody has dues in this view', n ? 'ok' : 'err')
  }
  const reprint = (f: FeeInvoice, s: Student) => downloadReceipt({ receiptNo: receiptNo(f), student: s, month: monthLabel(f.month), amount: f.paidAmount, method: f.method ?? '—', date: f.paidOn ?? TODAY })

  return (
    <>
      <PageHeader title="Student fees" subtitle="Collect fees, print receipts and follow up on dues."
        actions={<>
          <Button variant="accent" icon={FilePlus2} onClick={() => setGenerating(true)}>Generate invoices</Button>
          <Button variant="outline" icon={FileSpreadsheet} onClick={exportDues}>Export dues (Excel)</Button>
          <Button variant="outline" icon={BellRing} onClick={remind}>Send due reminders</Button>
        </>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Billed" value={taka(billed)} icon={Wallet} hint={`${rows.length} students`} />
        <Stat label="Collected" value={taka(collected)} icon={HandCoins} tone="teal" hint={`${rows.length - dueRows.length} fully paid`} />
        <Stat label="Due" value={taka(billed - collected)} icon={AlertCircle} tone="rose" hint={`${dueRows.length} students owe`} />
        <Stat label="Collection rate" value={`${billed ? Math.round((collected / billed) * 100) : 0}%`} icon={Percent} tone="marigold" hint={monthLabel(month)} />
      </div>

      <Card className="mt-6" pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <select aria-label="Month" className={sel} value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select aria-label="Class" className={sel} value={cls} onChange={e => setCls(e.target.value)}>
            <option value="">All classes</option>{CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select aria-label="Section" className={sel} value={section} onChange={e => setSection(e.target.value)}>
            <option value="">All sections</option>{SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select aria-label="Shift" className={sel} value={shift} onChange={e => setShift(e.target.value)}>
            <option value="">All shifts</option>{SHIFTS.map(s => <option key={s} value={s}>{s} shift</option>)}
          </select>
          <Tabs value={status} onChange={setStatus} items={[{ value: 'all', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'partial', label: 'Partial' }, { value: 'due', label: 'Due' }]} />
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Search name or ID" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        {rows.length === 0 ? <EmptyState icon={Search} title="No matching invoices">Try another month or clear the filters.</EmptyState> : (
          <div className="scrollbar-thin max-h-[70vh] overflow-auto">
            <table className="tbl">
              <thead><tr><th>Student</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Due</th><th>Status</th><th>Paid on</th><th /></tr></thead>
              <tbody>
                {rows.map(({ f, s }) => {
                  const st = statusOf(f)
                  return (
                    <tr key={f.id}>
                      <td>
                        <button className="text-left font-semibold hover:text-marigold-deep hover:underline" onClick={() => setLedger(s)}>{s.name}</button>
                        <div className="text-xs text-ink-soft">{s.id} · {s.cls} · {s.section} · {s.shift}</div>
                      </td>
                      <td className="num">{taka(f.amount)}</td>
                      <td className="num text-teal">{f.paidAmount ? taka(f.paidAmount) : '—'}</td>
                      <td className={cx('num font-semibold', f.amount > f.paidAmount && 'text-rose')}>{f.amount > f.paidAmount ? taka(f.amount - f.paidAmount) : '—'}</td>
                      <td><Badge tone={STATUS[st].tone}>{STATUS[st].label}</Badge></td>
                      <td className="whitespace-nowrap text-ink-soft">{f.paidOn ? `${fmtDate(f.paidOn)} · ${f.method}` : '—'}</td>
                      <td className="text-right">
                        {st === 'paid'
                          ? <Button size="sm" variant="ghost" icon={Receipt} onClick={() => reprint(f, s)}>Receipt</Button>
                          : <Button size="sm" variant="outline" icon={HandCoins} onClick={() => setCollecting(f)}>Collect</Button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {collecting && <CollectModal inv={collecting} student={students.get(collecting.studentId)!} onClose={() => setCollecting(null)}
        onCollect={(amount, method) => {
          const s = students.get(collecting.studentId)!
          collectFee(collecting.id, amount, method)
          downloadReceipt({ receiptNo: receiptNo(collecting), student: s, month: monthLabel(collecting.month), amount, method, date: TODAY })
          toast('Payment recorded · receipt downloaded')
          setCollecting(null)
        }} />}

      {ledger && <LedgerModal student={ledger} fees={db.fees.filter(f => f.studentId === ledger.id)} onClose={() => setLedger(null)} onReceipt={f => reprint(f, ledger)} />}

      {generating && <GenerateModal months={months} onClose={() => setGenerating(false)}
        onGenerate={m => {
          const n = generateInvoices(m)
          toast(n ? `${n} invoices created for ${monthLabel(m)}` : `Every student already has an invoice for ${monthLabel(m)}`)
          setMonth(m)
          setGenerating(false)
        }} />}
    </>
  )
}

function CollectModal({ inv, student, onClose, onCollect }: { inv: FeeInvoice; student: Student; onClose: () => void; onCollect: (amount: number, method: Method) => void }) {
  const due = inv.amount - inv.paidAmount
  const [amount, setAmount] = useState(String(due))
  const [method, setMethod] = useState<Method>('Cash')
  const n = Number(amount)
  const ok = n > 0 && n <= due
  return (
    <Modal title="Collect fee" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" disabled={!ok} onClick={() => onCollect(n, method)}>Collect {ok ? taka(n) : ''}</Button></>}>
      <div className="mb-5 rounded-2xl bg-paper p-4">
        <div className="font-semibold">{student.name}</div>
        <div className="text-sm text-ink-soft">{student.id} · {student.cls} · {student.section} · {student.shift}</div>
        <div className="mt-3 flex justify-between text-sm"><span className="text-ink-soft">{monthLabel(inv.month)} fee</span><span className="font-semibold">{taka(inv.amount)}</span></div>
        {inv.paidAmount > 0 && <div className="flex justify-between text-sm"><span className="text-ink-soft">Already paid</span><span className="font-semibold text-teal">{taka(inv.paidAmount)}</span></div>}
        <div className="flex justify-between text-sm"><span className="text-ink-soft">Due now</span><span className="font-semibold text-rose">{taka(due)}</span></div>
      </div>
      <div className="space-y-4">
        <Field label="Amount received (৳)" hint={n > due ? `Cannot be more than ${taka(due)}` : n < due && n > 0 ? `${taka(due - n)} will stay due` : undefined}>
          <input type="number" min={1} max={due} inputMode="numeric" autoFocus className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Paid via</span>
          <Tabs value={method} onChange={setMethod} items={METHODS.map(m => ({ value: m, label: m }))} />
        </div>
      </div>
    </Modal>
  )
}

function LedgerModal({ student, fees, onClose, onReceipt }: { student: Student; fees: FeeInvoice[]; onClose: () => void; onReceipt: (f: FeeInvoice) => void }) {
  const list = [...fees].sort((a, b) => b.month.localeCompare(a.month))
  const billed = list.reduce((a, f) => a + f.amount, 0)
  const paid = list.reduce((a, f) => a + f.paidAmount, 0)
  return (
    <Modal title={`Fee ledger · ${student.name}`} onClose={onClose} wide>
      <div className="mb-4 text-sm text-ink-soft">{student.id} · {student.cls} · {student.section} · {student.shift} · Guardian {student.guardian} ({student.phone})</div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {([['Billed', billed, ''], ['Paid', paid, 'text-teal'], ['Due', billed - paid, 'text-rose']] as const).map(([l, v, c]) => (
          <div key={l} className="rounded-xl bg-paper p-3"><div className="text-xs text-ink-soft">{l}</div><div className={cx('font-display text-xl font-bold', c)}>{taka(v)}</div></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tbl">
          <thead><tr><th>Month</th><th className="num">Amount</th><th className="num">Paid</th><th className="num">Due</th><th>Paid on</th><th /></tr></thead>
          <tbody>
            {list.map(f => (
              <tr key={f.id}>
                <td className="font-semibold">{monthLabel(f.month)}</td>
                <td className="num">{taka(f.amount)}</td>
                <td className="num text-teal">{f.paidAmount ? taka(f.paidAmount) : '—'}</td>
                <td className={cx('num', f.amount > f.paidAmount && 'font-semibold text-rose')}>{f.amount > f.paidAmount ? taka(f.amount - f.paidAmount) : '—'}</td>
                <td className="whitespace-nowrap text-ink-soft">{f.paidOn ? `${fmtDate(f.paidOn)} · ${f.method}` : '—'}</td>
                <td className="text-right">{f.paidAmount > 0 && <Button size="sm" variant="ghost" icon={Receipt} onClick={() => onReceipt(f)}>Receipt</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

function GenerateModal({ months, onClose, onGenerate }: { months: string[]; onClose: () => void; onGenerate: (m: string) => void }) {
  const options = [...months, nextMonth(months[months.length - 1])]
  const [m, setM] = useState(options[options.length - 1])
  return (
    <Modal title="Generate invoices" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="accent" onClick={() => onGenerate(m)}>Generate for {monthLabel(m)}</Button></>}>
      <p className="mb-4 text-sm text-ink-soft">Creates a monthly fee invoice for every active student who doesn't have one for this month yet. Existing invoices are left untouched.</p>
      <Field label="Month">
        <select className={inputCls} value={m} onChange={e => setM(e.target.value)}>{options.map(o => <option key={o} value={o}>{monthLabel(o)}</option>)}</select>
      </Field>
    </Modal>
  )
}
