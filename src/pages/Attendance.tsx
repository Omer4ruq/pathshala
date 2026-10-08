import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, CalendarCheck, CheckCheck, Download, Save } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useSearchParams } from 'react-router-dom'
import { Avatar, Button, Card, EmptyState, GroupPicker, PageHeader, Tabs, cx, inputCls, type Group } from '../components/ui'
import { useMyGroups, useStore } from '../lib/store'
import { addDays, groupKey, groupLabel, isSchoolDay, monthLabel, TODAY, type AttendanceMark, type Student } from '../lib/data'
import { attendanceStats } from '../lib/grading'
import { downloadXlsx } from '../lib/export'

const MARKS: { m: AttendanceMark; label: string; on: string; off: string }[] = [
  { m: 'P', label: 'Present', on: 'bg-teal text-white', off: 'text-teal hover:bg-teal-soft' },
  { m: 'L', label: 'Late', on: 'bg-marigold text-ink', off: 'text-marigold-deep hover:bg-marigold-soft' },
  { m: 'A', label: 'Absent', on: 'bg-rose text-white', off: 'text-rose hover:bg-rose-soft' },
]
const DOT: Record<AttendanceMark, string> = { P: 'bg-teal', L: 'bg-marigold', A: 'bg-rose' }
const MONTHS = ['2026-08', '2026-09', '2026-10']
const inGroup = (s: Student, g: Group) => s.cls === g.cls && s.section === g.section && s.shift === g.shift && s.status === 'active'

export default function Attendance() {
  const { db } = useStore()
  const groups = useMyGroups()
  const [tab, setTab] = useState<'take' | 'history'>('take')
  const [params] = useSearchParams()
  const [gk, setGk] = useState(() => { const want = params.get('group'); const g = groups.find(x => groupKey(x) === want) ?? groups.find(x => x.isClassTeacher) ?? groups[0]; return g ? groupKey(g) : '' })
  const [date, setDate] = useState(TODAY)
  const [month, setMonth] = useState(TODAY.slice(0, 7))
  const group = groups.find(g => groupKey(g) === gk) ?? groups[0]
  const students = useMemo(() => (group ? db.students.filter(s => inGroup(s, group)).sort((a, b) => a.roll - b.roll) : []), [db.students, group])

  if (!group) return <><PageHeader title="Attendance" /><Card><EmptyState icon={CalendarCheck} title="No classes assigned yet">Ask the office to assign you a class.</EmptyState></Card></>

  return (
    <div>
      <PageHeader title="Attendance" subtitle={groupLabel(group)} actions={<Tabs value={tab} onChange={setTab} items={[{ value: 'take', label: 'Take attendance' }, { value: 'history', label: 'History' }]} />} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <GroupPicker allowed={groups} value={group} onChange={g => g && setGk(groupKey(g))} />
        {tab === 'take'
          ? <input type="date" aria-label="Date" className={cx(inputCls, 'w-auto')} value={date} max={TODAY} onChange={e => e.target.value && setDate(e.target.value)} />
          : <select aria-label="Month" className={cx(inputCls, 'w-auto')} value={month} onChange={e => setMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>}
      </div>
      {students.length === 0
        ? <Card><EmptyState icon={CalendarCheck} title="No students in this class">Students added to this class will show up here.</EmptyState></Card>
        : tab === 'take'
          ? <TakeSheet key={`${gk}|${date}`} students={students} date={date} />
          : <History students={students} group={group} month={month} />}
    </div>
  )
}

function TakeSheet({ students, date }: { students: Student[]; date: string }) {
  const { db, saveAttendance, toast } = useStore()
  const existing = db.attendance[date]
  const taken = students.some(s => existing?.[s.id])
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>(() => Object.fromEntries(students.map(s => [s.id, existing?.[s.id] ?? 'P'])))
  const rows = useRef<(HTMLLIElement | null)[]>([])
  const overall = useMemo(() => Object.fromEntries(students.map(s => [s.id, attendanceStats(db, s.id).pct])), [db, students])
  const count = (m: AttendanceMark) => students.filter(s => marks[s.id] === m).length

  const set = (id: string, m: AttendanceMark) => setMarks(x => ({ ...x, [id]: m }))
  const save = () => { saveAttendance(date, marks); toast(`Attendance saved for ${students.length} students`) }
  const onKey = (e: KeyboardEvent, i: number) => {
    const k = e.key.toUpperCase()
    if (k === 'P' || k === 'L' || k === 'A') { set(students[i].id, k); rows.current[i + 1]?.focus() }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); rows.current[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus() }
    else return
    e.preventDefault()
  }

  return (
    <div onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save() } }}>
      {!isSchoolDay(date) && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-marigold-soft px-4 py-3 text-sm font-medium text-marigold-deep">
          <AlertTriangle size={17} /> {new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })} is a weekend. Check the date before saving.
        </div>
      )}
      <Card pad={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="text-sm text-ink-soft">
            {taken ? 'Already taken for this day. Changes update the record.' : 'Everyone starts as present. Change only who is late or absent.'}
            <span className="hidden sm:inline"> Keys: <kbd className="rounded border border-line px-1">P</kbd> <kbd className="rounded border border-line px-1">L</kbd> <kbd className="rounded border border-line px-1">A</kbd>, arrows to move.</span>
          </p>
          <Button size="sm" variant="outline" icon={CheckCheck} onClick={() => setMarks(Object.fromEntries(students.map(s => [s.id, 'P'])))}>Mark all present</Button>
        </div>
        <ul>
          {students.map((s, i) => {
            const pct = overall[s.id]
            return (
              <li key={s.id} ref={el => { rows.current[i] = el }} tabIndex={0} onKeyDown={e => onKey(e, i)}
                className="flex items-center gap-3 border-b border-line px-4 py-2.5 outline-none last:border-0 focus:bg-marigold-soft/50 sm:px-5">
                <span className="w-7 text-right font-display text-sm font-semibold tabular-nums text-ink-soft">{s.roll}</span>
                <Avatar name={s.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{s.name}</div>
                  {pct != null && <div className={cx('text-xs', pct < 75 ? 'font-semibold text-rose' : 'text-ink-soft')}>{pct.toFixed(0)}% overall</div>}
                </div>
                <div className="flex gap-1 rounded-xl bg-paper p-1" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                  {MARKS.map(o => (
                    <button key={o.m} type="button" tabIndex={-1} role="radio" aria-checked={marks[s.id] === o.m} title={o.label} onClick={() => set(s.id, o.m)}
                      className={cx('size-11 rounded-lg text-[15px] font-bold transition', marks[s.id] === o.m ? o.on + ' shadow-sm' : o.off)}>
                      {o.m}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
      <div className="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-ink px-5 py-3 text-white shadow-xl shadow-ink/20">
        <span className="flex items-center gap-1.5 text-sm"><span className="size-2.5 rounded-full bg-teal" /> {count('P')} present</span>
        <span className="flex items-center gap-1.5 text-sm"><span className="size-2.5 rounded-full bg-marigold" /> {count('L')} late</span>
        <span className="flex items-center gap-1.5 text-sm"><span className="size-2.5 rounded-full bg-rose" /> {count('A')} absent</span>
        <Button variant="accent" icon={Save} className="ml-auto" onClick={save}>Save attendance</Button>
      </div>
    </div>
  )
}

function History({ students, group, month }: { students: Student[]; group: Group; month: string }) {
  const { db } = useStore()
  const days = useMemo(() => {
    const out: string[] = []
    for (let d = month + '-01'; d.startsWith(month) && d <= TODAY; d = addDays(d, 1)) if (isSchoolDay(d)) out.push(d)
    return out
  }, [month])
  const range = { from: month + '-01', to: month + '-31' }
  const daily = days.map(d => {
    const ms = students.map(s => db.attendance[d]?.[s.id]).filter(Boolean)
    const pct = ms.length ? (ms.reduce((a, m) => a + (m === 'P' ? 1 : m === 'L' ? 0.5 : 0), 0) / ms.length) * 100 : null
    return { day: d.slice(8), pct: pct == null ? null : Math.round(pct) }
  })

  const exportGrid = () => downloadXlsx(`Attendance_${group.cls}_${group.section}_${group.shift}_${month}.xlsx`.replace(/\s+/g, ''), {
    [monthLabel(month)]: students.map(s => ({
      Roll: s.roll, Name: s.name,
      ...Object.fromEntries(days.map(d => [d.slice(8), db.attendance[d]?.[s.id] ?? ''])),
      'Month %': Math.round(attendanceStats(db, s.id, range).pct ?? 0),
    })),
  })

  if (days.length === 0) return <Card><EmptyState icon={CalendarCheck} title="No school days yet">Nothing recorded for {monthLabel(month)}.</EmptyState></Card>

  return (
    <div className="space-y-5">
      <Card title="Class attendance by day" action={<span className="text-xs text-ink-soft">Late counts as half a day</span>}>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip cursor={{ fill: '#F6F7F9' }} formatter={v => [`${v}%`, 'Class average']} labelFormatter={l => `${monthLabel(month).split(' ')[0]} ${l}`} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {daily.map(d => <Cell key={d.day} fill={d.pct != null && d.pct < 75 ? '#E0475B' : '#1F9D8B'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card pad={false} title={monthLabel(month)} action={<Button size="sm" variant="outline" icon={Download} onClick={exportGrid}>Export to Excel</Button>}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="tbl">
            <thead>
              <tr>
                <th className="left-0 z-2!">Student</th>
                {days.map(d => <th key={d} className="px-1! text-center!">{d.slice(8)}</th>)}
                <th className="num">Month</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const pct = attendanceStats(db, s.id, range).pct
                return (
                  <tr key={s.id}>
                    <td className="sticky left-0 z-1 bg-white whitespace-nowrap"><span className="mr-2 text-ink-soft tabular-nums">{s.roll}</span><span className="font-medium">{s.name}</span></td>
                    {days.map(d => {
                      const m = db.attendance[d]?.[s.id]
                      return <td key={d} className="px-1! text-center!" title={`${d}: ${m ? MARKS.find(o => o.m === m)!.label : 'Not taken'}`}>
                        <span className={cx('inline-block size-2.5 rounded-full', m ? DOT[m] : 'bg-ink/10')} />
                      </td>
                    })}
                    <td className={cx('num font-semibold', pct != null && pct < 75 && 'text-rose')}>{pct == null ? '—' : `${pct.toFixed(0)}%`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 border-t border-line px-5 py-3 text-xs text-ink-soft">
          {MARKS.map(o => <span key={o.m} className="flex items-center gap-1.5"><span className={cx('size-2.5 rounded-full', DOT[o.m])} />{o.label}</span>)}
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-ink/10" />Not taken</span>
        </div>
      </Card>
    </div>
  )
}
