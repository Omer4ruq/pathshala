import { useMemo, useState } from 'react'
import { Banknote, CheckCheck, CheckCircle2, Clock, FileSpreadsheet, FileText, Wallet } from 'lucide-react'
import { useStore } from '../lib/store'
import { TODAY, monthLabel, taka, type SalaryRecord, type Teacher } from '../lib/data'
import { downloadReportPdf, downloadXlsx, tk } from '../lib/export'
import { Avatar, Badge, Button, Card, EmptyState, Modal, PageHeader, Stat, cx, inputCls } from '../components/ui'

const fmtDate = (d?: string) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')

export default function Salaries() {
  const { db, paySalary, toast } = useStore()
  const months = useMemo(() => [...new Set(db.salaries.map(s => s.month))].sort(), [db.salaries])
  const [month, setMonth] = useState(months.includes(TODAY.slice(0, 7)) ? TODAY.slice(0, 7) : months[months.length - 1])
  const [confirm, setConfirm] = useState<SalaryRecord[] | null>(null)

  const teachers = useMemo(() => new Map(db.teachers.map(t => [t.id, t])), [db.teachers])
  const rows = db.salaries.filter(s => s.month === month && teachers.has(s.teacherId)).map(s => ({ s, t: teachers.get(s.teacherId)! }))
    .sort((a, b) => Number(a.s.paid) - Number(b.s.paid) || a.t.name.localeCompare(b.t.name))
  const total = rows.reduce((a, r) => a + r.s.amount, 0)
  const pending = rows.filter(r => !r.s.paid)
  const pendingTotal = pending.reduce((a, r) => a + r.s.amount, 0)

  const payslip = (s: SalaryRecord, t: Teacher) => downloadReportPdf({
    filename: `Payslip_${t.id}_${s.month}.pdf`, title: 'Salary payslip', subtitle: monthLabel(s.month),
    tables: [{ head: ['Item', 'Details'], body: [['Teacher', `${t.name} (${t.id})`], ['Subject', t.subject], ['Month', monthLabel(s.month)], ['Net salary', tk(s.amount)], ['Status', s.paid ? 'Paid' : 'Pending'], ['Paid on', s.paidOn ?? '—']] }],
  })
  const exportXlsx = () => downloadXlsx(`Salaries_${month}.xlsx`, {
    Salaries: rows.map(({ s, t }) => ({ 'Teacher ID': t.id, Name: t.name, Subject: t.subject, Phone: t.phone, Month: monthLabel(month), Amount: s.amount, Status: s.paid ? 'Paid' : 'Pending', 'Paid on': s.paidOn ?? '' })),
  })
  const pay = (list: SalaryRecord[]) => {
    list.forEach(s => paySalary(s.id))
    const sum = list.reduce((a, s) => a + s.amount, 0)
    toast(list.length === 1 ? `Salary of ${taka(sum)} marked paid` : `${list.length} salaries paid · ${taka(sum)}`)
    setConfirm(null)
  }

  return (
    <>
      <PageHeader title="Teacher salaries" subtitle="Monthly payroll: who has been paid and who is waiting."
        actions={<>
          <select aria-label="Month" className={cx(inputCls, 'w-auto')} value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <Button variant="outline" icon={FileSpreadsheet} onClick={exportXlsx}>Export Excel</Button>
          <Button variant="accent" icon={CheckCheck} disabled={!pending.length} onClick={() => setConfirm(pending.map(r => r.s))}>Pay all pending</Button>
        </>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Payroll total" value={taka(total)} icon={Wallet} hint={`${rows.length} teachers`} />
        <Stat label="Paid" value={taka(total - pendingTotal)} icon={CheckCircle2} tone="teal" hint={`${rows.length - pending.length} teachers`} />
        <Stat label="Pending" value={taka(pendingTotal)} icon={Clock} tone="rose" hint={pending.length ? `${pending.length} teachers waiting` : 'Everyone is paid'} />
      </div>

      <Card className="mt-6" pad={false} title={`Payroll · ${monthLabel(month)}`}>
        {rows.length === 0 ? <EmptyState icon={Banknote} title="No salary records for this month" /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Teacher</th><th className="num">Amount</th><th>Status</th><th>Paid on</th><th /></tr></thead>
              <tbody>
                {rows.map(({ s, t }) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={t.name} size={34} />
                        <div><div className="font-semibold">{t.name}</div><div className="text-xs text-ink-soft">{t.subject} · {t.id}</div></div>
                      </div>
                    </td>
                    <td className="num font-semibold">{taka(s.amount)}</td>
                    <td>{s.paid ? <Badge tone="teal">Paid</Badge> : <Badge tone="rose">Pending</Badge>}</td>
                    <td className="whitespace-nowrap text-ink-soft">{fmtDate(s.paidOn)}</td>
                    <td className="text-right">
                      {s.paid
                        ? <Button size="sm" variant="ghost" icon={FileText} onClick={() => payslip(s, t)}>Payslip</Button>
                        : <Button size="sm" variant="outline" icon={Banknote} onClick={() => setConfirm([s])}>Mark paid</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {confirm && (
        <Modal title={confirm.length === 1 ? 'Mark salary as paid' : 'Pay all pending salaries'} onClose={() => setConfirm(null)}
          footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="accent" onClick={() => pay(confirm)}>Pay {taka(confirm.reduce((a, s) => a + s.amount, 0))}</Button></>}>
          <p className="text-[15px]">
            {confirm.length === 1
              ? <>Record <b>{taka(confirm[0].amount)}</b> paid to <b>{teachers.get(confirm[0].teacherId)?.name}</b> for {monthLabel(confirm[0].month)}?</>
              : <>Record salary payments for <b>{confirm.length} teachers</b> for {monthLabel(month)}, totalling <b>{taka(confirm.reduce((a, s) => a + s.amount, 0))}</b>?</>}
          </p>
          <p className="mt-2 text-sm text-ink-soft">The payment date will be today ({fmtDate(TODAY)}).</p>
        </Modal>
      )}
    </>
  )
}
