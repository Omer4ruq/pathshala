// Types + deterministic dummy data. When moving to Supabase, these types map 1:1 to tables (see SUPABASE.md).

export type Role = 'super_admin' | 'teacher' | 'accountant' | 'student'
export type Shift = 'Morning' | 'Day'
export type Section = 'A' | 'B'
export type AttendanceMark = 'P' | 'A' | 'L'
export type ExamType = 'class_test' | 'mid_term' | 'final'

export const CLASSES = ['Play', 'Nursery', 'KG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'] as const
export const SECTIONS: Section[] = ['A', 'B']
export const SHIFTS: Shift[] = ['Morning', 'Day']
export const EXAM_TYPE_LABEL: Record<ExamType, string> = { class_test: 'Class test', mid_term: 'Mid term', final: 'Final term' }

export function subjectsFor(cls: string): string[] {
  const i = CLASSES.indexOf(cls as (typeof CLASSES)[number])
  if (i <= 2) return ['Bangla', 'English', 'Math', 'Drawing']
  if (i <= 7) return ['Bangla', 'English', 'Math', 'Science', 'BGS']
  return ['Bangla', 'English', 'Math', 'Science', 'BGS', 'ICT']
}

export interface Student {
  id: string
  name: string
  gender: 'Male' | 'Female'
  cls: string
  section: Section
  shift: Shift
  roll: number
  guardian: string
  phone: string
  dob: string
  address: string
  admissionDate: string
  monthlyFee: number
  status: 'active' | 'inactive'
}

export interface Teacher {
  id: string
  name: string
  gender: 'Male' | 'Female'
  email: string
  phone: string
  subject: string
  qualification: string
  joinDate: string
  salary: number
  status: 'active' | 'inactive'
}

export interface Assignment {
  id: string
  teacherId: string
  cls: string
  section: Section
  shift: Shift
  subject: string
  isClassTeacher: boolean
}

export interface Exam {
  id: string
  name: string
  type: ExamType
  cls: string
  section: Section
  shift: Shift
  subject: string
  date: string
  totalMarks: number
}

export interface FeeInvoice {
  id: string
  studentId: string
  month: string // YYYY-MM
  amount: number
  paidAmount: number
  paidOn?: string
  method?: 'Cash' | 'bKash' | 'Nagad' | 'Bank'
}

export interface SalaryRecord {
  id: string
  teacherId: string
  month: string
  amount: number
  paid: boolean
  paidOn?: string
}

export interface Expense {
  id: string
  date: string
  category: string
  note: string
  amount: number
}

export interface Notice {
  id: string
  date: string
  title: string
  body: string
  audience: 'All' | 'Teachers' | 'Students' | 'Staff'
}

export interface Book {
  id: string
  title: string
  subject: string
  cls: string
  pages: number
}

export interface AppUser {
  id: string
  name: string
  role: Role
  title: string
  refId?: string // teacher id / student id
}

export interface DB {
  students: Student[]
  teachers: Teacher[]
  assignments: Assignment[]
  attendance: Record<string, Record<string, AttendanceMark>> // date -> studentId -> mark
  exams: Exam[]
  marks: Record<string, Record<string, number>> // examId -> studentId -> obtained
  fees: FeeInvoice[]
  salaries: SalaryRecord[]
  expenses: Expense[]
  notices: Notice[]
  books: Book[]
}

// ---- helpers shared across the app ----
export const TODAY = '2026-10-08'
export const groupKey = (g: { cls: string; section: string; shift: string }) => `${g.cls}|${g.section}|${g.shift}`
export const groupLabel = (g: { cls: string; section: string; shift: string }) => `${g.cls} · ${g.section} · ${g.shift}`
export const iso = (d: Date) => d.toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
// Bangladesh weekend: Friday + Saturday
export const isSchoolDay = (s: string) => { const w = new Date(s + 'T00:00:00Z').getUTCDay(); return w !== 5 && w !== 6 }
export const taka = (n: number) => '৳' + Math.round(n).toLocaleString('en-IN')
export const monthLabel = (m: string) => new Date(m + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// ---- seed ----
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const FIRST_M = ['Arif', 'Tanvir', 'Rakib', 'Sakib', 'Nayeem', 'Fahim', 'Imran', 'Rifat', 'Sabbir', 'Mahin', 'Ayaan', 'Rayhan', 'Zahid', 'Tamim', 'Shafin', 'Nafis', 'Junaid', 'Ehsan']
const FIRST_F = ['Nusrat', 'Tasnim', 'Sadia', 'Farzana', 'Mim', 'Anika', 'Raisa', 'Lamia', 'Sumaiya', 'Ishrat', 'Tahmina', 'Nabila', 'Orpa', 'Jannat', 'Maliha', 'Afrin', 'Samira', 'Tanha']
const LAST = ['Rahman', 'Hossain', 'Ahmed', 'Islam', 'Chowdhury', 'Karim', 'Akter', 'Sarker', 'Uddin', 'Haque', 'Talukder', 'Mia', 'Khan', 'Sheikh', 'Biswas', 'Das', 'Roy']
const AREAS = ['Dhanmondi', 'Mirpur', 'Uttara', 'Mohammadpur', 'Banani', 'Bashundhara', 'Gulshan', 'Motijheel', 'Badda', 'Rampura']

export function seed(): DB {
  const r = rng(42)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const phone = () => '01' + pick(['7', '8', '9', '3', '5', '6']) + String(Math.floor(r() * 1e8)).padStart(8, '0')

  // Teachers
  const teacherSubjects = ['Bangla', 'English', 'Math', 'Science', 'BGS', 'ICT', 'Drawing']
  const teachers: Teacher[] = Array.from({ length: 24 }, (_, i) => {
    const gender = r() < 0.55 ? 'Female' : 'Male'
    const name = `${gender === 'Female' ? pick(FIRST_F) : pick(FIRST_M)} ${pick(LAST)}`
    return {
      id: `T${String(i + 1).padStart(3, '0')}`, name, gender,
      email: name.toLowerCase().replace(/\s+/g, '.') + '@pathshala.edu.bd', phone: phone(),
      subject: teacherSubjects[i % teacherSubjects.length],
      qualification: pick(['B.Ed', 'M.Ed', 'MA (English)', 'M.Sc (Math)', 'BSc (Physics)', 'MA (Bangla)', 'BBA, B.Ed']),
      joinDate: `20${10 + Math.floor(r() * 15)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
      salary: 22000 + Math.floor(r() * 14) * 1500, status: 'active',
    }
  })
  teachers[0] = { ...teachers[0], name: 'Nusrat Jahan', gender: 'Female', email: 'nusrat.jahan@pathshala.edu.bd', subject: 'Math' }

  // Students: 6 per class/section/shift
  const students: Student[] = []
  const ability: Record<string, number> = {}
  let sid = 1
  CLASSES.forEach((cls, ci) => SECTIONS.forEach(section => SHIFTS.forEach(shift => {
    for (let roll = 1; roll <= 6; roll++) {
      const gender = r() < 0.5 ? 'Female' : 'Male'
      const last = pick(LAST)
      const id = `S${String(sid++).padStart(4, '0')}`
      ability[id] = 0.35 + r() * 0.6
      students.push({
        id, name: `${gender === 'Female' ? pick(FIRST_F) : pick(FIRST_M)} ${last}`, gender, cls, section, shift, roll,
        guardian: `${pick(FIRST_M)} ${last}`, phone: phone(),
        dob: `${2022 - ci}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
        address: `House ${1 + Math.floor(r() * 90)}, Road ${1 + Math.floor(r() * 30)}, ${pick(AREAS)}, Dhaka`,
        admissionDate: `20${24 + Math.floor(r() * 3)}-01-0${1 + Math.floor(r() * 9)}`,
        monthlyFee: 1500 + ci * 250, status: 'active',
      })
    }
  })))
  // demo student login
  students.find(s => s.cls === 'Class 8' && s.section === 'A' && s.shift === 'Morning' && s.roll === 1)!.name = 'Ayaan Chowdhury'

  // Assignments: each group gets one teacher per subject; first is class teacher
  const assignments: Assignment[] = []
  let aid = 1
  CLASSES.forEach(cls => SECTIONS.forEach(section => SHIFTS.forEach(shift => {
    subjectsFor(cls).forEach((subject, si) => {
      const pool = teachers.filter(t => t.subject === subject)
      const t = pool[(CLASSES.indexOf(cls) + (section === 'B' ? 1 : 0) + (shift === 'Day' ? 2 : 0)) % pool.length]
      assignments.push({ id: `A${aid++}`, teacherId: t.id, cls, section, shift, subject, isClassTeacher: si === 0 })
    })
  })))
  // make the demo teacher (Math) class teacher of Class 8-A Morning
  for (const a of assignments) if (a.cls === 'Class 8' && a.section === 'A' && a.shift === 'Morning') a.isClassTeacher = a.subject === 'Math'

  // Attendance: last ~9 weeks of school days (until yesterday)
  const attendance: DB['attendance'] = {}
  for (let d = addDays(TODAY, -63); d < TODAY; d = addDays(d, 1)) {
    if (!isSchoolDay(d)) continue
    const day: Record<string, AttendanceMark> = {}
    for (const s of students) {
      const p = 0.78 + ability[s.id] * 0.2
      const x = r()
      day[s.id] = x < p ? 'P' : x < p + 0.04 ? 'L' : 'A'
    }
    attendance[d] = day
  }

  // Exams + marks: weekly class tests (rotating subjects) + one mid term per subject; finals scheduled in December
  const exams: Exam[] = []
  const marks: DB['marks'] = {}
  let eid = 1
  const testDates = [-56, -49, -42, -35, -28, -21, -14, -7, -2].map(n => addDays(TODAY, n))
  CLASSES.forEach(cls => SECTIONS.forEach(section => SHIFTS.forEach(shift => {
    const subs = subjectsFor(cls)
    const add = (e: Omit<Exam, 'id' | 'cls' | 'section' | 'shift'>, withMarks: boolean) => {
      const exam: Exam = { id: `E${eid++}`, cls, section, shift, ...e }
      exams.push(exam)
      if (!withMarks) return
      const m: Record<string, number> = {}
      for (const s of students) if (s.cls === cls && s.section === section && s.shift === shift) {
        const pct = Math.min(1, Math.max(0.15, ability[s.id] + (r() - 0.5) * 0.25))
        m[s.id] = Math.round(pct * e.totalMarks)
      }
      marks[exam.id] = m
    }
    testDates.forEach((date, i) => {
      for (const k of [0, 1]) {
        const subject = subs[(i * 2 + k) % subs.length]
        add({ name: `${subject} class test ${Math.floor((i * 2 + k) / subs.length) + 1}`, type: 'class_test', subject, date, totalMarks: 20 }, i < testDates.length - 1)
      }
    })
    subs.forEach(subject => add({ name: `${subject} mid term`, type: 'mid_term', subject, date: '2026-08-20', totalMarks: 100 }, true))
    subs.forEach(subject => add({ name: `${subject} final term`, type: 'final', subject, date: '2026-12-06', totalMarks: 100 }, false))
  })))

  // Fees: Aug–Oct invoices
  const fees: FeeInvoice[] = []
  let fid = 1
  for (const month of ['2026-08', '2026-09', '2026-10']) for (const s of students) {
    const x = r()
    const paid = month === '2026-10' ? x < 0.45 : month === '2026-09' ? x < 0.88 : x < 0.97
    fees.push({
      id: `F${fid++}`, studentId: s.id, month, amount: s.monthlyFee, paidAmount: paid ? s.monthlyFee : 0,
      paidOn: paid ? `${month}-${String(1 + Math.floor(r() * (month === '2026-10' ? 7 : 25))).padStart(2, '0')}` : undefined,
      method: paid ? pick(['Cash', 'bKash', 'bKash', 'Nagad', 'Bank'] as const) : undefined,
    })
  }

  const salaries: SalaryRecord[] = []
  for (const month of ['2026-08', '2026-09', '2026-10']) for (const t of teachers)
    salaries.push({ id: `SAL-${month}-${t.id}`, teacherId: t.id, month, amount: t.salary, paid: month !== '2026-10', paidOn: month !== '2026-10' ? `${month}-28` : undefined })

  const expenses: Expense[] = [
    { id: 'X1', date: '2026-08-05', category: 'Utilities', note: 'Electricity bill (DESCO)', amount: 38500 },
    { id: 'X2', date: '2026-08-12', category: 'Supplies', note: 'Chalk, markers, exam papers', amount: 12400 },
    { id: 'X3', date: '2026-09-05', category: 'Utilities', note: 'Electricity bill (DESCO)', amount: 41200 },
    { id: 'X4', date: '2026-09-18', category: 'Maintenance', note: 'Classroom fan repair', amount: 9800 },
    { id: 'X5', date: '2026-10-03', category: 'Events', note: 'Inter-house science fair', amount: 25000 },
    { id: 'X6', date: '2026-10-05', category: 'Utilities', note: 'Electricity bill (DESCO)', amount: 39700 },
  ]

  const notices: Notice[] = [
    { id: 'N1', date: '2026-10-07', title: 'Final term routine published', body: 'Final term exams start on 6 December. Routine is available from class teachers and on the notice board.', audience: 'All' },
    { id: 'N2', date: '2026-10-05', title: 'Parent–teacher meeting', body: 'PTM for Class 6–10 on 15 October, 10:00 AM in the main hall.', audience: 'All' },
    { id: 'N3', date: '2026-10-02', title: 'Submit September class test marks', body: 'Teachers, please finish entering all September class test marks by 10 October so monthly reports can be generated.', audience: 'Teachers' },
    { id: 'N4', date: '2026-09-28', title: 'October fees due on the 10th', body: 'Fees can be paid by cash at the office, bKash or Nagad.', audience: 'Students' },
  ]

  const books: Book[] = []
  CLASSES.forEach(cls => subjectsFor(cls).forEach(subject => books.push({ id: `B-${cls}-${subject}`.replace(/\s/g, ''), title: `${subject} — ${cls} textbook`, subject, cls, pages: 80 + Math.floor(r() * 140) })))

  return { students, teachers, assignments, attendance, exams, marks, fees, salaries, expenses, notices, books }
}

export const DEMO_USERS: AppUser[] = [
  { id: 'u-admin', name: 'Farhana Rahman', role: 'super_admin', title: 'Principal · Super admin' },
  { id: 'u-teacher', name: 'Nusrat Jahan', role: 'teacher', title: 'Math teacher', refId: 'T001' },
  { id: 'u-acc', name: 'Kamal Hossain', role: 'accountant', title: 'Accounts officer' },
  { id: 'u-student', name: 'Ayaan Chowdhury', role: 'student', title: 'Class 8 · A · Morning', refId: 'S0241' },
]
