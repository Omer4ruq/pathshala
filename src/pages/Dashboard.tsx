import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, ArrowRight, Banknote, BookOpen, Bot, CalendarCheck, CheckCircle2, ClipboardList, FileBarChart, GraduationCap,
  HandCoins, LineChart as LineIcon, Megaphone, Trophy, UserPlus, UserSquare2, Wallet, type LucideIcon,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, Progress, Stat, Tabs, cx } from '../components/ui'
import { useMyGroups, useStore } from '../lib/store'
import { CLASSES, TODAY, addDays, groupKey, groupLabel, monthLabel, taka, type AttendanceMark, type DB, type Notice } from '../lib/data'
import { attendanceStats, riskFlags, rankGroup, studentResult } from '../lib/grading'

// ---------- local helpers ----------
const MONTH = TODAY.slice(0, 7)
const fmtDate = (d: string, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' })
const TODAY_LONG = fmtDate(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const pctStr = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)}%`)
/** Present share of a set of marks; a late counts as half, same as grading.ts. */
const dayPct = (marks: AttendanceMark[]) => (marks.length ? (marks.reduce((a, m) => a + (m === 'P' ? 1 : m === 'L' ? 0.5 : 0), 0) / marks.length) * 100 : null)
type G = { cls: string; section: string; shift: string }
const inGroup = (s: G, g: G) => s.cls === g.cls && s.section === g.section && s.shift === g.shift
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const firstName = (n: string) => n.split(' ')[0]

const INK = '#14213D', MARIGOLD = '#F4A93B', TEAL = '#1F9D8B', SKY = '#3B7DD8', ROSE = '#E0475B', SOFT = '#5B6680', LINE = '#E4E7EE'
const axis = { tick: { fontSize: 12, fill: SOFT }, axisLine: false, tickLine: false } as const
const tip = { contentStyle: { borderRadius: 12, border: `1px solid ${LINE}`, fontSize: 13 }, cursor: { fill: 'rgba(20,33,61,.04)' } }

/** The one prominent panel on every dashboard: greeting + what matters today. */
function Hero({ title, sub, children }: { title: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
      <div className="absolute inset-y-0 right-0 w-1.5 bg-marigold" />
      <p className="text-sm text-white/60">{TODAY_LONG}</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-[34px]">{title}</h1>
      <div className="mt-1.5 text-[15px] text-white/75">{sub}</div>
      {children && <div className="mt-6">{children}</div>}
    </section>
  )
}

function HeroFigure({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-white/60">{label}</div>
      <div className="font-display text-[28px] font-bold leading-tight">{value}</div>
      {hint && <div className="text-xs text-white/55">{hint}</div>}
    </div>
  )
}

function QuickLink({ to, icon: Icon, label, sub }: { to: string; icon: LucideIcon; label: string; sub?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-4 transition hover:border-ink/30 hover:shadow-md hover:shadow-ink/5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marigold-soft text-marigold-deep"><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {sub && <span className="block truncate text-xs text-ink-soft">{sub}</span>}
      </span>
      <ArrowRight size={16} className="text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  )
}

function NoticeList({ notices }: { notices: Notice[] }) {
  if (!notices.length) return <p className="text-sm text-ink-soft">No notices yet.</p>
  return (
    <ul className="divide-y divide-line">
      {notices.map(n => (
        <li key={n.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2 text-xs text-ink-soft">{fmtDate(n.date)}<Badge tone="sky">{n.audience}</Badge></div>
          <div className="mt-1 text-sm font-semibold">{n.title}</div>
          <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-soft">{n.body}</p>
        </li>
      ))}
    </ul>
  )
}

const latestNotices = (db: DB, aud: Notice['audience'][]) => [...db.notices].filter(n => aud.includes(n.audience)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)

export default function Dashboard() {
  const { user } = useStore()
  if (user?.role === 'teacher') return <TeacherDash />
  if (user?.role === 'accountant') return <AccountantDash />
  if (user?.role === 'student') return <StudentDash />
  return <AdminDash />
}

// ---------- super admin ----------
function AdminDash() {
  const { db, user } = useStore()
  const nav = useNavigate()
  const d = useMemo(() => {
    const active = db.students.filter(s => s.status === 'active')
    const dates = Object.keys(db.attendance).sort()
    const latest = dates[dates.length - 1]
    const latestPct = latest ? dayPct(Object.values(db.attendance[latest])) : null
    const trend = dates.slice(-20).map(date => ({ date: fmtDate(date), pct: Math.round(dayPct(Object.values(db.attendance[date])) ?? 0) }))
    const perClass = CLASSES.map(c => ({ cls: c.replace('Class ', 'C'), full: c, students: active.filter(s => s.cls === c).length }))

    // this month: per class and per student
    const monthDates = dates.filter(x => x.startsWith(MONTH))
    const byStudent = new Map<string, AttendanceMark[]>()
    for (const date of monthDates) for (const [sid, m] of Object.entries(db.attendance[date])) byStudent.set(sid, [...(byStudent.get(sid) ?? []), m])
    const classAtt = CLASSES.map(c => ({ cls: c, pct: dayPct(active.filter(s => s.cls === c).flatMap(s => byStudent.get(s.id) ?? [])) }))
      .filter(x => x.pct != null).sort((a, b) => a.pct! - b.pct!).slice(0, 4)
    const under75 = active.filter(s => { const p = dayPct(byStudent.get(s.id) ?? []); return p != null && p < 75 }).length

    const monthFees = db.fees.filter(f => f.month === MONTH)
    const billed = monthFees.reduce((a, f) => a + f.amount, 0)
    const collected = monthFees.reduce((a, f) => a + f.paidAmount, 0)
    return { active, latest, latestPct, trend, perClass, classAtt, under75, billed, collected, schoolDays: monthDates.length }
  }, [db.students, db.attendance, db.fees])

  const feePct = d.billed ? (d.collected / d.billed) * 100 : 0
  const actions: [string, LucideIcon, string][] = [
    ['Add student', UserPlus, '/students'], ['Take attendance', CalendarCheck, '/attendance'],
    ['Generate monthly report', FileBarChart, '/reports'], ['Collect fee', HandCoins, '/fees'],
  ]

  return (
    <div className="space-y-6">
      <Hero title={`${greeting()}, ${firstName(user!.name)}`} sub="Here is how the school is doing today.">
        <div className="flex flex-wrap gap-2">
          {actions.map(([label, Icon, to], i) => (
            <Button key={to} icon={Icon} variant={i === 0 ? 'accent' : 'outline'} onClick={() => nav(to)}
              className={i ? 'border-white/15 bg-white/10 text-white hover:bg-white/20' : ''}>{label}</Button>
          ))}
        </div>
      </Hero>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Students" value={d.active.length} icon={GraduationCap} hint="Play to Class 10" />
        <Stat label="Teachers" value={db.teachers.filter(t => t.status === 'active').length} icon={UserSquare2} tone="sky" hint={`${db.assignments.length} subject assignments`} />
        <Stat label="Attendance" value={pctStr(d.latestPct)} icon={CalendarCheck} tone={d.latestPct != null && d.latestPct < 85 ? 'rose' : 'teal'} hint={d.latest ? `Last school day, ${fmtDate(d.latest)}` : 'Not taken yet'} />
        <Stat label="Fees this month" value={taka(d.collected)} icon={HandCoins} tone="marigold" hint={`of ${taka(d.billed)} billed`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Attendance, last 20 school days" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={d.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs><linearGradient id="att" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL} stopOpacity={0.25} /><stop offset="100%" stopColor={TEAL} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis dataKey="date" {...axis} interval="preserveStartEnd" minTickGap={20} />
                <YAxis {...axis} domain={[60, 100]} unit="%" />
                <Tooltip {...tip} formatter={v => [`${v}%`, 'Present']} />
                <Area type="monotone" dataKey="pct" stroke={TEAL} strokeWidth={2.5} fill="url(#att)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Needs attention" action={<Link to="/reports" className="text-sm font-semibold text-sky hover:underline">Reports</Link>}>
          <div className="flex items-center gap-3 rounded-xl bg-rose-soft p-3">
            <AlertTriangle size={20} className="shrink-0 text-rose" />
            <p className="text-sm"><b>{d.under75} students</b> are below 75% attendance this month.</p>
          </div>
          <p className="mt-4 mb-2 text-[13px] font-semibold text-ink-soft">Lowest attendance this month</p>
          <ul className="space-y-3">
            {d.classAtt.map(c => (
              <li key={c.cls}>
                <div className="mb-1 flex justify-between text-sm"><span>{c.cls}</span><span className="font-semibold tabular-nums">{pctStr(c.pct)}</span></div>
                <Progress value={c.pct!} tone={c.pct! < 85 ? 'rose' : 'marigold'} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">{d.schoolDays} school days so far in {monthLabel(MONTH)}.</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Students per class" className="lg:col-span-2">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={d.perClass} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis dataKey="cls" {...axis} interval={0} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip {...tip} labelFormatter={(_, p) => p?.[0]?.payload.full} formatter={v => [v, 'Students']} />
                <Bar dataKey="students" fill={INK} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={`Fee collection, ${monthLabel(MONTH)}`}>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[26px] font-bold">{Math.round(feePct)}%</span>
              <span className="text-sm text-ink-soft">{taka(d.billed - d.collected)} still due</span>
            </div>
            <div className="mt-2"><Progress value={feePct} tone="marigold" /></div>
            <Link to="/fees" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky hover:underline">See who has not paid <ArrowRight size={14} /></Link>
          </Card>
          <Card title="Latest notices" action={<Link to="/notices" className="text-sm font-semibold text-sky hover:underline">All</Link>}>
            <NoticeList notices={latestNotices(db, ['All', 'Teachers', 'Students', 'Staff']).slice(0, 2)} />
          </Card>
        </div>
      </div>
    </div>
  )
}

// ---------- teacher ----------
function TeacherDash() {
  const { db, user, weights } = useStore()
  const groups = useMyGroups()
  const nav = useNavigate()
  const teacher = db.teachers.find(t => t.id === user!.refId)

  const d = useMemo(() => {
    const mine = db.assignments.filter(a => a.teacherId === user!.refId)
    const today = db.attendance[TODAY] ?? {}
    const groupRows = groups.map(g => {
      const students = db.students.filter(s => s.status === 'active' && inGroup(s, g))
      return { g, students, taken: students.some(s => today[s.id]) }
    })
    const pending = db.exams
      .filter(e => e.date <= TODAY && mine.some(a => a.subject === e.subject && inGroup(e, a)))
      .map(e => {
        const total = groupRows.find(r => groupKey(r.g) === groupKey(e))?.students.length ?? 0
        return { e, done: Object.keys(db.marks[e.id] ?? {}).length, total }
      })
      .filter(x => x.done < x.total).sort((a, b) => a.e.date.localeCompare(b.e.date))

    const range = { from: addDays(TODAY, -30), to: TODAY }
    const atRisk = groupRows.flatMap(r => r.students).map(s => ({ s, flags: riskFlags(studentResult(db, s, range, weights), attendanceStats(db, s.id, range)) }))
      .filter(x => x.flags.length).sort((a, b) => b.flags.length - a.flags.length)

    const ct = groups.find(g => g.isClassTeacher)
    let classAvg: { subject: string; avg: number }[] = []
    if (ct) {
      const res = groupRows.find(r => groupKey(r.g) === groupKey(ct))!.students.map(s => studentResult(db, s, {}, weights))
      classAvg = res[0]?.subjects.map((sub, i) => {
        const vals = res.map(r => r.subjects[i].total).filter((x): x is number => x != null)
        return { subject: sub.subject, avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 }
      }) ?? []
    }
    return { groupRows, pending, atRisk, ct, classAvg }
  }, [db, user, groups, weights])

  const left = d.groupRows.filter(r => !r.taken).length
  return (
    <div className="space-y-6">
      <Hero title={`${greeting()}, ${firstName(user!.name)}`}
        sub={left ? `${left} of your ${d.groupRows.length} classes still need today's attendance.` : `Attendance is done for all ${d.groupRows.length} classes. Nice work.`}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {d.groupRows.map(({ g, students, taken }) => (
            <div key={groupKey(g)} className="flex items-center gap-3 rounded-2xl bg-white/[.07] p-3">
              <span className={cx('grid size-9 shrink-0 place-items-center rounded-xl', taken ? 'bg-teal/25 text-teal-soft' : 'bg-marigold/20 text-marigold')}>
                {taken ? <CheckCircle2 size={18} /> : <CalendarCheck size={18} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{groupLabel(g)}</div>
                <div className="text-xs text-white/55">{g.subjects.join(', ')} · {students.length} students{g.isClassTeacher && ' · Class teacher'}</div>
              </div>
              {taken
                ? <span className="text-xs font-semibold text-teal-soft">Taken</span>
                : <Button size="sm" variant="accent" onClick={() => nav(`/attendance?group=${encodeURIComponent(groupKey(g))}`)}>Take attendance</Button>}
            </div>
          ))}
        </div>
      </Hero>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Marks to enter" action={<Link to="/exams" className="text-sm font-semibold text-sky hover:underline">Tests & exams</Link>}>
          {d.pending.length === 0
            ? <div className="flex items-center gap-3 rounded-xl bg-teal-soft p-3 text-sm"><CheckCircle2 size={18} className="text-teal" />All marks are in for tests held so far.</div>
            : <ul className="divide-y divide-line">
              {d.pending.slice(0, 6).map(({ e, done, total }) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{e.name}</div>
                    <div className="text-xs text-ink-soft">{groupLabel(e)} · {fmtDate(e.date)} · {done}/{total} entered</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => nav('/exams')}>Enter marks</Button>
                </li>
              ))}
            </ul>}
          <p className="mt-3 text-xs text-ink-soft">Once marks are in, weekly and monthly reports build themselves.</p>
        </Card>

        <Card title="Students needing attention" className="lg:col-span-2" action={<Badge tone={d.atRisk.length ? 'rose' : 'teal'}>{d.atRisk.length} in the last 30 days</Badge>}>
          {d.atRisk.length === 0
            ? <p className="text-sm text-ink-soft">Everyone is on track.</p>
            : <ul className="grid gap-x-6 sm:grid-cols-2">
              {d.atRisk.slice(0, 8).map(({ s, flags }) => (
                <li key={s.id} className="border-b border-line py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{s.name}</span>
                    <span className="shrink-0 text-xs text-ink-soft">{s.cls} {s.section} · Roll {s.roll}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">{flags.map(f => <Badge key={f} tone={f.startsWith('Weak') ? 'marigold' : 'rose'}>{f}</Badge>)}</div>
                </li>
              ))}
            </ul>}
          {d.atRisk.length > 8 && <Link to="/reports" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky hover:underline">See all {d.atRisk.length} in reports <ArrowRight size={14} /></Link>}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={d.ct ? `Class average by subject, ${groupLabel(d.ct)}` : 'Class average by subject'} className="lg:col-span-2">
          {d.ct ? (
            <div className="h-60">
              <ResponsiveContainer>
                <BarChart data={d.classAvg} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={LINE} />
                  <XAxis dataKey="subject" {...axis} />
                  <YAxis {...axis} domain={[0, 100]} unit="%" />
                  <Tooltip {...tip} formatter={v => [`${v}%`, 'Class average']} />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {d.classAvg.map(x => <Cell key={x.subject} fill={x.avg < 50 ? ROSE : x.avg < 65 ? MARIGOLD : TEAL} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={Trophy} title="You are not a class teacher">Class averages show here for the class you lead.</EmptyState>}
        </Card>
        <div className="space-y-3">
          <h3 className="px-1 text-[15px] font-semibold">Ready-made reports</h3>
          <QuickLink to="/reports" icon={FileBarChart} label="Weekly & monthly reports" sub={teacher ? `For ${teacher.subject} and your classes` : undefined} />
          <QuickLink to="/results" icon={Trophy} label="Results & marksheets" sub="GPA, positions, PDF marksheets" />
          <QuickLink to="/exams" icon={ClipboardList} label="Tests & exams" sub="Create a test, enter marks" />
        </div>
      </div>
    </div>
  )
}

// ---------- accountant ----------
const METHOD_COLORS: Record<string, string> = { Cash: INK, bKash: ROSE, Nagad: MARIGOLD, Bank: SKY }

function AccountantDash() {
  const { db, user } = useStore()
  const d = useMemo(() => {
    const month = db.fees.filter(f => f.month === MONTH)
    const billed = month.reduce((a, f) => a + f.amount, 0)
    const collected = month.reduce((a, f) => a + f.paidAmount, 0)
    const byMethod = new Map<string, number>()
    for (const f of month) if (f.method && f.paidAmount) byMethod.set(f.method, (byMethod.get(f.method) ?? 0) + f.paidAmount)
    const dueBy = new Map<string, { due: number; months: number }>()
    for (const f of db.fees) if (f.amount > f.paidAmount) {
      const x = dueBy.get(f.studentId) ?? { due: 0, months: 0 }
      dueBy.set(f.studentId, { due: x.due + f.amount - f.paidAmount, months: x.months + 1 })
    }
    const students = new Map(db.students.map(s => [s.id, s]))
    const topDues = [...dueBy].map(([id, x]) => ({ s: students.get(id)!, ...x })).filter(x => x.s).sort((a, b) => b.due - a.due).slice(0, 8)
    const unpaid = db.salaries.filter(s => !s.paid)
    return {
      billed, collected, payers: month.filter(f => f.paidAmount >= f.amount).length, invoices: month.length,
      methods: [...byMethod].map(([name, value]) => ({ name, value })), topDues,
      salaryDue: unpaid.reduce((a, s) => a + s.amount, 0), salaryCount: unpaid.length,
    }
  }, [db.fees, db.students, db.salaries])

  const due = d.billed - d.collected
  return (
    <div className="space-y-6">
      <Hero title={`${greeting()}, ${firstName(user!.name)}`} sub={`${monthLabel(MONTH)} so far: ${d.payers} of ${d.invoices} students have paid.`}>
        <div className="grid grid-cols-3 gap-4 sm:max-w-xl">
          <HeroFigure label="Billed" value={taka(d.billed)} />
          <HeroFigure label="Collected" value={<span className="text-marigold">{taka(d.collected)}</span>} hint={`${d.billed ? Math.round((d.collected / d.billed) * 100) : 0}% of billed`} />
          <HeroFigure label="Still due" value={taka(due)} />
        </div>
      </Hero>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Collected by method">
          {d.methods.length ? <>
            <div className="h-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={d.methods} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} stroke="none">
                    {d.methods.map(m => <Cell key={m.name} fill={METHOD_COLORS[m.name] ?? SOFT} />)}
                  </Pie>
                  <Tooltip {...tip} formatter={v => taka(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
              {d.methods.map(m => (
                <li key={m.name} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: METHOD_COLORS[m.name] }} />
                  {m.name}<span className="ml-auto font-semibold tabular-nums">{taka(m.value)}</span>
                </li>
              ))}
            </ul>
          </> : <p className="text-sm text-ink-soft">Nothing collected yet this month.</p>}
        </Card>

        <Card title="Largest dues" className="lg:col-span-2" pad={false} action={<Link to="/fees" className="text-sm font-semibold text-sky hover:underline">Collect fees</Link>}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Student</th><th>Class</th><th className="num">Months</th><th className="num">Due</th></tr></thead>
              <tbody>
                {d.topDues.map(x => (
                  <tr key={x.s.id}>
                    <td><div className="font-semibold">{x.s.name}</div><div className="text-xs text-ink-soft">{x.s.guardian} · {x.s.phone}</div></td>
                    <td className="whitespace-nowrap">{x.s.cls} {x.s.section} · {x.s.shift}</td>
                    <td className="num">{x.months}</td>
                    <td className="num font-semibold text-rose">{taka(x.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/salaries" className="rounded-2xl border border-line bg-white p-5 transition hover:border-ink/30">
          <div className="flex items-center justify-between text-sm font-medium text-ink-soft">Salaries pending<Banknote size={18} /></div>
          <div className="mt-2 font-display text-[26px] font-bold">{taka(d.salaryDue)}</div>
          <div className="mt-1 text-[13px] text-ink-soft">{d.salaryCount} teachers to pay</div>
        </Link>
        <QuickLink to="/fees" icon={HandCoins} label="Student fees" sub="Collect, print receipts, send reminders" />
        <QuickLink to="/finance" icon={Wallet} label="Finance overview" sub="Income, expenses and balance" />
      </div>
    </div>
  )
}

// ---------- student ----------
function StudentDash() {
  const { db, user, weights } = useStore()
  const s = db.students.find(x => x.id === user!.refId)
  const [subject, setSubject] = useState('All')

  const d = useMemo(() => {
    if (!s) return null
    const peers = db.students.filter(x => x.status === 'active' && inGroup(x, s))
    const ranked = rankGroup(db, peers, {}, weights)
    const me = ranked.find(r => r.student.id === s.id)!
    const subjects = me.result.subjects.map(x => x.subject)
    const vsClass = me.result.subjects.map((x, i) => {
      const vals = ranked.map(r => r.result.subjects[i].total).filter((v): v is number => v != null)
      return { subject: x.subject, you: Math.round(x.total ?? 0), class: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 }
    })
    const groupExams = db.exams.filter(e => inGroup(e, s))
    const tests = groupExams.filter(e => e.type === 'class_test' && db.marks[e.id]?.[s.id] != null).sort((a, b) => a.date.localeCompare(b.date))
    const trend = tests.map(e => {
      const m = db.marks[e.id]
      const vals = Object.values(m)
      return { date: fmtDate(e.date), subject: e.subject, you: Math.round((m[s.id] / e.totalMarks) * 100), class: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length / e.totalMarks) * 100) }
    })
    // "All subjects": one point per test day (two tests share a day), averaged
    const byDate = new Map<string, typeof trend>()
    for (const t of trend) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t])
    const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
    const trendAll = [...byDate].map(([date, ts]) => ({ date, subject: ts.map(t => t.subject).join(' & '), you: mean(ts.map(t => t.you)), class: mean(ts.map(t => t.class)) }))
    const upcoming = groupExams.filter(e => e.date > TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.subject.localeCompare(b.subject))
    return { me, size: ranked.length, subjects, vsClass, trend, trendAll, upcoming }
  }, [db, s, weights])

  if (!s || !d) return <EmptyState icon={GraduationCap} title="Student profile not found" />
  const { result, position } = d.me
  const trend = subject === 'All' ? d.trendAll : d.trend.filter(t => t.subject === subject)
  const daysToFinal = d.upcoming[0] ? Math.round((Date.parse(d.upcoming[0].date) - Date.parse(TODAY)) / 864e5) : null

  return (
    <div className="space-y-6">
      <Hero title={`${greeting()}, ${firstName(s.name)}`} sub={`${s.cls} · Section ${s.section} · ${s.shift} shift · Roll ${s.roll}`}>
        <div className="grid grid-cols-2 gap-4 sm:max-w-2xl sm:grid-cols-4">
          <HeroFigure label="GPA so far" value={<span className="text-marigold">{result.gpa == null ? '—' : result.gpa.toFixed(2)}</span>} hint={`Grade ${result.grade}`} />
          <HeroFigure label="Attendance" value={pctStr(result.attendance)} hint={result.attendance != null && result.attendance < 75 ? 'Below 75%' : 'On track'} />
          <HeroFigure label="Class position" value={`${position}`} hint={`of ${d.size} students`} />
          <HeroFigure label="Final exams" value={daysToFinal != null ? `${daysToFinal} days` : '—'} hint={d.upcoming[0] ? `From ${fmtDate(d.upcoming[0].date)}` : undefined} />
        </div>
      </Hero>

      <Card title="Class test scores over time" action={
        <select className="h-9 rounded-[10px] border border-line bg-white px-2.5 text-sm sm:hidden" value={subject} onChange={e => setSubject(e.target.value)} aria-label="Subject">
          {['All', ...d.subjects].map(x => <option key={x}>{x}</option>)}
        </select>}>
        <div className="mb-3 hidden sm:block"><Tabs value={subject} onChange={setSubject} items={['All', ...d.subjects].map(x => ({ value: x, label: x === 'All' ? 'All subjects' : x }))} /></div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={LINE} />
              <XAxis dataKey="date" {...axis} minTickGap={16} />
              <YAxis {...axis} domain={[0, 100]} unit="%" />
              <Tooltip {...tip} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload.subject ?? ''}`} formatter={(v, n) => [`${v}%`, n === 'you' ? 'You' : 'Class average']} />
              <Legend formatter={v => (v === 'you' ? 'You' : 'Class average')} iconType="circle" wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="class" stroke={SOFT} strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="you" stroke={SKY} strokeWidth={2.5} dot={{ r: 3.5, fill: SKY }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Your subjects vs class average" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={d.vsClass} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barGap={4}>
                <CartesianGrid vertical={false} stroke={LINE} />
                <XAxis dataKey="subject" {...axis} />
                <YAxis {...axis} domain={[0, 100]} unit="%" />
                <Tooltip {...tip} formatter={(v, n) => [`${v}%`, n === 'you' ? 'You' : 'Class average']} />
                <Legend formatter={v => (v === 'you' ? 'You' : 'Class average')} iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="you" fill={INK} radius={[6, 6, 0, 0]} maxBarSize={26} />
                <Bar dataKey="class" fill={MARIGOLD} radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Upcoming exams">
          {d.upcoming.length === 0 ? <p className="text-sm text-ink-soft">No exams scheduled.</p> : (
            <ul className="space-y-2">
              {d.upcoming.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="w-14 shrink-0 rounded-lg bg-sky-soft py-1 text-center text-xs font-semibold text-sky">{fmtDate(e.date)}</span>
                  <span className="text-sm"><b>{e.subject}</b> <span className="text-ink-soft">{e.name.replace(e.subject, '').trim()}</span></span>
                  {i === 0 && <Badge tone="marigold">First</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Notices" action={<Link to="/notices" className="text-sm font-semibold text-sky hover:underline">All</Link>} className="lg:col-span-2">
          <NoticeList notices={latestNotices(db, ['All', 'Students'])} />
        </Card>
        <div className="space-y-3">
          <QuickLink to="/my/results" icon={LineIcon} label="My results" sub="Marksheet, grades, every test" />
          <QuickLink to="/library" icon={BookOpen} label="Books & PDFs" sub={`${s.cls} textbooks`} />
          <QuickLink to="/tutor" icon={Bot} label="AI tutor" sub="Ask anything, get practice" />
          <QuickLink to="/notices" icon={Megaphone} label="Notice board" />
        </div>
      </div>
    </div>
  )
}
