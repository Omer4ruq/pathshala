import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileSpreadsheet, Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react'
import { CLASSES, SECTIONS, SHIFTS, TODAY, taka, type Section, type Shift, type Student } from '../lib/data'
import { useStore } from '../lib/store'
import { downloadXlsx } from '../lib/export'
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, cx, inputCls } from '../components/ui'
import BulkImport, { isDate, isNumber, oneOf, pickOf, toDate, toNumber, toPhone, type BulkColumn } from '../components/BulkImport'

/** Default monthly tuition by class, same scale as the seed data. */
const feeFor = (cls: string) => 1500 + Math.max(0, CLASSES.indexOf(cls as never)) * 250

const COLUMNS: BulkColumn[] = [
  { key: 'id' },
  { key: 'name', required: true },
  { key: 'gender', check: oneOf(['Male', 'Female']), coerce: pickOf(['Male', 'Female']) },
  { key: 'cls', required: true, check: oneOf(CLASSES), coerce: pickOf(CLASSES) },
  { key: 'section', required: true, check: oneOf(SECTIONS), coerce: pickOf(SECTIONS) },
  { key: 'shift', required: true, check: oneOf(SHIFTS), coerce: pickOf(SHIFTS) },
  { key: 'roll', check: isNumber, coerce: toNumber },
  { key: 'guardian' },
  { key: 'phone', coerce: toPhone },
  { key: 'dob', check: isDate, coerce: toDate },
  { key: 'address' },
  { key: 'admissionDate', check: isDate, coerce: toDate },
  { key: 'monthlyFee', check: isNumber, coerce: toNumber },
  { key: 'status', check: oneOf(['active', 'inactive']), coerce: pickOf(['active', 'inactive']) },
]
const EXAMPLES = [
  { id: '', name: 'Rafsan Ahmed', gender: 'Male', cls: 'Class 3', section: 'A', shift: 'Morning', roll: 7, guardian: 'Kamrul Ahmed', phone: '01712345678', dob: '2017-04-12', address: 'House 12, Road 4, Mirpur, Dhaka', admissionDate: TODAY, monthlyFee: 2000, status: 'active' },
  { id: 'S0001', name: '', gender: '', cls: '', section: '', shift: '', roll: '', guardian: '', phone: '01898765432', dob: '', address: '', admissionDate: '', monthlyFee: 1750, status: '' },
]

type Draft = Omit<Student, 'id'> & { id?: string }
const blank = (): Draft => ({ name: '', gender: 'Male', cls: 'Play', section: 'A', shift: 'Morning', roll: 1, guardian: '', phone: '', dob: '', address: '', admissionDate: TODAY, monthlyFee: feeFor('Play'), status: 'active' })
const sel = cx(inputCls, 'w-auto')

export default function Students() {
  const { db, saveStudent, deleteStudent, upsertStudents, toast } = useStore()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [cls, setCls] = useState('')
  const [section, setSection] = useState('')
  const [shift, setShift] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [bulk, setBulk] = useState(false)

  const nextRoll = (g: { cls: string; section: string; shift: string }) =>
    1 + Math.max(0, ...db.students.filter(s => s.cls === g.cls && s.section === g.section && s.shift === g.shift).map(s => s.roll))

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.students
      .filter(s => (!cls || s.cls === cls) && (!section || s.section === section) && (!shift || s.shift === shift) && (!status || s.status === status))
      .filter(s => !t || s.name.toLowerCase().includes(t) || s.id.toLowerCase().includes(t) || s.phone.includes(t) || s.guardian.toLowerCase().includes(t))
      .sort((a, b) => CLASSES.indexOf(a.cls as never) - CLASSES.indexOf(b.cls as never) || a.section.localeCompare(b.section) || a.shift.localeCompare(b.shift) || a.roll - b.roll)
  }, [db.students, q, cls, section, shift, status])
  const boys = list.filter(s => s.gender === 'Male').length
  const filtered = q || cls || section || shift || status

  const clear = () => { setParams({}, { replace: true }); setCls(''); setSection(''); setShift(''); setStatus('') }

  const save = () => {
    if (!editing) return
    saveStudent({ ...editing, name: editing.name.trim() })
    toast(editing.id ? 'Student saved' : 'Student added')
    setEditing(null)
  }

  const importRows = (rows: Record<string, unknown>[]) => {
    const ids = new Set(db.students.map(s => s.id))
    const rolls = new Map<string, number>()
    const ready = rows.map(r => {
      if (ids.has(r.id as string)) return r as Partial<Student>
      // new student: fill what the sheet left blank
      const g = r as unknown as Student
      const key = `${g.cls}|${g.section}|${g.shift}`
      const roll = (r.roll as number) ?? (rolls.get(key) ?? nextRoll(g))
      rolls.set(key, roll + 1)
      return { ...blank(), monthlyFee: feeFor(g.cls), roll, ...r } as Partial<Student>
    })
    const { added, updated } = upsertStudents(ready)
    toast(`${added} added, ${updated} updated`)
  }

  const exportXlsx = () => {
    downloadXlsx(`Students_${TODAY}.xlsx`, { Students: list.map(s => Object.fromEntries(COLUMNS.map(c => [c.key, s[c.key as keyof Student]]))) })
    toast(`Exported ${list.length} students`)
  }

  return (
    <div>
      <PageHeader title="Students" subtitle={`${db.students.length} students from Play to Class 10`}
        actions={<>
          <Button variant="outline" icon={FileSpreadsheet} onClick={exportXlsx} disabled={!list.length}>Export Excel</Button>
          <Button variant="outline" icon={Upload} onClick={() => setBulk(true)}>Bulk import / update</Button>
          <Button variant="accent" icon={Plus} onClick={() => setEditing(blank())}>Add student</Button>
        </>} />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Search by name, ID or guardian phone" value={q}
              onChange={e => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} aria-label="Search students" />
          </div>
          <select className={sel} value={cls} onChange={e => setCls(e.target.value)} aria-label="Class">
            <option value="">All classes</option>{CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className={sel} value={section} onChange={e => setSection(e.target.value)} aria-label="Section">
            <option value="">All sections</option>{SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
          </select>
          <select className={sel} value={shift} onChange={e => setShift(e.target.value)} aria-label="Shift">
            <option value="">Both shifts</option>{SHIFTS.map(s => <option key={s} value={s}>{s} shift</option>)}
          </select>
          <select className={sel} value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
            <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
          {filtered && <Button variant="ghost" onClick={clear}>Clear filters</Button>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Badge>{list.length} shown</Badge>
          <Badge tone="sky">{boys} boys</Badge>
          <Badge tone="marigold">{list.length - boys} girls</Badge>
        </div>
      </Card>

      <Card pad={false}>
        {list.length === 0 ? (
          <EmptyState icon={Users} title="No students match">
            Try a different name or ID, or <button className="font-semibold text-ink underline" onClick={clear}>clear the filters</button>.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Student</th><th>Class</th><th className="num">Roll</th><th>Guardian</th><th className="num">Monthly fee</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {list.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={s.name} size={34} />
                        <div className="leading-tight"><div className="font-semibold">{s.name}</div><div className="text-xs text-ink-soft">{s.id}</div></div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{s.cls} · {s.section} · <span className="text-ink-soft">{s.shift}</span></td>
                    <td className="num">{s.roll}</td>
                    <td className="leading-tight"><div>{s.guardian}</div><div className="text-xs text-ink-soft">{s.phone}</div></td>
                    <td className="num">{taka(s.monthlyFee)}</td>
                    <td><Badge tone={s.status === 'active' ? 'teal' : 'rose'}>{s.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</Button>
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(s)} aria-label={`Delete ${s.name}`} className="hover:text-rose" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && <StudentForm draft={editing} setDraft={setEditing} nextRoll={nextRoll} onSave={save} onClose={() => setEditing(null)} />}

      {deleting && (
        <Modal title="Delete student" onClose={() => setDeleting(null)}
          footer={<>
            <Button variant="outline" onClick={() => setDeleting(null)}>Keep student</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { deleteStudent(deleting.id); toast('Student deleted'); setDeleting(null) }}>Delete student</Button>
          </>}>
          <p className="text-[15px]">Delete <b>{deleting.name}</b> ({deleting.id}, {deleting.cls} · {deleting.section} · {deleting.shift})?</p>
          <p className="mt-2 text-sm text-ink-soft">This cannot be undone. To keep their records but hide them from class lists, edit the student and set status to inactive instead.</p>
        </Modal>
      )}

      {bulk && <BulkImport entity="student" columns={COLUMNS} examples={EXAMPLES} existingIds={new Set(db.students.map(s => s.id))} onApply={importRows} onClose={() => setBulk(false)} />}
    </div>
  )
}

function StudentForm({ draft: d, setDraft, nextRoll, onSave, onClose }: {
  draft: Draft; setDraft: (d: Draft) => void; nextRoll: (g: Draft) => number; onSave: () => void; onClose: () => void
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    const n = { ...d, [k]: v }
    // new student: follow the class's default fee and the next free roll in the group
    if (!d.id && k === 'cls') n.monthlyFee = feeFor(v as string)
    if (!d.id && (k === 'cls' || k === 'section' || k === 'shift')) n.roll = nextRoll(n)
    setDraft(n)
  }
  const ok = d.name.trim() && d.roll > 0 && d.monthlyFee >= 0
  return (
    <Modal wide title={d.id ? `Edit ${d.name || 'student'}` : 'Add student'} onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!ok} onClick={onSave}>{d.id ? 'Save student' : 'Add student'}</Button>
      </>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); if (ok) onSave() }}>
        <Field label="Full name"><input autoFocus className={inputCls} value={d.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Rafsan Ahmed" required /></Field>
        <Field label="Gender">
          <select className={inputCls} value={d.gender} onChange={e => set('gender', e.target.value as Draft['gender'])}><option>Male</option><option>Female</option></select>
        </Field>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Class"><select className={inputCls} value={d.cls} onChange={e => set('cls', e.target.value)}>{CLASSES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Section"><select className={inputCls} value={d.section} onChange={e => set('section', e.target.value as Section)}>{SECTIONS.map(s => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Shift"><select className={inputCls} value={d.shift} onChange={e => set('shift', e.target.value as Shift)}>{SHIFTS.map(s => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Field label="Roll"><input type="number" min={1} className={inputCls} value={d.roll || ''} onChange={e => set('roll', Number(e.target.value))} /></Field>
        <Field label="Monthly fee (৳)" hint={d.id ? undefined : 'Filled from the class. Change it for discounts.'}>
          <input type="number" min={0} step={50} className={inputCls} value={d.monthlyFee} onChange={e => set('monthlyFee', Number(e.target.value))} />
        </Field>
        <Field label="Guardian name"><input className={inputCls} value={d.guardian} onChange={e => set('guardian', e.target.value)} /></Field>
        <Field label="Guardian phone"><input type="tel" className={inputCls} value={d.phone} onChange={e => set('phone', e.target.value)} placeholder="01XXXXXXXXX" /></Field>
        <Field label="Date of birth"><input type="date" className={inputCls} value={d.dob} onChange={e => set('dob', e.target.value)} /></Field>
        <Field label="Admission date"><input type="date" className={inputCls} value={d.admissionDate} onChange={e => set('admissionDate', e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Address"><input className={inputCls} value={d.address} onChange={e => set('address', e.target.value)} /></Field></div>
        <Field label="Status">
          <select className={inputCls} value={d.status} onChange={e => set('status', e.target.value as Draft['status'])}><option value="active">Active</option><option value="inactive">Inactive (left school)</option></select>
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
