import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Download, HandCoins, Plus, Receipt, Scale, Wallet, Banknote } from 'lucide-react'
import { useStore } from '../lib/store'
import { CLASSES, TODAY, monthLabel, taka } from '../lib/data'
import { downloadReportPdf, tk } from '../lib/export'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Stat, cx, inputCls } from '../components/ui'

const CATEGORIES = ['Utilities', 'Supplies', 'Maintenance', 'Events', 'Transport', 'Other']
const shortMonth = (m: string) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const kTaka = (n: number) => (n >= 1000 ? `৳${Math.round(n / 1000)}k` : `৳${n}`)
const tip = { contentStyle: { borderRadius: 12, border: '1px solid #E4E7EE', fontSize: 13 }, cursor: { fill: '#14213D08' } }

export default function Finance() {
  const { db, addExpense, toast } = useStore()
  const months = useMemo(() => [...new Set([...db.fees.map(f => f.month), ...db.salaries.map(s => s.month)])].sort(), [db.fees, db.salaries])
  const [month, setMonth] = useState(months.includes(TODAY.slice(0, 7)) ? TODAY.slice(0, 7) : months[months.length - 1])
  const [adding, setAdding] = useState(false)

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const totals = (m: string) => {
    const fees = db.fees.filter(f => f.month === m)
    const sal = db.salaries.filter(s => s.month === m)
    const collected = sum(fees.map(f => f.paidAmount))
    const billed = sum(fees.map(f => f.amount))
    const salPaid = sum(sal.filter(s => s.paid).map(s => s.amount))
    const salPending = sum(sal.filter(s => !s.paid).map(s => s.amount))
    const other = sum(db.expenses.filter(x => x.date.startsWith(m)).map(x => x.amount))
    return { collected, billed, due: billed - collected, salPaid, salPending, other, net: collected - salPaid - other }
  }
  const t = totals(month)
  const allDue = sum(db.fees.filter(f => f.month <= month).map(f => f.amount - f.paidAmount))

  const chart = months.slice(-3).map(m => { const x = totals(m); return { name: shortMonth(m), Income: x.collected, Salaries: x.salPaid, 'Other expenses': x.other } })

  const byClass = useMemo(() => {
    const cls = new Map(db.students.map(s => [s.id, s.cls]))
    return CLASSES.map(c => {
      const f = db.fees.filter(x => x.month === month && cls.get(x.studentId) === c)
      const billed = sum(f.map(x => x.amount))
      return { name: c, rate: billed ? Math.round((sum(f.map(x => x.paidAmount)) / billed) * 100) : 0, billed }
    }).filter(r => r.billed).sort((a, b) => a.rate - b.rate)
  }, [db.fees, db.students, month])

  const recent = useMemo(() => {
    const stu = new Map(db.students.map(s => [s.id, s.name]))
    const tch = new Map(db.teachers.map(x => [x.id, x.name]))
    return [
      ...db.fees.filter(f => f.paidOn && f.paidAmount).map(f => ({ id: f.id, date: f.paidOn!, label: stu.get(f.studentId) ?? f.studentId, sub: `Fee · ${monthLabel(f.month)} · ${f.method}`, amount: f.paidAmount, income: true })),
      ...db.salaries.filter(s => s.paid && s.paidOn).map(s => ({ id: s.id, date: s.paidOn!, label: tch.get(s.teacherId) ?? s.teacherId, sub: `Salary · ${monthLabel(s.month)}`, amount: s.amount, income: false })),
      ...db.expenses.map(x => ({ id: x.id, date: x.date, label: x.note || x.category, sub: `Expense · ${x.category}`, amount: x.amount, income: false })),
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  }, [db])

  const expenses = db.expenses.filter(x => x.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date))

  const statement = () => downloadReportPdf({
    filename: `Statement_${month}.pdf`, title: 'Monthly statement', subtitle: monthLabel(month),
    summary: [['Income', tk(t.collected)], ['Expenses', tk(t.salPaid + t.other)], ['Net', tk(t.net)]],
    tables: [
      { title: 'Summary', head: ['Item', 'Amount'], body: [['Fees billed', tk(t.billed)], ['Fees collected', tk(t.collected)], ['Fees due', tk(t.due)], ['Salaries paid', tk(t.salPaid)], ['Salaries pending', tk(t.salPending)], ['Other expenses', tk(t.other)], ['Net balance', tk(t.net)]] },
      { title: 'Collection by class', head: ['Class', 'Billed', 'Collection rate'], body: byClass.map(r => [r.name, tk(r.billed), `${r.rate}%`]) },
      { title: 'Expenses', head: ['Date', 'Category', 'Note', 'Amount'], body: expenses.map(x => [x.date, x.category, x.note, tk(x.amount)]) },
    ],
  })

  return (
    <>
      <PageHeader title="Finance overview" subtitle="Money in, money out, and what is still owed."
        actions={<>
          <select aria-label="Month" className={cx(inputCls, 'w-auto')} value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <Button variant="outline" icon={Download} onClick={statement}>Download monthly statement (PDF)</Button>
        </>} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Stat label="Fees collected" value={taka(t.collected)} icon={HandCoins} tone="teal" hint={`${t.billed ? Math.round((t.collected / t.billed) * 100) : 0}% of ${taka(t.billed)} billed`} />
        <Stat label="Outstanding dues" value={taka(t.due)} icon={Receipt} tone="rose" hint={`${taka(allDue)} across all months`} />
        <Stat label="Salaries" value={taka(t.salPaid)} icon={Banknote} tone="sky" hint={t.salPending ? `${taka(t.salPending)} still to pay` : 'All paid'} />
        <Stat label="Other expenses" value={taka(t.other)} icon={Wallet} tone="marigold" hint={`${expenses.length} entries`} />
        <Stat label="Net balance" value={<span className={t.net < 0 ? 'text-rose' : 'text-teal'}>{taka(t.net)}</span>} icon={Scale} tone={t.net < 0 ? 'rose' : 'teal'} hint="Collected minus paid out" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Income vs expenses" className="lg:col-span-3">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart} barGap={6}>
                <CartesianGrid vertical={false} stroke="#E4E7EE" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={kTaka} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={v => taka(Number(v))} {...tip} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Income" fill="#1F9D8B" radius={[8, 8, 0, 0]} maxBarSize={44} />
                <Bar dataKey="Salaries" stackId="out" fill="#E0475B" maxBarSize={44} />
                <Bar dataKey="Other expenses" stackId="out" fill="#F29AA6" radius={[8, 8, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Collection rate by class" action={<span className="text-xs text-ink-soft">Lowest first</span>} className="lg:col-span-2">
          <div style={{ height: Math.max(200, byClass.length * 26) }}>
            <ResponsiveContainer>
              <BarChart data={byClass} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={64} fontSize={12} />
                <Tooltip formatter={v => `${v}% collected`} {...tip} />
                <Bar dataKey="rate" radius={[0, 6, 6, 0]} barSize={14} background={{ fill: '#F6F7F9', radius: 6 }}>
                  {byClass.map(r => <Cell key={r.name} fill={r.rate < 50 ? '#E0475B' : r.rate < 80 ? '#F4A93B' : '#1F9D8B'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Recent transactions" className="lg:col-span-2">
          <ul className="divide-y divide-line">
            {recent.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', r.income ? 'bg-teal-soft text-teal' : 'bg-rose-soft text-rose')}>
                  {r.income ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.label}</span>
                  <span className="block truncate text-xs text-ink-soft">{fmtDate(r.date)} · {r.sub}</span>
                </span>
                <span className={cx('text-sm font-semibold tabular-nums', r.income ? 'text-teal' : 'text-rose')}>{r.income ? '+' : '−'}{taka(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Expenses · ${monthLabel(month)}`} pad={false} className="lg:col-span-3"
          action={<Button size="sm" icon={Plus} onClick={() => setAdding(true)}>Add expense</Button>}>
          {expenses.length === 0 ? <EmptyState icon={Wallet} title="No expenses this month">Add bills, supplies or repairs as they happen.</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="num">Amount</th></tr></thead>
                <tbody>
                  {expenses.map(x => (
                    <tr key={x.id}>
                      <td className="whitespace-nowrap">{fmtDate(x.date)}</td>
                      <td><Badge tone="marigold">{x.category}</Badge></td>
                      <td className="text-ink-soft">{x.note}</td>
                      <td className="num font-semibold">{taka(x.amount)}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={3} className="font-semibold">Total</td><td className="num font-bold text-rose">{taka(t.other)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {adding && <AddExpense onClose={() => setAdding(false)} onSave={x => { addExpense(x); setAdding(false); toast(`Expense of ${taka(x.amount)} added`) }} />}
    </>
  )
}

function AddExpense({ onClose, onSave }: { onClose: () => void; onSave: (x: { date: string; category: string; note: string; amount: number }) => void }) {
  const [f, setF] = useState({ date: TODAY, category: CATEGORIES[0], note: '', amount: '' })
  const amount = Number(f.amount)
  const ok = f.date && amount > 0
  return (
    <Modal title="Add expense" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!ok} onClick={() => onSave({ ...f, note: f.note.trim(), amount })}>Add {amount > 0 ? taka(amount) : 'expense'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date"><input type="date" className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Category">
          <select className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        </Field>
        <div className="sm:col-span-2"><Field label="Note"><input className={inputCls} placeholder="e.g. Water bill (WASA)" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field></div>
        <Field label="Amount (৳)"><input type="number" min={1} inputMode="numeric" className={inputCls} value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}
