// Pure result logic: Bangladesh GPA-5 scale + attendance-weighted results. No React here, so it's reusable server-side later.
import type { DB, Exam, ExamType, Student } from './data'
import { subjectsFor } from './data'

export const GRADE_SCALE = [
  { min: 80, grade: 'A+', gp: 5 },
  { min: 70, grade: 'A', gp: 4 },
  { min: 60, grade: 'A-', gp: 3.5 },
  { min: 50, grade: 'B', gp: 3 },
  { min: 40, grade: 'C', gp: 2 },
  { min: 33, grade: 'D', gp: 1 },
  { min: 0, grade: 'F', gp: 0 },
]

export function gradeOf(pct: number) {
  return GRADE_SCALE.find(g => pct >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1]
}

export interface Weights { class_test: number; mid_term: number; final: number; attendance: number }
export const DEFAULT_WEIGHTS: Weights = { class_test: 20, mid_term: 30, final: 40, attendance: 10 }

/** Weighted % from component percentages. Missing components (null) are skipped and the rest re-scaled. */
export function weightedPct(parts: Partial<Record<keyof Weights, number | null>>, w: Weights = DEFAULT_WEIGHTS) {
  let sum = 0, wsum = 0
  for (const k of Object.keys(w) as (keyof Weights)[]) {
    const v = parts[k]
    if (v == null || w[k] <= 0) continue
    sum += v * w[k]; wsum += w[k]
  }
  return wsum ? sum / wsum : null
}

export interface Range { from?: string; to?: string } // inclusive ISO dates

const inRange = (d: string, r: Range) => (!r.from || d >= r.from) && (!r.to || d <= r.to)

export function attendanceStats(db: DB, studentId: string, r: Range = {}) {
  let p = 0, a = 0, l = 0
  for (const [date, day] of Object.entries(db.attendance)) {
    if (!inRange(date, r)) continue
    const m = day[studentId]
    if (m === 'P') p++; else if (m === 'A') a++; else if (m === 'L') l++
  }
  const total = p + a + l
  // a late counts as half a day present
  return { present: p, absent: a, late: l, total, pct: total ? ((p + l * 0.5) / total) * 100 : null }
}

export function examsForStudent(db: DB, s: Student, r: Range = {}) {
  return db.exams.filter(e => e.cls === s.cls && e.section === s.section && e.shift === s.shift && inRange(e.date, r))
}

const pctOf = (db: DB, e: Exam, sid: string) => {
  const v = db.marks[e.id]?.[sid]
  return v == null ? null : (v / e.totalMarks) * 100
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export interface SubjectResult {
  subject: string
  class_test: number | null
  mid_term: number | null
  final: number | null
  attendance: number | null
  total: number | null
  grade: string
  gp: number
}

export function studentResult(db: DB, s: Student, r: Range = {}, w: Weights = DEFAULT_WEIGHTS) {
  const exams = examsForStudent(db, s, r)
  const att = attendanceStats(db, s.id, r).pct
  const subjects: SubjectResult[] = subjectsFor(s.cls).map(subject => {
    const byType = (t: ExamType) => avg(exams.filter(e => e.subject === subject && e.type === t).map(e => pctOf(db, e, s.id)).filter((x): x is number => x != null))
    const parts = { class_test: byType('class_test'), mid_term: byType('mid_term'), final: byType('final'), attendance: att }
    const total = weightedPct(parts, w)
    const g = total == null ? { grade: '—', gp: 0 } : gradeOf(total)
    return { subject, ...parts, total, grade: g.grade, gp: g.gp }
  })
  const graded = subjects.filter(x => x.total != null)
  // BD rule: any F means GPA 0.00
  const gpa = graded.length ? (graded.some(x => x.gp === 0) ? 0 : graded.reduce((a, x) => a + x.gp, 0) / graded.length) : null
  const overall = avg(graded.map(x => x.total!))
  return { subjects, gpa, overall, attendance: att, grade: overall == null ? '—' : gradeOf(overall).grade }
}

/** Students of a class group ranked by overall % (ties share a position). */
export function rankGroup(db: DB, students: Student[], r: Range = {}, w: Weights = DEFAULT_WEIGHTS) {
  const rows = students.map(s => ({ student: s, result: studentResult(db, s, r, w) }))
  rows.sort((a, b) => (b.result.overall ?? -1) - (a.result.overall ?? -1))
  let pos = 0, prev: number | null | undefined
  return rows.map((row, i) => {
    if (row.result.overall !== prev) { pos = i + 1; prev = row.result.overall }
    return { ...row, position: pos }
  })
}

/** Flags used in weekly/monthly reports so teachers see who needs attention without digging. */
export function riskFlags(res: ReturnType<typeof studentResult>, attStats: ReturnType<typeof attendanceStats>) {
  const flags: string[] = []
  if (attStats.pct != null && attStats.pct < 75) flags.push(`Attendance ${attStats.pct.toFixed(0)}%`)
  if (attStats.absent >= 3) flags.push(`${attStats.absent} days absent`)
  for (const s of res.subjects) if (s.total != null && s.total < 40) flags.push(`Weak in ${s.subject}`)
  return flags
}
