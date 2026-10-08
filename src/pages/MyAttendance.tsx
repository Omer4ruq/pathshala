import { useMemo, useState } from 'react'
import { CalendarCheck, CalendarX, Clock, GraduationCap, Info } from 'lucide-react'
import { Card, EmptyState, PageHeader, Stat, Tabs, cx } from '../components/ui'
import { useStore } from '../lib/store'
import { TODAY, isSchoolDay, monthLabel, type AttendanceMark } from '../lib/data'
import { attendanceStats } from '../lib/grading'

const MONTHS = ['2026-08', '2026-09', '2026-10']
const CELL: Record<AttendanceMark, string> = { P: 'bg-teal-soft text-teal', L: 'bg-marigold-soft text-marigold-deep', A: 'bg-rose-soft text-rose' }
const WORD: Record<AttendanceMark, string> = { P: 'Present', L: 'Late', A: 'Absent' }

export default function MyAttendance() {
  const { db, user, weights } = useStore()
  const s = db.students.find(x => x.id === user!.refId)
  const [month, setMonth] = useState(TODAY.slice(0, 7))

  const all = useMemo(() => (s ? attendanceStats(db, s.id) : null), [db, s])
  const monthStats = useMemo(() => (s ? attendanceStats(db, s.id, { from: `${month}-01`, to: `${month}-31` }) : null), [db, s, month])

  if (!s || !all || !monthStats) return <EmptyState icon={GraduationCap} title="Student profile not found" />

  const [y, m] = month.split('-').map(Number)
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)]

  return (
    <div className="space-y-6">
      <PageHeader title="My attendance" subtitle="Since the term started. A late counts as half a day." />

      {all.pct != null && all.pct < 75 && (
        <div className="flex gap-3 rounded-2xl border border-rose/30 bg-rose-soft p-4 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-rose" />
          <p>Your attendance is <b>{all.pct.toFixed(0)}%</b>. Attendance counts for {weights.attendance}% of every subject's result, so missing school lowers your average. Coming every day from now on will bring it back up.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Attendance" value={all.pct == null ? '—' : `${all.pct.toFixed(0)}%`} icon={CalendarCheck} tone={all.pct != null && all.pct < 75 ? 'rose' : 'teal'} hint={`${all.total} school days`} />
        <Stat label="Present" value={all.present} icon={CalendarCheck} tone="teal" />
        <Stat label="Late" value={all.late} icon={Clock} tone="marigold" />
        <Stat label="Absent" value={all.absent} icon={CalendarX} tone="rose" />
      </div>

      <Card title={monthLabel(month)} action={<Tabs value={month} onChange={setMonth} items={MONTHS.map(x => ({ value: x, label: monthLabel(x).split(' ')[0].slice(0, 3) }))} />}>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold text-ink-soft sm:gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="pb-1">{d}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />
            const mark = db.attendance[date]?.[s.id]
            const off = !isSchoolDay(date)
            return (
              <div key={date} title={mark ? WORD[mark] : off ? 'Weekend' : undefined}
                className={cx('flex aspect-square flex-col items-center justify-center rounded-xl text-sm sm:aspect-4/3',
                  mark ? CELL[mark] : off ? 'bg-paper/70 text-ink-soft/40' : 'border border-dashed border-line text-ink-soft',
                  date === TODAY && 'ring-2 ring-ink')}>
                <span className="font-semibold">{Number(date.slice(8))}</span>
                {mark && <span className="hidden text-[11px] font-medium sm:block">{WORD[mark]}</span>}
              </div>
            )
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-soft">
          {(['P', 'L', 'A'] as const).map(k => <span key={k} className="flex items-center gap-1.5"><span className={cx('size-3 rounded', CELL[k])} />{WORD[k]}</span>)}
          <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-paper" />Weekend (Fri, Sat)</span>
          <span className="ml-auto">This month: {monthStats.pct == null ? '—' : `${monthStats.pct.toFixed(0)}%`} · {monthStats.absent} absent</span>
        </div>
      </Card>
    </div>
  )
}
