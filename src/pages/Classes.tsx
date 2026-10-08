import { useMemo, useRef, useState } from 'react'
import { AlertCircle, Star, Users, X } from 'lucide-react'
import { CLASSES, SECTIONS, SHIFTS, groupKey, groupLabel, subjectsFor, type Assignment } from '../lib/data'
import { useStore } from '../lib/store'
import { Avatar, Badge, Button, Card, PageHeader, cx, inputCls, type Group } from '../components/ui'

const GROUPS = (cls: string): Group[] => SECTIONS.flatMap(section => SHIFTS.map(shift => ({ cls, section, shift })))

export default function Classes() {
  const { db, assign, unassign, toast } = useStore()
  const [sel, setSel] = useState<Group>({ cls: CLASSES[0], section: 'A', shift: 'Morning' })
  const panel = useRef<HTMLDivElement>(null)

  const byGroup = useMemo(() => {
    const m = new Map<string, Assignment[]>()
    for (const a of db.assignments) m.set(groupKey(a), [...(m.get(groupKey(a)) ?? []), a])
    return m
  }, [db.assignments])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of db.students) if (s.status === 'active') m.set(groupKey(s), (m.get(groupKey(s)) ?? 0) + 1)
    return m
  }, [db.students])
  const loadOf = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of db.assignments) m.set(a.teacherId, (m.get(a.teacherId) ?? 0) + 1)
    return m
  }, [db.assignments])
  const teacher = (id: string) => db.teachers.find(t => t.id === id)

  const pick = (g: Group) => {
    setSel(g)
    if (window.innerWidth < 1024) setTimeout(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const list = byGroup.get(groupKey(sel)) ?? []
  const subjects = subjectsFor(sel.cls)
  const ct = list.find(a => a.isClassTeacher)
  const active = db.teachers.filter(t => t.status === 'active')

  const setTeacher = (subject: string, teacherId: string) => {
    const cur = list.find(a => a.subject === subject)
    assign({ ...sel, subject, teacherId, isClassTeacher: cur?.isClassTeacher ?? false })
    toast(`${teacher(teacherId)?.name} now teaches ${subject} in ${groupLabel(sel)}`)
  }
  const setClassTeacher = (id: string) => {
    if (id) { const a = list.find(x => x.id === id)!; assign({ ...a, isClassTeacher: true }); toast(`${teacher(a.teacherId)?.name} is now class teacher`) }
    else if (ct) { assign({ ...ct, isClassTeacher: false }); toast('Class teacher removed') }
  }
  const remove = (a: Assignment) => { unassign(a.id); toast(`${a.subject} teacher removed`) }

  return (
    <div>
      <PageHeader title="Classes & sections" subtitle="Pick a section to choose its class teacher and who teaches each subject" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-3">
          {CLASSES.map(cls => (
            <Card key={cls} pad={false} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-24 shrink-0">
                  <div className="font-display text-lg font-bold">{cls}</div>
                  <div className="text-xs text-ink-soft">{subjectsFor(cls).length} subjects</div>
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                  {GROUPS(cls).map(g => {
                    const as = byGroup.get(groupKey(g)) ?? []
                    const c = as.find(a => a.isClassTeacher)
                    const missing = subjectsFor(cls).filter(s => !as.some(a => a.subject === s)).length
                    const on = groupKey(g) === groupKey(sel)
                    return (
                      <button key={groupKey(g)} onClick={() => pick(g)} aria-pressed={on}
                        className={cx('rounded-xl border px-3 py-2 text-left transition', on ? 'border-ink bg-ink text-white' : 'border-line bg-paper/60 hover:border-ink/40 hover:bg-white')}>
                        <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                          <span>{g.section} · {g.shift}</span>
                          <span className={cx('flex items-center gap-1 text-xs font-medium', on ? 'text-white/70' : 'text-ink-soft')}><Users size={12} />{counts.get(groupKey(g)) ?? 0}</span>
                        </div>
                        <div className={cx('mt-0.5 truncate text-xs', on ? 'text-marigold' : c ? 'text-ink-soft' : 'text-rose')}>
                          {c ? teacher(c.teacherId)?.name : 'No class teacher'}
                        </div>
                        {missing > 0 && <div className={cx('mt-0.5 text-xs font-medium', on ? 'text-rose-soft' : 'text-rose')}>{missing} subject{missing > 1 ? 's' : ''} unassigned</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div ref={panel} className="scroll-mt-20 lg:sticky lg:top-24">
          <Card pad={false}>
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-xl font-bold">{sel.cls} · Section {sel.section}</h2>
              <p className="text-sm text-ink-soft">{sel.shift} shift · {counts.get(groupKey(sel)) ?? 0} students</p>
            </div>

            <div className="border-b border-line bg-marigold-soft/50 px-5 py-4">
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-marigold-deep"><Star size={14} /> Class teacher</label>
              <select className={inputCls} value={ct?.id ?? ''} onChange={e => setClassTeacher(e.target.value)} disabled={!list.length}>
                <option value="">{list.length ? 'No class teacher' : 'Assign subject teachers first'}</option>
                {list.map(a => <option key={a.id} value={a.id}>{teacher(a.teacherId)?.name} ({a.subject})</option>)}
              </select>
              <p className="mt-1.5 text-xs text-ink-soft">Chosen from the teachers of this section. They take attendance and sign marksheets.</p>
            </div>

            <ul className="divide-y divide-line">
              {subjects.map(subject => {
                const a = list.find(x => x.subject === subject)
                const t = a && teacher(a.teacherId)
                const specialists = active.filter(x => x.subject === subject)
                const others = active.filter(x => x.subject !== subject)
                const opt = (x: typeof active[number]) => <option key={x.id} value={x.id}>{x.name} · {loadOf.get(x.id) ?? 0} classes</option>
                return (
                  <li key={subject} className="px-5 py-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-semibold">{subject}</span>
                      {a ? (a.isClassTeacher && <Badge tone="marigold"><Star size={12} /> Class teacher</Badge>) : <Badge tone="rose"><AlertCircle size={12} /> No teacher</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      {t && <Avatar name={t.name} size={34} />}
                      <select className={cx(inputCls, 'min-w-0 flex-1')} value={a?.teacherId ?? ''} onChange={e => setTeacher(subject, e.target.value)} aria-label={`${subject} teacher`}>
                        {!a && <option value="" disabled>Choose a teacher</option>}
                        {a && !active.some(x => x.id === a.teacherId) && <option value={a.teacherId}>{t ? `${t.name} (inactive)` : 'Removed teacher'}</option>}
                        <optgroup label={`${subject} teachers`}>{specialists.map(opt)}</optgroup>
                        <optgroup label="Other teachers">{others.map(opt)}</optgroup>
                      </select>
                      {a && <Button size="sm" variant="ghost" icon={X} onClick={() => remove(a)} aria-label={`Remove ${subject} teacher`} className="hover:text-rose">Remove</Button>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
