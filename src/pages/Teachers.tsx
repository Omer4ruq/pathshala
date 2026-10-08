import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Mail, Pencil, Phone, Plus, Search, Star, Trash2, Upload, UserSquare2 } from 'lucide-react'
import { CLASSES, TODAY, groupLabel, taka, type Teacher } from '../lib/data'
import { useStore } from '../lib/store'
import { downloadXlsx } from '../lib/export'
import { Avatar, Badge, Button, Card, EmptyState, Field, Modal, PageHeader, cx, inputCls } from '../components/ui'
import BulkImport, { isDate, isNumber, oneOf, pickOf, toDate, toNumber, toPhone, type BulkColumn } from '../components/BulkImport'

const SUBJECTS = ['Bangla', 'English', 'Math', 'Science', 'BGS', 'ICT', 'Drawing']

const COLUMNS: BulkColumn[] = [
  { key: 'id' },
  { key: 'name', required: true },
  { key: 'gender', check: oneOf(['Male', 'Female']), coerce: pickOf(['Male', 'Female']) },
  { key: 'subject', required: true, check: oneOf(SUBJECTS), coerce: pickOf(SUBJECTS) },
  { key: 'phone', coerce: toPhone },
  { key: 'email', check: v => (/^\S+@\S+\.\S+$/.test(v) ? undefined : 'is not a valid email') },
  { key: 'qualification' },
  { key: 'joinDate', check: isDate, coerce: toDate },
  { key: 'salary', check: isNumber, coerce: toNumber },
  { key: 'status', check: oneOf(['active', 'inactive']), coerce: pickOf(['active', 'inactive']) },
]
const EXAMPLES = [
  { id: '', name: 'Shirin Akter', gender: 'Female', subject: 'English', phone: '01711223344', email: 'shirin.akter@pathshala.edu.bd', qualification: 'MA (English)', joinDate: TODAY, salary: 28000, status: 'active' },
  { id: 'T002', name: '', gender: '', subject: '', phone: '', email: '', qualification: '', joinDate: '', salary: 32000, status: '' },
]

type Draft = Omit<Teacher, 'id'> & { id?: string }
const blank = (): Draft => ({ name: '', gender: 'Female', email: '', phone: '', subject: 'Bangla', qualification: '', joinDate: TODAY, salary: 25000, status: 'active' })
const byGroup = (a: { cls: string; section: string; shift: string }, b: typeof a) =>
  CLASSES.indexOf(a.cls as never) - CLASSES.indexOf(b.cls as never) || a.section.localeCompare(b.section) || a.shift.localeCompare(b.shift)

export default function Teachers() {
  const { db, saveTeacher, deleteTeacher, upsertTeachers, toast } = useStore()
  const [q, setQ] = useState('')
  const [subject, setSubject] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<Teacher | null>(null)
  const [viewing, setViewing] = useState<Teacher | null>(null)
  const [bulk, setBulk] = useState(false)
  const nav = useNavigate()

  const load = useMemo(() => {
    const m = new Map<string, { groups: Set<string>; ct: string[] }>()
    for (const a of db.assignments) {
      const x = m.get(a.teacherId) ?? { groups: new Set(), ct: [] }
      x.groups.add(groupLabel(a))
      if (a.isClassTeacher) x.ct.push(groupLabel(a))
      m.set(a.teacherId, x)
    }
    return m
  }, [db.assignments])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.teachers.filter(x => (!subject || x.subject === subject) &&
      (!t || x.name.toLowerCase().includes(t) || x.id.toLowerCase().includes(t) || x.phone.includes(t) || x.email.toLowerCase().includes(t)))
  }, [db.teachers, q, subject])

  const save = () => {
    if (!editing) return
    saveTeacher({ ...editing, name: editing.name.trim() })
    toast(editing.id ? 'Teacher saved' : 'Teacher added')
    setEditing(null)
  }

  const importRows = (rows: Record<string, unknown>[]) => {
    const ids = new Set(db.teachers.map(t => t.id))
    const { added, updated } = upsertTeachers(rows.map(r => (ids.has(r.id as string) ? r : { ...blank(), ...r }) as Partial<Teacher>))
    toast(`${added} added, ${updated} updated`)
  }

  const exportXlsx = () => {
    downloadXlsx(`Teachers_${TODAY}.xlsx`, { Teachers: list.map(t => ({ ...Object.fromEntries(COLUMNS.map(c => [c.key, t[c.key as keyof Teacher]])), classes: load.get(t.id)?.groups.size ?? 0, classTeacherOf: load.get(t.id)?.ct.join(', ') ?? '' })) })
    toast(`Exported ${list.length} teachers`)
  }

  return (
    <div>
      <PageHeader title="Teachers" subtitle={`${db.teachers.length} teachers · click a teacher to see their classes`}
        actions={<>
          <Button variant="outline" icon={FileSpreadsheet} onClick={exportXlsx} disabled={!list.length}>Export Excel</Button>
          <Button variant="outline" icon={Upload} onClick={() => setBulk(true)}>Bulk import / update</Button>
          <Button variant="accent" icon={Plus} onClick={() => setEditing(blank())}>Add teacher</Button>
        </>} />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input className={cx(inputCls, 'pl-9')} placeholder="Search by name, ID, phone or email" value={q} onChange={e => setQ(e.target.value)} aria-label="Search teachers" />
          </div>
          <select className={cx(inputCls, 'w-auto')} value={subject} onChange={e => setSubject(e.target.value)} aria-label="Subject">
            <option value="">All subjects</option>{SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </Card>

      <Card pad={false}>
        {list.length === 0 ? (
          <EmptyState icon={UserSquare2} title="No teachers match">Try another name or subject, or add a new teacher.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Teacher</th><th>Subject</th><th>Contact</th><th className="num">Salary</th><th className="num">Classes</th><th>Class teacher of</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {list.map(t => {
                  const l = load.get(t.id)
                  return (
                    <tr key={t.id} className="cursor-pointer" onClick={() => setViewing(t)}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={t.name} size={34} />
                          <div className="leading-tight"><div className="font-semibold">{t.name}</div><div className="text-xs text-ink-soft">{t.id} · {t.qualification}</div></div>
                        </div>
                      </td>
                      <td><Badge tone="sky">{t.subject}</Badge></td>
                      <td className="leading-tight"><div>{t.phone}</div><div className="text-xs text-ink-soft">{t.email}</div></td>
                      <td className="num">{taka(t.salary)}</td>
                      <td className="num">{l?.groups.size ?? 0}</td>
                      <td className="whitespace-nowrap">{l?.ct.length ? l.ct.join(', ') : <span className="text-ink-soft">—</span>}</td>
                      <td><Badge tone={t.status === 'active' ? 'teal' : 'rose'}>{t.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>Edit</Button>
                          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleting(t)} aria-label={`Delete ${t.name}`} className="hover:text-rose" />
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

      {viewing && (() => {
        const mine = db.assignments.filter(a => a.teacherId === viewing.id).sort(byGroup)
        return (
          <Modal title={viewing.name} onClose={() => setViewing(null)}
            footer={<>
              <Button variant="outline" icon={Pencil} onClick={() => { setEditing(viewing); setViewing(null) }}>Edit teacher</Button>
              <Button onClick={() => nav('/classes')}>Change assignments</Button>
            </>}>
            <div className="flex items-center gap-4">
              <Avatar name={viewing.name} size={52} />
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="sky">{viewing.subject}</Badge><span className="text-ink-soft">{viewing.qualification} · joined {viewing.joinDate}</span></div>
                <div className="mt-1.5 flex items-center gap-1.5 text-ink-soft"><Phone size={14} /> {viewing.phone}</div>
                <div className="flex items-center gap-1.5 truncate text-ink-soft"><Mail size={14} /> {viewing.email}</div>
              </div>
            </div>
            <h3 className="mb-2 mt-6 font-semibold">Teaches {mine.length} {mine.length === 1 ? 'class' : 'classes'}</h3>
            {mine.length === 0 ? <p className="text-sm text-ink-soft">No classes yet. Assign subjects from Classes & sections.</p> : (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {mine.map(a => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium">{groupLabel(a)}</span>
                    <span className="flex items-center gap-2">
                      {a.isClassTeacher && <Badge tone="marigold"><Star size={12} /> Class teacher</Badge>}
                      <span className="text-ink-soft">{a.subject}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Modal>
        )
      })()}

      {editing && <TeacherForm draft={editing} setDraft={setEditing} onSave={save} onClose={() => setEditing(null)} />}

      {deleting && (
        <Modal title="Delete teacher" onClose={() => setDeleting(null)}
          footer={<>
            <Button variant="outline" onClick={() => setDeleting(null)}>Keep teacher</Button>
            <Button variant="danger" icon={Trash2} onClick={() => { deleteTeacher(deleting.id); toast('Teacher deleted'); setDeleting(null) }}>Delete teacher</Button>
          </>}>
          <p className="text-[15px]">Delete <b>{deleting.name}</b> ({deleting.id})?</p>
          <p className="mt-2 text-sm text-ink-soft">
            Their {load.get(deleting.id)?.groups.size ?? 0} class assignments will also be removed, leaving those subjects without a teacher. This cannot be undone.
          </p>
        </Modal>
      )}

      {bulk && <BulkImport entity="teacher" columns={COLUMNS} examples={EXAMPLES} existingIds={new Set(db.teachers.map(t => t.id))} onApply={importRows} onClose={() => setBulk(false)} />}
    </div>
  )
}

function TeacherForm({ draft: d, setDraft, onSave, onClose }: { draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onClose: () => void }) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...d, [k]: v })
  const ok = d.name.trim() && d.salary >= 0
  return (
    <Modal wide title={d.id ? `Edit ${d.name || 'teacher'}` : 'Add teacher'} onClose={onClose}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!ok} onClick={onSave}>{d.id ? 'Save teacher' : 'Add teacher'}</Button>
      </>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); if (ok) onSave() }}>
        <Field label="Full name"><input autoFocus className={inputCls} value={d.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Shirin Akter" required /></Field>
        <Field label="Gender"><select className={inputCls} value={d.gender} onChange={e => set('gender', e.target.value as Draft['gender'])}><option>Female</option><option>Male</option></select></Field>
        <Field label="Main subject"><select className={inputCls} value={d.subject} onChange={e => set('subject', e.target.value)}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Qualification"><input className={inputCls} value={d.qualification} onChange={e => set('qualification', e.target.value)} placeholder="e.g. M.Ed" /></Field>
        <Field label="Phone"><input type="tel" className={inputCls} value={d.phone} onChange={e => set('phone', e.target.value)} placeholder="01XXXXXXXXX" /></Field>
        <Field label="Email"><input type="email" className={inputCls} value={d.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Joining date"><input type="date" className={inputCls} value={d.joinDate} onChange={e => set('joinDate', e.target.value)} /></Field>
        <Field label="Monthly salary (৳)"><input type="number" min={0} step={500} className={inputCls} value={d.salary} onChange={e => set('salary', Number(e.target.value))} /></Field>
        <Field label="Status"><select className={inputCls} value={d.status} onChange={e => set('status', e.target.value as Draft['status'])}><option value="active">Active</option><option value="inactive">Inactive (left school)</option></select></Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
