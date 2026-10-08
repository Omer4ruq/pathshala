import { useState } from 'react'
import { Check, Database, RotateCcw, School } from 'lucide-react'
import { Badge, Button, Card, Modal, PageHeader, cx, gradeTone } from '../components/ui'
import { useStore } from '../lib/store'
import { DEFAULT_WEIGHTS, GRADE_SCALE, type Weights } from '../lib/grading'
import { SCHOOL } from '../lib/export'
import { NAV } from '../nav'
import type { Role } from '../lib/data'

const ROLES: [Role, string][] = [['super_admin', 'Super admin'], ['teacher', 'Teacher'], ['accountant', 'Accountant'], ['student', 'Student']]
const WEIGHT_LABEL: Record<keyof Weights, string> = { class_test: 'Class tests', mid_term: 'Mid term', final: 'Final term', attendance: 'Attendance' }

export default function Settings() {
  const { weights, setWeights, resetDemo, toast } = useStore()
  const [draft, setDraft] = useState<Weights>(weights)
  const [confirm, setConfirm] = useState(false)
  const sum = Object.values(draft).reduce((a, b) => a + b, 0)
  const dirty = (Object.keys(draft) as (keyof Weights)[]).some(k => draft[k] !== weights[k])

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="School profile, how results are calculated, and who can do what." />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <section className="rounded-3xl bg-ink p-6 text-white">
          <span className="grid size-11 place-items-center rounded-xl bg-marigold text-ink"><School size={22} /></span>
          <h2 className="mt-4 text-2xl font-bold">{SCHOOL.name}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            {[['Address', SCHOOL.address], ['Phone', SCHOOL.phone], ['Classes', 'Play to Class 10 · Sections A, B'], ['Shifts', 'Morning, Day'], ['Weekend', 'Friday, Saturday'], ['Grading', 'GPA 5 (Bangladesh)']].map(([k, v]) => (
              <div key={k} className="flex gap-3"><dt className="w-20 shrink-0 text-white/55">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </section>

        <Card title="Result weights" action={<Badge tone={sum === 100 ? 'teal' : 'marigold'}>Total {sum}%</Badge>}>
          <p className="mb-4 text-sm text-ink-soft">How much each part counts towards a subject's total. If a part has not happened yet (e.g. the final), it is left out and the others are scaled up, so mid-year results are still fair.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(WEIGHT_LABEL) as (keyof Weights)[]).map(k => (
              <label key={k} className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{WEIGHT_LABEL[k]}</span>
                <div className="relative">
                  <input type="number" min={0} max={100} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    className="h-10 w-full rounded-[10px] border border-line px-3 pr-8 text-sm tabular-nums focus:border-ink focus:outline-none" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft">%</span>
                </div>
              </label>
            ))}
          </div>
          {sum !== 100 && <p className="mt-3 text-[13px] text-marigold-deep">Weights do not add up to 100%. That still works (they are scaled), but 100% is easier to explain to parents.</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={!dirty || sum === 0} onClick={() => { setWeights(draft); toast('Result weights saved. All results now use them.') }}>Save weights</Button>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setDraft(DEFAULT_WEIGHTS)}>Use defaults</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Card title="Grading scale" pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Marks</th><th>Grade</th><th className="num">Grade point</th></tr></thead>
              <tbody>
                {GRADE_SCALE.map((g, i) => (
                  <tr key={g.grade}>
                    <td className="tabular-nums">{g.min}–{i ? GRADE_SCALE[i - 1].min - 1 : 100}</td>
                    <td><Badge tone={gradeTone(g.grade)}>{g.grade}</Badge></td>
                    <td className="num">{g.gp.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs text-ink-soft">A fail (F) in any subject makes the GPA 0.00, as per the board rule.</p>
        </Card>

        <Card title="Roles & permissions" pad={false}>
          <p className="px-5 pb-3 text-sm text-ink-soft">Each person signs in with one role and only sees the features ticked for it.</p>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Feature</th>{ROLES.map(([r, l]) => <th key={r} className="text-center!">{l}</th>)}</tr></thead>
              <tbody>
                {NAV.map(n => (
                  <tr key={n.to}>
                    <td><span className="flex items-center gap-2.5 whitespace-nowrap"><n.icon size={16} className="text-ink-soft" />{n.label}</span></td>
                    {ROLES.map(([r]) => (
                      <td key={r} className="text-center">
                        {n.roles.includes(r)
                          ? <Check size={17} strokeWidth={2.6} className="mx-auto text-teal" aria-label="Allowed" />
                          : <span className="text-line" aria-label="Not allowed">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Demo data">
          <p className="text-sm text-ink-soft">Put every student, mark, fee and notice back to the original sample data. Anything you changed while trying the app will be lost.</p>
          <Button variant="outline" icon={RotateCcw} className="mt-4" onClick={() => setConfirm(true)}>Reset demo data</Button>
        </Card>
        <Card title="Backend">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-soft text-sky"><Database size={19} /></span>
            <p className="text-sm text-ink-soft">For this demo, data is stored in this browser only. In production it moves to <b className="text-ink">Supabase</b> (database, sign-in and file storage), so every teacher and parent sees the same live data. The plan is in <code className={cx('rounded bg-paper px-1.5 py-0.5 text-[13px] text-ink')}>SUPABASE.md</code>.</p>
          </div>
        </Card>
      </div>

      {confirm && (
        <Modal title="Reset demo data?" onClose={() => setConfirm(false)}
          footer={<><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" onClick={() => { resetDemo(); setConfirm(false) }}>Reset data</Button></>}>
          <p className="text-sm text-ink-soft">All changes made in this browser will be replaced with the original sample school. This cannot be undone.</p>
        </Modal>
      )}
    </div>
  )
}
