import { useMemo, useRef, useState } from 'react'
import { ClipboardList, Download, PenLine, Plus, Trash2, Upload, UserX } from 'lucide-react'
import { Avatar, Badge, Button, Card, EmptyState, Field, GroupPicker, Modal, PageHeader, cx, gradeTone, inputCls, type Group, type Tone } from '../components/ui'
import { useMyGroups, useStore } from '../lib/store'
import { EXAM_TYPE_LABEL, groupKey, groupLabel, subjectsFor, TODAY, type Exam, type ExamType, type Student } from '../lib/data'
import { gradeOf } from '../lib/grading'
import { downloadXlsx, readSheet } from '../lib/export'

const TYPE_TONE: Record<ExamType, Tone> = { class_test: 'sky', mid_term: 'marigold', final: 'ink' }
const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const inGroup = (s: Student, g: Group) => s.cls === g.cls && s.section === g.section && s.shift === g.shift && s.status === 'active'
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export default function Exams() {
  const { db, user, deleteExam, toast } = useStore()
  const groups = useMyGroups()
  const [gk, setGk] = useState(() => { const g = groups.find(x => x.isClassTeacher) ?? groups[0]; return g ? groupKey(g) : '' })
  const [type, setType] = useState<ExamType | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const [entering, setEntering] = useState<string | null>(null)
  const group = groups.find(g => groupKey(g) === gk) ?? groups[0]
  // teachers only see/create tests for the subjects they teach in this class
  const subjects = group ? (user?.role === 'teacher' ? group.subjects : subjectsFor(group.cls)) : []
  const students = useMemo(() => (group ? db.students.filter(s => inGroup(s, group)).sort((a, b) => a.roll - b.roll) : []), [db.students, group])
  const exams = useMemo(() => (group ? db.exams.filter(e => groupKey(e) === groupKey(group) && subjects.includes(e.subject) && (type === 'all' || e.type === type)) : [])
    .sort((a, b) => b.date.localeCompare(a.date) || b.name.localeCompare(a.name)), [db.exams, group, subjects, type])
  const examFor = db.exams.find(e => e.id === entering)

  if (!group) return <><PageHeader title="Tests & exams" /><Card><EmptyState icon={ClipboardList} title="No classes assigned yet">Ask the office to assign you a class.</EmptyState></Card></>

  return (
    <div>
      <PageHeader title="Tests & exams" subtitle={`${groupLabel(group)} · ${students.length} students`} actions={<Button icon={Plus} onClick={() => setCreating(true)}>Create test</Button>} />
      <div className="mb-5 flex flex-wrap gap-2">
        <GroupPicker allowed={groups} value={group} onChange={g => g && setGk(groupKey(g))} />
        <select aria-label="Type" className={cx(inputCls, 'w-auto')} value={type} onChange={e => setType(e.target.value as ExamType | 'all')}>
          <option value="all">All types</option>
          {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map(t => <option key={t} value={t}>{EXAM_TYPE_LABEL[t]}</option>)}
        </select>
      </div>

      <Card pad={false}>
        {exams.length === 0 ? <EmptyState icon={ClipboardList} title="No tests yet">Create a test to start entering marks.</EmptyState> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Test</th><th>Subject</th><th>Type</th><th>Date</th><th className="num">Total</th><th className="num">Entered</th><th className="num">Class average</th><th /></tr></thead>
              <tbody>
                {exams.map(e => {
                  const m = db.marks[e.id] ?? {}
                  const got = students.filter(s => m[s.id] != null)
                  const a = avg(got.map(s => (m[s.id] / e.totalMarks) * 100))
                  return (
                    <tr key={e.id}>
                      <td className="font-semibold">{e.name}</td>
                      <td>{e.subject}</td>
                      <td><Badge tone={TYPE_TONE[e.type]}>{EXAM_TYPE_LABEL[e.type]}</Badge></td>
                      <td className="whitespace-nowrap">{fmtDate(e.date)}{e.date > TODAY && <span className="ml-1.5 text-xs text-ink-soft">upcoming</span>}</td>
                      <td className="num">{e.totalMarks}</td>
                      <td className={cx('num', got.length < students.length && 'font-semibold text-marigold-deep')}>{got.length}/{students.length}</td>
                      <td className="num">{a == null ? '—' : <span className={cx('font-semibold', a < 40 && 'text-rose')}>{a.toFixed(0)}%</span>}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant={got.length < students.length ? 'primary' : 'outline'} icon={PenLine} onClick={() => setEntering(e.id)}>Enter marks</Button>
                          {got.length === 0 && (
                            <button aria-label={`Delete ${e.name}`} title="Delete test" className="rounded-lg p-2 text-ink-soft hover:bg-rose-soft hover:text-rose"
                              onClick={() => { if (confirm(`Delete “${e.name}”? This can't be undone.`)) { deleteExam(e.id); toast(`Deleted ${e.name}`) } }}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && <CreateTest group={group} subjects={subjects} onClose={() => setCreating(false)} onCreated={id => { setCreating(false); setEntering(id) }} />}
      {examFor && <MarksEntry exam={examFor} students={students} onClose={() => setEntering(null)} />}
    </div>
  )
}

function CreateTest({ group, subjects, onClose, onCreated }: { group: Group; subjects: string[]; onClose: () => void; onCreated: (id: string) => void }) {
  const { db, addExam, toast } = useStore()
  const [type, setType] = useState<ExamType>('class_test')
  const [subject, setSubject] = useState(subjects[0] ?? '')
  const [date, setDate] = useState(TODAY)
  // null = follow the suggestion until the teacher types their own
  const [name, setName] = useState<string | null>(null)
  const [total, setTotal] = useState<string | null>(null)
  const n = db.exams.filter(e => groupKey(e) === groupKey(group) && e.subject === subject && e.type === 'class_test').length
  const suggested = type === 'class_test' ? `${subject} class test ${n + 1}` : `${subject} ${EXAM_TYPE_LABEL[type].toLowerCase()}`
  const totalVal = total ?? (type === 'class_test' ? '20' : '100')
  const ok = subject && date && Number(totalVal) > 0

  const create = () => {
    if (!ok) return
    const finalName = (name ?? suggested).trim() || suggested
    const id = addExam({ name: finalName, type, subject, date, totalMarks: Number(totalVal), cls: group.cls, section: group.section, shift: group.shift })
    toast(`${finalName} created`)
    onCreated(id)
  }

  return (
    <Modal title="Create test" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!ok} onClick={create}>Create and enter marks</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); create() }}>
        <Field label="Type">
          <select className={inputCls} value={type} onChange={e => setType(e.target.value as ExamType)} autoFocus>
            {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map(t => <option key={t} value={t}>{EXAM_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Subject">
          <select className={inputCls} value={subject} onChange={e => setSubject(e.target.value)}>
            {subjects.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label="Name"><input className={inputCls} value={name ?? suggested} onChange={e => setName(e.target.value)} /></Field></div>
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Total marks"><input type="number" min={1} className={inputCls} value={totalVal} onChange={e => setTotal(e.target.value)} /></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function MarksEntry({ exam, students, onClose }: { exam: Exam; students: Student[]; onClose: () => void }) {
  const { db, saveMarks, toast } = useStore()
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(students.map(s => [s.id, db.marks[exam.id]?.[s.id]?.toString() ?? ''])))
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const file = useRef<HTMLInputElement>(null)

  const parse = (v: string) => (v.trim() === '' ? null : Number(v))
  const valid = (v: string) => { const x = parse(v); return x == null || (Number.isFinite(x) && x >= 0 && x <= exam.totalMarks) }
  const invalid = students.filter(s => !valid(vals[s.id])).length
  const entered = students.filter(s => parse(vals[s.id]) != null && valid(vals[s.id]))
  const classAvg = avg(entered.map(s => (parse(vals[s.id])! / exam.totalMarks) * 100))
  const set = (id: string, v: string) => setVals(x => ({ ...x, [id]: v }))

  const save = () => {
    if (invalid) return
    saveMarks(exam.id, Object.fromEntries(entered.map(s => [s.id, parse(vals[s.id])!])))
    toast(`Marks saved for ${entered.length} students`)
    onClose()
  }

  const importFile = async (f: File) => {
    try {
      const rows = await readSheet(f)
      let n = 0
      const next = { ...vals }
      for (const r of rows) {
        const s = students.find(x => x.id === String(r.id).trim()) ?? students.find(x => String(x.roll) === String(r.roll).trim())
        if (!s) continue
        next[s.id] = String(r.marks ?? '').trim(); n++
      }
      setVals(next)
      toast(n ? `Filled marks for ${n} students. Check them, then save.` : 'No matching students found in that sheet', n ? 'ok' : 'err')
    } catch {
      toast('Could not read that file. Use the downloaded sheet.', 'err')
    }
  }

  return (
    <Modal wide title={`${exam.name} · out of ${exam.totalMarks}`} onClose={onClose} footer={
      <div className="flex w-full flex-wrap items-center gap-2">
        <span className="mr-auto text-sm text-ink-soft">
          {invalid ? <span className="font-semibold text-rose">{invalid} invalid {invalid === 1 ? 'entry' : 'entries'}</span>
            : <>{entered.length}/{students.length} entered · class average <b className="text-ink">{classAvg == null ? '—' : `${classAvg.toFixed(0)}%`}</b></>}
        </span>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={invalid > 0} onClick={save}>Save marks</Button>
      </div>
    }>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2.5 text-sm">
        <span className="mr-auto text-ink-soft">Keep marks in Excel? Download the sheet, fill the marks column, upload it.</span>
        <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={Download}
          onClick={() => downloadXlsx(`Marks_${exam.name}_${exam.cls}${exam.section}_${exam.shift}.xlsx`.replace(/\s+/g, '_'), { Marks: students.map(s => ({ id: s.id, roll: s.roll, name: s.name, marks: vals[s.id] === '' ? '' : Number(vals[s.id]) })) })}>
          Download sheet
        </Button>
        <Button size="sm" variant="outline" icon={Upload} onClick={() => file.current?.click()}>Import marks from Excel</Button>
        </div>
        <input ref={file} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
      </div>
      <ul className="divide-y divide-line">
        {students.map((s, i) => {
          const v = vals[s.id], x = parse(v), ok = valid(v)
          const pct = x != null && ok ? (x / exam.totalMarks) * 100 : null
          const grade = pct == null ? null : gradeOf(pct).grade
          return (
            <li key={s.id} className="flex items-center gap-3 py-2">
              <span className="w-6 text-right text-sm font-semibold tabular-nums text-ink-soft">{s.roll}</span>
              <Avatar name={s.name} size={30} />
              <span className="min-w-0 flex-1 font-medium leading-snug">{s.name}</span>
              <input ref={el => { inputs.current[i] = el }} inputMode="decimal" autoFocus={i === 0} aria-label={`Marks for ${s.name}`} aria-invalid={!ok}
                value={v} placeholder="—" onChange={e => set(s.id, e.target.value)} onFocus={e => e.target.select()}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); inputs.current[i + 1]?.focus() }
                  if (e.key === 'ArrowUp') { e.preventDefault(); inputs.current[i - 1]?.focus() }
                }}
                className={cx(inputCls, 'w-20 text-right tabular-nums', !ok && 'border-rose bg-rose-soft focus:border-rose')} />
              <span className="hidden w-12 text-right text-sm tabular-nums text-ink-soft sm:block">{pct == null ? '' : `${pct.toFixed(0)}%`}</span>
              <span className="w-10">{grade ? <Badge tone={gradeTone(grade)}>{grade}</Badge> : !ok && <span className="text-xs font-semibold text-rose">0–{exam.totalMarks}</span>}</span>
              <button type="button" tabIndex={-1} title="Mark absent" aria-label={`Mark ${s.name} absent`} onClick={() => set(s.id, '')}
                className="rounded-lg p-1.5 text-ink-soft hover:bg-rose-soft hover:text-rose"><UserX size={16} /></button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
