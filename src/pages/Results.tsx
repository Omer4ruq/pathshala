import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarCheck, Download, FileSpreadsheet, FileText, Percent, Trophy, Users } from 'lucide-react'
import { useMyGroups, useStore } from '../lib/store'
import { groupKey, groupLabel, subjectsFor, TODAY, type Student } from '../lib/data'
import { DEFAULT_WEIGHTS, rankGroup, type Range, type Weights } from '../lib/grading'
import { downloadClassMarksheets, downloadMarksheet, downloadXlsx } from '../lib/export'
import { Avatar, Badge, Button, Card, EmptyState, GroupPicker, Modal, PageHeader, Stat, Tabs, cx, gradeTone, inputCls } from '../components/ui'

type Term = 'mid' | 'final'
const TERMS: Record<Term, { label: string; range: Range; title: string }> = {
  mid: { label: 'Mid term (to date)', range: { to: TODAY }, title: 'Mid term 2026 (to date)' },
  final: { label: 'Final term', range: {}, title: 'Final term 2026' },
}
const WEIGHT_FIELDS: { key: keyof Weights; label: string }[] = [
  { key: 'class_test', label: 'Class tests' },
  { key: 'mid_term', label: 'Mid term' },
  { key: 'final', label: 'Final' },
  { key: 'attendance', label: 'Attendance' },
]
const fmt = (n: number | null | undefined, d = 0) => (n == null ? '—' : n.toFixed(d))
const GRADE_COLOR = { teal: '#1F9D8B', sky: '#3B7DD8', marigold: '#F4A93B', rose: '#E0475B', ink: '#CBD2E0' }

type Row = ReturnType<typeof rankGroup>[number]

export default function Results() {
  const { db, weights, setWeights, toast } = useStore()
  const groups = useMyGroups()
  const [key, setKey] = useState(() => { const g = groups.find(g => g.isClassTeacher) ?? groups[0]; return g ? groupKey(g) : '' })
  const [term, setTerm] = useState<Term>('mid')
  const [open, setOpen] = useState<Row | null>(null)
  const group = groups.find(g => groupKey(g) === key) ?? null
  const t = TERMS[term]

  const students = useMemo(() => group ? db.students.filter(s => s.status === 'active' && groupKey(s) === key).sort((a, b) => a.roll - b.roll) : [], [db.students, key, group])
  const rows = useMemo(() => rankGroup(db, students, t.range, weights), [db, students, t.range, weights])
  const subjects = group ? subjectsFor(group.cls) : []

  const summary = useMemo(() => {
    const graded = rows.filter(r => r.result.overall != null)
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    return {
      avg: mean(graded.map(r => r.result.overall!)),
      top: graded[0],
      passed: graded.filter(r => r.result.gpa! > 0).length,
      graded: graded.length,
      att: mean(rows.flatMap(r => (r.result.attendance == null ? [] : [r.result.attendance]))),
    }
  }, [rows])

  if (!group) return <><PageHeader title="Results & marksheets" /><Card><EmptyState icon={Trophy} title="No classes assigned yet">Once you're assigned to a class, its results show up here.</EmptyState></Card></>

  const fileBase = `${group.cls}_${group.section}_${group.shift}_${term === 'mid' ? 'Mid_term' : 'Final_term'}`.replace(/\s+/g, '_')
  const sum = Object.values(weights).reduce((a, b) => a + b, 0)

  const exportExcel = () => {
    downloadXlsx(`Results_${fileBase}.xlsx`, {
      Results: rows.map(r => ({
        Position: r.position, ID: r.student.id, Roll: r.student.roll, Name: r.student.name,
        ...Object.fromEntries(r.result.subjects.flatMap(s => [[`${s.subject} %`, s.total == null ? '' : +s.total.toFixed(1)], [`${s.subject} grade`, s.grade]])),
        'Attendance %': r.result.attendance == null ? '' : +r.result.attendance.toFixed(1),
        'Overall %': r.result.overall == null ? '' : +r.result.overall.toFixed(1),
        GPA: r.result.gpa == null ? '' : +r.result.gpa.toFixed(2), Grade: r.result.grade,
      })),
    })
    toast('Results exported to Excel')
  }
  const sheet = (r: Row) => { downloadMarksheet(r.student, r.result, t.title, r.position, rows.length); toast(`Marksheet for ${r.student.name} downloaded`) }

  return (
    <>
      <PageHeader
        title="Results & marksheets"
        subtitle="Calculated from the marks and attendance already entered. Change a weight and everything updates."
        actions={<>
          <Button variant="outline" icon={FileSpreadsheet} onClick={exportExcel}>Export results (Excel)</Button>
          <Button variant="accent" icon={Download} onClick={() => { downloadClassMarksheets(rows, t.title, `Marksheets_${fileBase}.pdf`); toast(`${rows.length} marksheets downloaded`) }}>Download all marksheets (PDF)</Button>
        </>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <GroupPicker allowed={groups} value={group} onChange={g => g && setKey(groupKey(g))} />
        <Tabs value={term} onChange={setTerm} items={(Object.keys(TERMS) as Term[]).map(k => ({ value: k, label: TERMS[k].label }))} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Class average" value={`${fmt(summary.avg, 1)}%`} icon={Percent} tone="sky" hint={`${rows.length} students`} />
        <Stat label="Top of the class" value={summary.top ? `${fmt(summary.top.result.overall, 1)}%` : '—'} icon={Trophy} tone="marigold" hint={summary.top?.student.name} />
        <Stat label="Passed all subjects" value={`${summary.passed} / ${summary.graded}`} icon={Users} tone={summary.passed === summary.graded ? 'teal' : 'rose'} hint="GPA above 0.00" />
        <Stat label="Average attendance" value={`${fmt(summary.att)}%`} icon={CalendarCheck} tone="teal" hint={term === 'mid' ? `Up to ${new Date(TODAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : 'Whole term'} />
      </div>

      <Card className="mb-5" title="How the average is calculated"
        action={<Button size="sm" variant="ghost" onClick={() => setWeights(DEFAULT_WEIGHTS)}>Reset to default</Button>}>
        <p className="mb-4 text-sm text-ink-soft">Attendance counts toward every subject's average. If a part has no marks yet (like the final before December), the other parts are re-scaled to fill its share.</p>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {WEIGHT_FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="mb-1 flex items-center justify-between text-[13px] font-semibold text-ink-soft">{f.label}
                <span className="flex items-center gap-1">
                  <input type="number" min={0} max={100} value={weights[f.key]} aria-label={`${f.label} weight`}
                    onChange={e => setWeights({ ...weights, [f.key]: Math.max(0, Math.min(100, +e.target.value || 0)) })}
                    className={cx(inputCls, 'h-8 w-16 px-2 text-right tabular-nums')} />%
                </span>
              </span>
              <input type="range" min={0} max={100} step={5} value={weights[f.key]} aria-label={`${f.label} weight slider`}
                onChange={e => setWeights({ ...weights, [f.key]: +e.target.value })} className="w-full accent-marigold" />
            </label>
          ))}
        </div>
        <p className={cx('mt-3 text-[13px]', sum === 100 ? 'text-teal' : 'text-marigold-deep')}>
          Total {sum}%{sum !== 100 && ' — weights are used as proportions, so the results still work, but 100% is easier to explain to parents.'}
        </p>
      </Card>

      <Card pad={false} title={`${groupLabel(group)} · ${t.label}`} action={<span className="text-xs text-ink-soft">Click a student for the full breakdown</span>}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Position</th><th>Student</th>
                {subjects.map(s => <th key={s} className="num">{s}</th>)}
                <th className="num">Attendance</th><th className="num">Overall</th><th className="num">GPA</th><th>Grade</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.student.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                  <td><span className={cx('grid size-7 place-items-center rounded-full text-[13px] font-bold', r.position <= 3 ? 'bg-marigold-soft text-marigold-deep' : 'text-ink-soft')}>{r.position}</span></td>
                  <td>
                    <div className="flex items-center gap-2.5 whitespace-nowrap"><Avatar name={r.student.name} size={30} />
                      <span className="leading-tight"><span className="block font-semibold">{r.student.name}</span><span className="text-xs text-ink-soft">Roll {r.student.roll}</span></span>
                    </div>
                  </td>
                  {r.result.subjects.map(s => (
                    <td key={s.subject} className="num whitespace-nowrap"><span className="mr-1.5">{fmt(s.total)}</span><Badge tone={gradeTone(s.grade)}>{s.grade}</Badge></td>
                  ))}
                  <td className={cx('num', (r.result.attendance ?? 100) < 75 && 'font-semibold text-rose')}>{fmt(r.result.attendance)}%</td>
                  <td className="num font-semibold">{fmt(r.result.overall, 1)}%</td>
                  <td className="num font-semibold">{fmt(r.result.gpa, 2)}</td>
                  <td><Badge tone={gradeTone(r.result.grade)}>{r.result.grade}</Badge></td>
                  <td className="text-right"><Button size="sm" variant="outline" icon={FileText} onClick={e => { e.stopPropagation(); sheet(r) }}>Marksheet</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <EmptyState icon={Users} title="No students in this class yet" />}
      </Card>

      {open && <StudentModal row={open} classSize={rows.length} term={t.label} onClose={() => setOpen(null)} onDownload={() => sheet(open)} />}
    </>
  )
}

function StudentModal({ row, classSize, term, onClose, onDownload }: { row: Row; classSize: number; term: string; onClose: () => void; onDownload: () => void }) {
  const { student: s, result: res } = row
  const data = res.subjects.map(x => ({ subject: x.subject, total: x.total == null ? 0 : +x.total.toFixed(1), grade: x.grade }))
  return (
    <Modal wide title={s.name} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="accent" icon={Download} onClick={onDownload}>Download marksheet (PDF)</Button></>}>
      <Header s={s} position={row.position} classSize={classSize} term={term} gpa={res.gpa} overall={res.overall} grade={res.grade} />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tbl">
          <thead><tr><th>Subject</th><th className="num">Class tests</th><th className="num">Mid term</th><th className="num">Final</th><th className="num">Attendance</th><th className="num">Total</th><th>Grade</th></tr></thead>
          <tbody>
            {res.subjects.map(x => (
              <tr key={x.subject}>
                <td className="font-semibold">{x.subject}</td>
                <td className="num">{fmt(x.class_test)}</td><td className="num">{fmt(x.mid_term)}</td><td className="num">{fmt(x.final)}</td><td className="num">{fmt(x.attendance)}</td>
                <td className="num font-semibold">{fmt(x.total, 1)}%</td>
                <td><Badge tone={gradeTone(x.grade)}>{x.grade}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-soft">All parts shown as %. A dash means no marks yet, so that part isn't counted.</p>
      <div className="mt-5 h-56">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E4E7EE" />
            <XAxis dataKey="subject" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5B6680' }} />
            <YAxis domain={[0, 100]} ticks={[0, 33, 50, 80, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5B6680' }} />
            <ReferenceLine y={33} stroke="#E0475B" strokeDasharray="4 4" label={{ value: 'Pass', position: 'insideTopRight', fontSize: 11, fill: '#E0475B' }} />
            <Tooltip cursor={{ fill: '#F6F7F9' }} formatter={v => [`${v}%`, 'Total']} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={44}>
              {data.map(d => <Cell key={d.subject} fill={GRADE_COLOR[gradeTone(d.grade)]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Modal>
  )
}

function Header({ s, position, classSize, term, gpa, overall, grade }: { s: Student; position: number; classSize: number; term: string; gpa: number | null; overall: number | null; grade: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <Avatar name={s.name} size={44} />
      <div className="flex-1 leading-tight">
        <div className="text-sm text-ink-soft">{groupLabel(s)} · Roll {s.roll} · {term}</div>
        <div className="mt-1 text-sm">Position <b>{position}</b> of {classSize}</div>
      </div>
      <div className="flex gap-5 text-center">
        <div><div className="font-display text-2xl font-bold">{fmt(overall, 1)}%</div><div className="text-xs text-ink-soft">Overall</div></div>
        <div><div className="font-display text-2xl font-bold">{fmt(gpa, 2)}</div><div className="text-xs text-ink-soft">GPA</div></div>
        <div className="grid place-items-center"><Badge tone={gradeTone(grade)}>{grade}</Badge><div className="text-xs text-ink-soft">Grade</div></div>
      </div>
    </div>
  )
}
