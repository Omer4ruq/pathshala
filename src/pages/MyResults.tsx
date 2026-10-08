import { useMemo, useState } from 'react'
import { Download, GraduationCap } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, Legend, ResponsiveContainer, Tooltip } from 'recharts'
import { Badge, Button, Card, EmptyState, PageHeader, Tabs, gradeTone } from '../components/ui'
import { useStore } from '../lib/store'
import { EXAM_TYPE_LABEL, TODAY } from '../lib/data'
import { examsForStudent, rankGroup, type Range } from '../lib/grading'
import { downloadMarksheet } from '../lib/export'

type Term = 'mid' | 'final'
const TERMS: Record<Term, { label: string; range: Range }> = {
  mid: { label: 'Mid term (to date)', range: { to: TODAY } },
  final: { label: 'Final term', range: {} },
}
const f0 = (n: number | null) => (n == null ? '—' : n.toFixed(0))
const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export default function MyResults() {
  const { db, user, weights } = useStore()
  const s = db.students.find(x => x.id === user!.refId)
  const [term, setTerm] = useState<Term>('mid')

  const d = useMemo(() => {
    if (!s) return null
    const peers = db.students.filter(x => x.status === 'active' && x.cls === s.cls && x.section === s.section && x.shift === s.shift)
    const ranked = rankGroup(db, peers, TERMS[term].range, weights)
    const me = ranked.find(r => r.student.id === s.id)!
    const radar = me.result.subjects.map((x, i) => {
      const vals = ranked.map(r => r.result.subjects[i].total).filter((v): v is number => v != null)
      return { subject: x.subject, you: Math.round(x.total ?? 0), class: Math.round(vals.reduce((a, b) => a + b, 0) / (vals.length || 1)) }
    })
    const tests = examsForStudent(db, s).filter(e => db.marks[e.id]?.[s.id] != null).sort((a, b) => b.date.localeCompare(a.date))
    const finalsPending = examsForStudent(db, s).some(e => e.type === 'final' && db.marks[e.id]?.[s.id] == null)
    return { ...me, size: ranked.length, radar, tests, finalsPending }
  }, [db, s, term, weights])

  if (!s || !d) return <EmptyState icon={GraduationCap} title="Student profile not found" />
  const { result } = d

  return (
    <div className="space-y-6">
      <PageHeader title="My results" subtitle={`${s.cls} · Section ${s.section} · ${s.shift} shift · Roll ${s.roll}`}
        actions={<>
          <Tabs value={term} onChange={setTerm} items={[{ value: 'mid', label: 'Mid term' }, { value: 'final', label: 'Final term' }]} />
          <Button icon={Download} onClick={() => downloadMarksheet(s, result, TERMS[term].label, d.position, d.size)}>Download marksheet (PDF)</Button>
        </>} />

      {term === 'final' && d.finalsPending && (
        <p className="rounded-xl bg-sky-soft px-4 py-3 text-sm text-ink">Final exam marks appear here after the exams in December. Until then this shows your results so far.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="flex flex-col justify-between rounded-3xl bg-ink p-6 text-white">
          <div>
            <p className="text-sm text-white/60">{TERMS[term].label}</p>
            <div className="mt-2 flex items-end gap-3">
              <span className="font-display text-[64px] font-bold leading-none text-marigold">{result.gpa == null ? '—' : result.gpa.toFixed(2)}</span>
              <span className="pb-2 text-white/70">GPA out of 5</span>
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {[['Overall', `${f0(result.overall)}%`], ['Grade', result.grade], ['Position', `${d.position} of ${d.size}`]].map(([k, v]) => (
              <div key={k}><dt className="text-[13px] text-white/60">{k}</dt><dd className="font-display text-xl font-bold">{v}</dd></div>
            ))}
          </dl>
        </section>

        <Card title="Subjects at a glance">
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={d.radar} outerRadius="75%">
                <PolarGrid stroke="#E4E7EE" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#5B6680' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="class" stroke="#F4A93B" fill="#F4A93B" fillOpacity={0.15} />
                <Radar dataKey="you" stroke="#14213D" fill="#14213D" fillOpacity={0.25} strokeWidth={2} />
                <Legend formatter={v => (v === 'you' ? 'You' : 'Class average')} iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                <Tooltip formatter={(v, n) => [`${v}%`, n === 'you' ? 'You' : 'Class average']} contentStyle={{ borderRadius: 12, fontSize: 13 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Subject breakdown" pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Subject</th><th className="num">Class tests</th><th className="num">Mid term</th><th className="num">Final</th><th className="num">Attendance</th><th className="num">Total</th><th>Grade</th><th className="num">GP</th></tr></thead>
            <tbody>
              {result.subjects.map(r => (
                <tr key={r.subject}>
                  <td className="font-semibold">{r.subject}</td>
                  <td className="num">{f0(r.class_test)}</td><td className="num">{f0(r.mid_term)}</td><td className="num">{f0(r.final)}</td><td className="num">{f0(r.attendance)}</td>
                  <td className="num font-semibold">{r.total == null ? '—' : r.total.toFixed(1)}</td>
                  <td><Badge tone={gradeTone(r.grade)}>{r.grade}</Badge></td>
                  <td className="num">{r.gp.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-ink-soft">
          All figures are percentages. Total = class tests {weights.class_test}% + mid term {weights.mid_term}% + final {weights.final}% + attendance {weights.attendance}%. Parts not held yet are left out and the rest scaled up.
        </p>
      </Card>

      <Card title={`Every test (${d.tests.length})`} pad={false}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Date</th><th>Test</th><th>Type</th><th className="num">Marks</th><th className="w-48">Score</th></tr></thead>
            <tbody>
              {d.tests.map(e => {
                const m = db.marks[e.id][s.id], pct = (m / e.totalMarks) * 100
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-ink-soft">{fmt(e.date)}</td>
                    <td className="font-medium">{e.name}</td>
                    <td>{EXAM_TYPE_LABEL[e.type]}</td>
                    <td className="num">{m} / {e.totalMarks}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-ink/5"><div className={`h-2 rounded-full ${pct >= 70 ? 'bg-teal' : pct >= 40 ? 'bg-marigold' : 'bg-rose'}`} style={{ width: `${pct}%` }} /></div>
                        <span className="w-10 text-right text-sm tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
