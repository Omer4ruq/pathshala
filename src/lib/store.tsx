// Single app store. Every read/write the UI does goes through here, so swapping to Supabase
// means replacing these action bodies with supabase calls (see SUPABASE.md) — pages don't change.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CLASSES, DEMO_USERS, seed, TODAY, type AppUser, type AttendanceMark, type DB, type Exam, type FeeInvoice, type Notice, type Student, type Teacher, type Assignment } from './data'
import { DEFAULT_WEIGHTS, type Weights } from './grading'

const KEY = 'pathshala-demo-v2'
const USER_KEY = 'pathshala-user'

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to fresh seed */ }
  return seed()
}

let uid = Date.now()
const newId = (p: string) => `${p}${(uid++).toString(36).toUpperCase()}`

export interface Toast { id: number; text: string; tone: 'ok' | 'err' }

function useStoreValue() {
  const [db, setDb] = useState<DB>(load)
  const [user, setUser] = useState<AppUser | null>(() => {
    try { return DEMO_USERS.find(u => u.id === localStorage.getItem(USER_KEY)) ?? null } catch { return null }
  })
  const [weights, setWeightsState] = useState<Weights>(() => { try { return JSON.parse(localStorage.getItem(KEY + '-weights') ?? '') } catch { return DEFAULT_WEIGHTS } })
  const setWeights = (w: Weights) => { setWeightsState(w); try { localStorage.setItem(KEY + '-weights', JSON.stringify(w)) } catch { /* ignore */ } }
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // ponytail: whole-DB localStorage write on each change; fine for demo size, goes away with Supabase
    const t = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full/blocked: demo keeps working in memory */ } }, 300)
    return () => clearTimeout(t)
  }, [db])

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, text, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  const patch = (fn: (d: DB) => Partial<DB>) => setDb(d => ({ ...d, ...fn(d) }))

  const actions = {
    login(u: AppUser) { setUser(u); try { localStorage.setItem(USER_KEY, u.id) } catch { /* ignore */ } },
    logout() { setUser(null); try { localStorage.removeItem(USER_KEY) } catch { /* ignore */ } },
    resetDemo() { setDb(seed()); toast('Demo data restored') },

    saveStudent(s: Omit<Student, 'id'> & { id?: string }) {
      patch(d => s.id && d.students.some(x => x.id === s.id)
        ? { students: d.students.map(x => (x.id === s.id ? { ...x, ...s } as Student : x)) }
        : { students: [...d.students, { ...s, id: s.id || newId('S') } as Student] })
    },
    deleteStudent(id: string) { patch(d => ({ students: d.students.filter(s => s.id !== id) })) },
    /** Bulk upsert from Excel: rows with a known id update, others are added. Returns counts. */
    upsertStudents(rows: (Partial<Student> & { id?: string })[]) {
      let added = 0, updated = 0
      {
        const d = db
        const byId = new Map(d.students.map(s => [s.id, s]))
        for (const r of rows) {
          const cur = r.id ? byId.get(r.id) : undefined
          if (cur) { byId.set(cur.id, { ...cur, ...r } as Student); updated++ }
          else { const id = r.id || newId('S'); byId.set(id, { status: 'active', ...r, id } as Student); added++ }
        }
        setDb({ ...d, students: [...byId.values()] })
      }
      return { added, updated }
    },

    saveTeacher(t: Omit<Teacher, 'id'> & { id?: string }) {
      patch(d => t.id && d.teachers.some(x => x.id === t.id)
        ? { teachers: d.teachers.map(x => (x.id === t.id ? { ...x, ...t } as Teacher : x)) }
        : { teachers: [...d.teachers, { ...t, id: t.id || newId('T') } as Teacher] })
    },
    deleteTeacher(id: string) { patch(d => ({ teachers: d.teachers.filter(t => t.id !== id), assignments: d.assignments.filter(a => a.teacherId !== id) })) },
    upsertTeachers(rows: (Partial<Teacher> & { id?: string })[]) {
      let added = 0, updated = 0
      {
        const d = db
        const byId = new Map(d.teachers.map(t => [t.id, t]))
        for (const r of rows) {
          const cur = r.id ? byId.get(r.id) : undefined
          if (cur) { byId.set(cur.id, { ...cur, ...r } as Teacher); updated++ }
          else { const id = r.id || newId('T'); byId.set(id, { status: 'active', ...r, id } as Teacher); added++ }
        }
        setDb({ ...d, teachers: [...byId.values()] })
      }
      return { added, updated }
    },

    /** Assigning a subject to a class group replaces whoever taught it there before. */
    assign(a: Omit<Assignment, 'id'>) {
      patch(d => {
        let list = d.assignments.filter(x => !(x.cls === a.cls && x.section === a.section && x.shift === a.shift && x.subject === a.subject))
        if (a.isClassTeacher) list = list.map(x => (x.cls === a.cls && x.section === a.section && x.shift === a.shift ? { ...x, isClassTeacher: false } : x))
        return { assignments: [...list, { ...a, id: newId('A') }] }
      })
    },
    unassign(id: string) { patch(d => ({ assignments: d.assignments.filter(a => a.id !== id) })) },

    saveAttendance(date: string, marks: Record<string, AttendanceMark>) {
      patch(d => ({ attendance: { ...d.attendance, [date]: { ...d.attendance[date], ...marks } } }))
    },

    addExam(e: Omit<Exam, 'id'>) { const id = newId('E'); patch(d => ({ exams: [...d.exams, { ...e, id }] })); return id },
    deleteExam(id: string) { patch(d => { const marks = { ...d.marks }; delete marks[id]; return { exams: d.exams.filter(e => e.id !== id), marks } }) },
    saveMarks(examId: string, m: Record<string, number>) { patch(d => ({ marks: { ...d.marks, [examId]: m } })) },

    collectFee(invoiceId: string, amount: number, method: NonNullable<FeeInvoice['method']>) {
      patch(d => ({ fees: d.fees.map(f => (f.id === invoiceId ? { ...f, paidAmount: Math.min(f.amount, f.paidAmount + amount), paidOn: TODAY, method } : f)) }))
    },
    /** Creates invoices for every active student who doesn't have one for that month yet. */
    generateInvoices(month: string) {
      const has = new Set(db.fees.filter(f => f.month === month).map(f => f.studentId))
      const add = db.students.filter(s => s.status === 'active' && !has.has(s.id)).map(s => ({ id: newId('F'), studentId: s.id, month, amount: s.monthlyFee, paidAmount: 0 }))
      patch(d => ({ fees: [...d.fees, ...add] }))
      return add.length
    },
    paySalary(id: string) { patch(d => ({ salaries: d.salaries.map(s => (s.id === id ? { ...s, paid: true, paidOn: TODAY } : s)) })) },
    addExpense(x: Omit<DB['expenses'][number], 'id'>) { patch(d => ({ expenses: [...d.expenses, { ...x, id: newId('X') }] })) },

    addNotice(n: Omit<Notice, 'id' | 'date'>) { patch(d => ({ notices: [{ ...n, id: newId('N'), date: TODAY }, ...d.notices] })) },
    deleteNotice(id: string) { patch(d => ({ notices: d.notices.filter(n => n.id !== id) })) },
  }

  return { db, user, weights, setWeights, toasts, toast, ...actions }
}

type Store = ReturnType<typeof useStoreValue>
const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue()
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside <StoreProvider>')
  return s
}

/** Class groups the current user may work with: teachers see only their assigned groups, admins see all. */
export function useMyGroups() {
  const { db, user } = useStore()
  return useMemo(() => {
    const all = new Map<string, { cls: string; section: Student['section']; shift: Student['shift']; subjects: string[]; isClassTeacher: boolean }>()
    const list = user?.role === 'teacher' ? db.assignments.filter(a => a.teacherId === user.refId) : db.assignments
    for (const a of list) {
      const k = `${a.cls}|${a.section}|${a.shift}`
      const g = all.get(k) ?? { cls: a.cls, section: a.section, shift: a.shift, subjects: [], isClassTeacher: false }
      if (!g.subjects.includes(a.subject)) g.subjects.push(a.subject)
      g.isClassTeacher ||= a.isClassTeacher
      all.set(k, g)
    }
    return [...all.values()].sort((a, b) => CLASSES.indexOf(a.cls as never) - CLASSES.indexOf(b.cls as never) || a.section.localeCompare(b.section) || a.shift.localeCompare(b.shift))
  }, [db.assignments, user])
}
