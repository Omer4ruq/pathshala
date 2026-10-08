import { useMemo, useState, type ReactElement, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarCheck, ClipboardList, Download, FileSpreadsheet, Percent, Sparkles, Star } from 'lucide-react'
import { useMyGroups, useStore } from '../lib/store'
import { addDays, groupKey, groupLabel, iso, monthLabel, TODAY, type DB, type Exam, type Student } from '../lib/data'
import { attendanceStats, riskFlags, studentResult, type Weights } from '../lib/grading'
import { downloadReportPdf, downloadXlsx, SCHOOL } from '../lib/export'
import { Avatar, Badge, Button, Card, EmptyState, GroupPicker, PageHeader, Stat, Tabs, cx, inputCls } from '../components/ui'

type Mode = 'week' | 'month'
interface Period { from: string; to: string; label: string }

const day = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' })
const weekStart = (d: string) => addDays(d, -new Date(d + 'T00:00:00Z').getUTCDay())
const weekOf = (from: string): Period => ({ from, to: addDays(from, 4), label: `${day(from)} – ${day(addDays(from, 4))}` })
const WEEKS = Array.from({ length: 8 }, (_, i) => weekOf(addDays(weekStart(TODAY), -7 * i)))
const MONTHS = ['2026-10', '2026-09', '2026-08']
const monthOf = (m: string): Period => ({ from: `${m}-01`, to: `${m}-31`, label: monthLabel(m) })
const prevMonth = (m: string) => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return iso(d).slice(0, 7) }

const inP = (d: string, p: Period) => d >= p.from && d <= p.to
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const fmt = (n: number | null | undefined, d = 0) => (n == null ? '—' : n.toFixed(d))
const diff = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b)
const signed = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`)
const C = { ink: '#14213D', soft: '#5B6680', line: '#E4E7EE', prev: '#CBD2E0', teal: '#1F9D8B', sky: '#3B7DD8', rose: '#E0475B' }

interface SRow { s: Student; att: number | null; prevAtt: number | null; absent: number; avg: number | null; prev: number | null; flags: string[] }

/** Everything a report needs for one period, built only from attendance + marks already in the DB. */
function analyse(db: DB, students: Student[], cur: Period, prev: Period, w: Weights) {
  const keys = new Set(students.map(groupKey))
  const exams = new Map<string, Exam[]>()
  for (const e of db.exams) {
    if (!keys.has(groupKey(e)) || !db.marks[e.id] || !(inP(e.date, cur) || inP(e.date, prev))) continue
    const k = groupKey(e)
    exams.set(k, [...(exams.get(k) ?? []), e])
  }
  const testAvg = (s: Student, p: Period) => mean((exams.get(groupKey(s)) ?? []).filter(e => inP(e.date, p)).flatMap(e => {
    const v = db.marks[e.id][s.id]
    return v == null ? [] : [(v / e.totalMarks) * 100]
  }))

  let attRecords = 0
  const rows: SRow[] = students.map(s => {
    const a = attendanceStats(db, s.id, cur)
    attRecords += a.total
    return { s, att: a.pct, absent: a.absent, prevAtt: attendanceStats(db, s.id, prev).pct, avg: testAvg(s, cur), prev: testAvg(s, prev), flags: riskFlags(studentResult(db, s, cur, w), a) }
  })

  const all = [...exams.values()].flat()
  const held = all.filter(e => inP(e.date, cur))
  const markCount = held.reduce((n, e) => n + Object.keys(db.marks[e.id]).length, 0)
  const bySubject = (p: Period) => {
    const m = new Map<string, number[]>()
    for (const e of all) if (inP(e.date, p)) for (const v of Object.values(db.marks[e.id])) m.set(e.subject, [...(m.get(e.subject) ?? []), (v / e.totalMarks) * 100])
    return m
  }
  const sc = bySubject(cur), sp = bySubject(prev)
  const subjects = [...new Set([...sc.keys(), ...sp.keys()])].map(subject => ({ subject, cur: mean(sc.get(subject) ?? []), prev: mean(sp.get(subject) ?? []) }))

  // attendance per school day across the selected students
  const ids = students.map(s => s.id)
  const days = Object.keys(db.attendance).filter(d => inP(d, cur)).sort().map(date => {
    const marks = ids.map(id => db.attendance[date][id]).filter(Boolean)
    return { date, pct: mean(marks.map(m => (m === 'P' ? 100 : m === 'L' ? 50 : 0))) }
  })

  return { rows, testsHeld: held.length, subjects, days, attRecords, markCount }
}

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="text-ink-soft">—</span>
  const up = v >= 0.5, down = v <= -0.5
  return <span className={cx('font-semibold tabular-nums whitespace-nowrap', up ? 'text-teal' : down ? 'text-rose' : 'text-ink-soft')}>{up ? '↑' : down ? '↓' : '→'} {Math.abs(v).toFixed(1)}</span>
}

const attTone = (p: number | null) => (p == null ? C.prev : p >= 90 ? C.teal : p >= 75 ? C.sky : C.rose)

export default function Reports() {
  const { db, user, weights, toast } = useStore()
  const groups = useMyGroups()
  const isAdmin = user?.role === 'super_admin'
  const [mode, setMode] = useState<Mode>('week')
  const [key, setKey] = useState(() => { const g = isAdmin ? null : groups.find(g => g.isClassTeacher) ?? groups[0]; return g ? groupKey(g) : '' })
  const [week, setWeek] = useState(WEEKS[1].from) // last full week
  const [month, setMonth] = useState('2026-09')
  const group = groups.find(g => groupKey(g) === key) ?? null
  const school = !group && isAdmin

  const cur = mode === 'week' ? weekOf(week) : monthOf(month)
  const prev = mode === 'week' ? weekOf(addDays(week, -7)) : monthOf(prevMonth(month))
  const periodWord = mode === 'week' ? 'week' : 'month'
  const scopeLabel = group ? groupLabel(group) : 'Whole school'

  const r = useMemo(() => {
    const students = db.students.filter(s => s.status === 'active' && (group ? groupKey(s) === key : school)).sort((a, b) => a.roll - b.roll)
    return analyse(db, students, cur, prev, weights)
    // cur/prev are derived from the primitives below
  }, [db, key, school, mode, week, month, weights])

  const summary = useMemo(() => {
    const att = mean(r.rows.flatMap(x => (x.att == null ? [] : [x.att])))
    const prevAtt = mean(r.rows.flatMap(x => (x.prevAtt == null ? [] : [x.prevAtt])))
    const avg = mean(r.rows.flatMap(x => (x.avg == null ? [] : [x.avg])))
    const prevAvg = mean(r.rows.flatMap(x => (x.prev == null ? [] : [x.prev])))
    const flagged = r.rows.filter(x => x.flags.length).sort((a, b) => b.flags.length - a.flags.length || (a.att ?? 0) - (b.att ?? 0))
    const top = r.rows.filter(x => x.avg != null).sort((a, b) => b.avg! - a.avg!).slice(0, school ? 5 : 3)
    // whole-school: one row per class group
    const byGroup = new Map<string, SRow[]>()
    for (const x of r.rows) byGroup.set(groupKey(x.s), [...(byGroup.get(groupKey(x.s)) ?? []), x])
    const classes = [...byGroup.values()].map(rs => {
      const m = (f: (x: SRow) => number | null) => mean(rs.flatMap(x => { const v = f(x); return v == null ? [] : [v] }))
      return { key: groupKey(rs[0].s), label: groupLabel(rs[0].s), n: rs.length, att: m(x => x.att), absent: rs.reduce((a, x) => a + x.absent, 0), avg: m(x => x.avg), prev: m(x => x.prev), flagged: rs.filter(x => x.flags.length).length }
    })
    // attendance chart: by day for a week, by school week for a month
    const buckets = mode === 'week'
      ? r.days.map(d => ({ label: day(d.date, { weekday: 'short', day: 'numeric' }), pct: d.pct }))
      : [...new Set(r.days.map(d => weekStart(d.date)))].map(w => r.days.filter(d => weekStart(d.date) === w)).map(ds => ({ label: `${day(ds[0].date)} – ${day(ds[ds.length - 1].date, { day: 'numeric' })}`, pct: mean(ds.flatMap(d => (d.pct == null ? [] : [d.pct]))) }))
    return { att, prevAtt, avg, prevAvg, flagged, top, classes, buckets }
  }, [r, school, mode])

  if (!groups.length) return <><PageHeader title="Weekly & monthly reports" /><Card><EmptyState icon={ClipboardList} title="No classes assigned yet">Reports appear here once you're assigned to a class.</EmptyState></Card></>

  const title = `${mode === 'week' ? 'Weekly' : 'Monthly'} report`
  const subtitle = `${scopeLabel} · ${cur.label}${mode === 'week' ? ' 2026' : ''}`
  const fileBase = `${title}_${scopeLabel}_${cur.from}`.replace(/[\s·]+/g, '_')
  const summaryPairs: [string, string][] = [
    ['Attendance', `${fmt(summary.att)}%`], ['Tests held', String(r.testsHeld)], [school ? 'School average' : 'Class average', `${fmt(summary.avg, 1)}%`], ['Need attention', String(summary.flagged.length)],
  ]
  const studentHead = ['Roll', 'Student', 'Attendance %', 'Days absent', 'Test avg %', `Change vs last ${periodWord}`, 'Flags']
  const studentBody = r.rows.map(x => [x.s.roll, x.s.name, fmt(x.att), x.absent, fmt(x.avg, 1), signed(diff(x.avg, x.prev)), x.flags.join(', ') || '—'])
  const classHead = ['Class', 'Students', 'Attendance %', 'Days absent', 'Test avg %', `Change vs last ${periodWord}`, 'Need attention']
  const classBody = summary.classes.map(c => [c.label, c.n, fmt(c.att), c.absent, fmt(c.avg, 1), signed(diff(c.avg, c.prev)), c.flagged])
  const who = (x: SRow) => (school ? `${x.s.name} (${groupLabel(x.s)})` : x.s.name)

  const pdf = () => {
    downloadReportPdf({
      filename: `${fileBase}.pdf`, title, subtitle, summary: summaryPairs, landscape: true,
      tables: [
        school ? { title: 'Classes', head: classHead, body: classBody } : { title: 'Students', head: studentHead, body: studentBody },
        { title: 'Subject averages', head: ['Subject', `This ${periodWord} %`, `Last ${periodWord} %`], body: r.subjects.map(s => [s.subject, fmt(s.cur, 1), fmt(s.prev, 1)]) },
        { title: 'Top performers', head: ['Student', 'Test avg %', 'Change'], body: summary.top.map(x => [who(x), fmt(x.avg, 1), signed(diff(x.avg, x.prev))]) },
        { title: 'Needs attention', head: ['Student', 'Reasons'], body: summary.flagged.map(x => [who(x), x.flags.join(', ')]) },
      ],
    })
    toast(`${title} downloaded`)
  }
  const excel = () => {
    const rows = (head: string[], body: (string | number)[][]) => body.map(b => Object.fromEntries(head.map((h, i) => [h, b[i]])))
    downloadXlsx(`${fileBase}.xlsx`, {
      Summary: [{ Report: title, Scope: scopeLabel, Period: cur.label }, ...summaryPairs.map(([k, v]) => ({ Report: k, Scope: v }))],
      [school ? 'Classes' : 'Students']: school ? rows(classHead, classBody) : rows(studentHead, studentBody),
      Subjects: r.subjects.map(s => ({ Subject: s.subject, [`This ${periodWord} %`]: s.cur == null ? '' : +s.cur.toFixed(1), [`Last ${periodWord} %`]: s.prev == null ? '' : +s.prev.toFixed(1) })),
      'Needs attention': summary.flagged.map(x => ({ Student: who(x), Reasons: x.flags.join(', ') })),
    })
    toast(`${title} exported to Excel`)
  }

  const shownFlagged = school ? summary.flagged.slice(0, 8) : summary.flagged
  const tick = { fontSize: 12, fill: C.soft }

  return (
    <>
      <PageHeader
        title="Weekly & monthly reports"
        subtitle={<span className="inline-flex items-center gap-1.5"><Sparkles size={15} className="text-marigold" /> Built from attendance and marks already entered — nothing to type.</span>}
        actions={<>
          <Button variant="outline" icon={FileSpreadsheet} onClick={excel}>Export Excel</Button>
          <Button variant="accent" icon={Download} onClick={pdf}>Download PDF</Button>
        </>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={mode} onChange={setMode} items={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} />
        <GroupPicker allowed={groups} allowAll={isAdmin} value={group} onChange={g => setKey(g ? groupKey(g) : '')} />
        {mode === 'week'
          ? <select aria-label="Week" className={cx(inputCls, 'w-auto')} value={week} onChange={e => setWeek(e.target.value)}>
              {WEEKS.map((w, i) => <option key={w.from} value={w.from}>{w.label}{i === 0 ? ' (this week)' : ''}</option>)}
            </select>
          : <select aria-label="Month" className={cx(inputCls, 'w-auto')} value={month} onChange={e => setMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m)}{m === TODAY.slice(0, 7) ? ' (to date)' : ''}</option>)}
            </select>}
      </div>

      <Card pad={false} className="overflow-hidden">
        <div className="bg-ink px-6 py-5 text-white">
          <div className="text-[13px] text-white/60">{SCHOOL.name}</div>
          <h2 className="mt-0.5 text-[22px] font-bold">{title} · {scopeLabel}</h2>
          <div className="mt-1 text-sm text-white/70">{cur.label}{mode === 'week' ? ' 2026' : ''} · generated just now from {r.attRecords.toLocaleString()} attendance records and {r.markCount.toLocaleString()} test marks</div>
        </div>
        <div className="h-1 bg-marigold" />

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Attendance" value={`${fmt(summary.att)}%`} icon={CalendarCheck} tone={(summary.att ?? 100) < 85 ? 'rose' : 'teal'} hint={<><Delta v={diff(summary.att, summary.prevAtt)} /> vs last {periodWord}</>} />
            <Stat label="Tests held" value={r.testsHeld} icon={ClipboardList} tone="sky" hint={`${r.subjects.filter(s => s.cur != null).length} subjects`} />
            <Stat label={school ? 'School average' : 'Class average'} value={`${fmt(summary.avg, 1)}%`} icon={Percent} tone="marigold" hint={<><Delta v={diff(summary.avg, summary.prevAvg)} /> vs last {periodWord}</>} />
            <Stat label="Need attention" value={summary.flagged.length} icon={AlertTriangle} tone={summary.flagged.length ? 'rose' : 'teal'} hint={`of ${r.rows.length} students`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartBox title={mode === 'week' ? 'Attendance by day' : 'Attendance by week'}>
              {summary.buckets.length ? (
                <BarChart data={summary.buckets} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 75, 100]} tickLine={false} axisLine={false} tick={tick} />
                  <Tooltip cursor={{ fill: '#F6F7F9' }} formatter={v => [`${Number(v).toFixed(0)}%`, 'Present']} />
                  <Bar dataKey="pct" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {summary.buckets.map(b => <Cell key={b.label} fill={attTone(b.pct)} />)}
                  </Bar>
                </BarChart>
              ) : null}
            </ChartBox>
            <ChartBox title={`Test averages by subject, this ${periodWord} vs last`}>
              {r.subjects.length ? (
                <BarChart data={r.subjects.map(s => ({ subject: s.subject, cur: s.cur && +s.cur.toFixed(1), prev: s.prev && +s.prev.toFixed(1) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.line} />
                  <XAxis dataKey="subject" tickLine={false} axisLine={false} tick={tick} />
                  <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} tick={tick} />
                  <Tooltip cursor={{ fill: '#F6F7F9' }} formatter={v => `${v}%`} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="prev" name={`Last ${periodWord}`} fill={C.prev} radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="cur" name={`This ${periodWord}`} fill={C.ink} radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              ) : null}
            </ChartBox>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="tbl">
              <thead>
                {school
                  ? <tr><th>Class</th><th className="num">Students</th><th className="num">Attendance</th><th className="num">Days absent</th><th className="num">Test average</th><th className="num">vs last {periodWord}</th><th>Need attention</th></tr>
                  : <tr><th>Roll</th><th>Student</th><th className="num">Attendance</th><th className="num">Days absent</th><th className="num">Test average</th><th className="num">vs last {periodWord}</th><th>Flags</th></tr>}
              </thead>
              <tbody>
                {school
                  ? summary.classes.map(c => (
                    <tr key={c.label} className="cursor-pointer" onClick={() => setKey(c.key)} title="Open this class's report">
                      <td className="font-semibold whitespace-nowrap">{c.label}</td>
                      <td className="num">{c.n}</td>
                      <td className={cx('num', (c.att ?? 100) < 75 && 'font-semibold text-rose')}>{fmt(c.att)}%</td>
                      <td className="num">{c.absent}</td>
                      <td className="num font-semibold">{fmt(c.avg, 1)}%</td>
                      <td className="num"><Delta v={diff(c.avg, c.prev)} /></td>
                      <td>{c.flagged ? <Badge tone="rose">{c.flagged} student{c.flagged > 1 ? 's' : ''}</Badge> : <Badge tone="teal">All on track</Badge>}</td>
                    </tr>))
                  : r.rows.map(x => (
                    <tr key={x.s.id}>
                      <td className="text-ink-soft">{x.s.roll}</td>
                      <td><div className="flex items-center gap-2.5 whitespace-nowrap font-semibold"><Avatar name={x.s.name} size={28} />{x.s.name}</div></td>
                      <td className={cx('num', (x.att ?? 100) < 75 && 'font-semibold text-rose')}>{fmt(x.att)}%</td>
                      <td className="num">{x.absent}</td>
                      <td className="num font-semibold">{fmt(x.avg, 1)}{x.avg != null && '%'}</td>
                      <td className="num"><Delta v={diff(x.avg, x.prev)} /></td>
                      <td><div className="flex flex-wrap gap-1">{x.flags.length ? x.flags.map(f => <Badge key={f} tone="rose">{f}</Badge>) : <span className="text-ink-soft">—</span>}</div></td>
                    </tr>))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ListBox title="Top performers" icon={<Star size={16} className="text-marigold" />}>
              {summary.top.length ? summary.top.map(x => (
                <li key={x.s.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={x.s.name} size={32} />
                  <span className="flex-1 leading-tight"><span className="block font-semibold">{x.s.name}</span><span className="text-xs text-ink-soft">{school ? groupLabel(x.s) : `Roll ${x.s.roll}`} · attendance {fmt(x.att)}%</span></span>
                  <span className="text-right leading-tight"><span className="block font-semibold tabular-nums">{fmt(x.avg, 1)}%</span><span className="text-xs"><Delta v={diff(x.avg, x.prev)} /></span></span>
                </li>)) : <li className="py-3 text-sm text-ink-soft">No tests marked in this {periodWord}.</li>}
            </ListBox>
            <ListBox title="Needs attention" icon={<AlertTriangle size={16} className="text-rose" />}>
              {shownFlagged.length ? shownFlagged.map(x => (
                <li key={x.s.id} className="flex items-start gap-3 py-2.5">
                  <Avatar name={x.s.name} size={32} />
                  <span className="flex-1 leading-tight"><span className="block font-semibold">{x.s.name}</span>{school && <span className="text-xs text-ink-soft">{groupLabel(x.s)}</span>}
                    <span className="mt-1 flex flex-wrap gap-1">{x.flags.map(f => <Badge key={f} tone="rose">{f}</Badge>)}</span>
                  </span>
                </li>)) : <li className="py-3 text-sm text-teal">Everyone is on track this {periodWord}.</li>}
              {summary.flagged.length > shownFlagged.length && <li className="py-2.5 text-sm text-ink-soft">and {summary.flagged.length - shownFlagged.length} more — pick a class above to see everyone.</li>}
            </ListBox>
          </div>
        </div>
      </Card>
    </>
  )
}

function ChartBox({ title, children }: { title: string; children: ReactElement | null }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="h-56">{children ? <ResponsiveContainer>{children}</ResponsiveContainer> : <p className="grid h-full place-items-center text-sm text-ink-soft">No data in this period yet.</p>}</div>
    </div>
  )
}

function ListBox({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3>
      <ul className="mt-1 divide-y divide-line">{children}</ul>
    </div>
  )
}
