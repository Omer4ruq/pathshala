// Self-check for seed data + grading rules. Run: node scripts/check.mjs
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { seed, DEMO_USERS } = await vite.ssrLoadModule('/src/lib/data.ts')
  const g = await vite.ssrLoadModule('/src/lib/grading.ts')

  assert.equal(g.gradeOf(80).grade, 'A+')
  assert.equal(g.gradeOf(79.9).grade, 'A')
  assert.equal(g.gradeOf(33).grade, 'D')
  assert.equal(g.gradeOf(32.9).grade, 'F')
  // missing final term -> remaining weights re-scaled: (60*20 + 80*30 + 90*10) / 60
  assert.equal(g.weightedPct({ class_test: 60, mid_term: 80, final: null, attendance: 90 }), 75)
  assert.equal(g.weightedPct({}), null)

  const db = seed()
  const demo = db.students.find(s => s.id === DEMO_USERS.find(u => u.role === 'student').refId)
  assert.equal(demo.name, 'Ayaan Chowdhury')
  assert.equal(demo.cls, 'Class 8')
  const res = g.studentResult(db, demo)
  assert.ok(res.overall > 0 && res.subjects.length === 6)
  const att = g.attendanceStats(db, demo.id)
  assert.ok(att.total > 30)
  const teacherGroups = db.assignments.filter(a => a.teacherId === 'T001')
  assert.ok(teacherGroups.length > 0)
  console.log(`ok: ${db.students.length} students, ${db.teachers.length} teachers, ${db.exams.length} exams, ${Object.keys(db.attendance).length} days, T001 teaches ${teacherGroups.length} groups, JSON ${(JSON.stringify(db).length / 1024).toFixed(0)}KB`)
} finally { await vite.close() }
