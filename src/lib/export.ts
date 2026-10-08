// Excel + PDF helpers shared by every page.
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Student } from './data'
import type { studentResult } from './grading'

export const SCHOOL = { name: 'Pathshala Model School', address: 'Road 7, Dhanmondi, Dhaka 1205', phone: '+880 1711-000000' }

// ---------- Excel ----------
export function downloadXlsx(filename: string, sheets: Record<string, Record<string, unknown>[]>) {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31))
  XLSX.writeFile(wb, filename)
}

/** Reads the first sheet of an uploaded .xlsx/.xls/.csv into plain row objects (header row = keys). */
export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const wb = XLSX.read(await file.arrayBuffer())
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
}

// ---------- PDF ----------
const INK: [number, number, number] = [20, 33, 61]
const MARIGOLD: [number, number, number] = [244, 169, 59]

function header(doc: jsPDF, title: string, sub?: string) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...INK).rect(0, 0, w, 28, 'F')
  doc.setFillColor(...MARIGOLD).rect(0, 28, w, 1.5, 'F')
  doc.setTextColor(255).setFont('helvetica', 'bold').setFontSize(15).text(SCHOOL.name, 14, 12)
  doc.setFont('helvetica', 'normal').setFontSize(9).text(`${SCHOOL.address}  |  ${SCHOOL.phone}`, 14, 19)
  doc.setTextColor(...INK).setFont('helvetica', 'bold').setFontSize(14).text(title, 14, 42)
  if (sub) doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90).text(sub, 14, 49)
  doc.setTextColor(...INK)
  return sub ? 56 : 50
}

const fmt = (n: number | null | undefined, d = 0) => (n == null ? '—' : n.toFixed(d))
// jsPDF's built-in fonts have no Taka glyph
const tk = (n: number) => 'Tk ' + Math.round(n).toLocaleString('en-IN')

type Result = ReturnType<typeof studentResult>

function marksheetPage(doc: jsPDF, s: Student, res: Result, term: string, position?: number, classSize?: number) {
  let y = header(doc, 'Academic Transcript / Marksheet', term)
  autoTable(doc, {
    startY: y, theme: 'plain', styles: { fontSize: 10, cellPadding: 1.5 },
    body: [
      ['Student', s.name, 'Student ID', s.id],
      ['Class', `${s.cls}  (Section ${s.section}, ${s.shift} shift)`, 'Roll', String(s.roll)],
      ['Guardian', s.guardian, 'Position', position ? `${position} of ${classSize}` : '—'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 25 }, 2: { fontStyle: 'bold', cellWidth: 25 } },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  autoTable(doc, {
    startY: y,
    head: [['Subject', 'Class tests %', 'Mid term %', 'Final %', 'Attendance %', 'Total %', 'Grade', 'GP']],
    body: res.subjects.map(r => [r.subject, fmt(r.class_test), fmt(r.mid_term), fmt(r.final), fmt(r.attendance), fmt(r.total, 1), r.grade, r.gp.toFixed(2)]),
    headStyles: { fillColor: INK }, styles: { fontSize: 10, halign: 'center' }, columnStyles: { 0: { halign: 'left' } },
    alternateRowStyles: { fillColor: [246, 247, 249] },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  doc.setFillColor(253, 241, 220).roundedRect(14, y, 182, 20, 3, 3, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INK)
  doc.text(`GPA: ${res.gpa == null ? '—' : res.gpa.toFixed(2)}`, 20, y + 12.5)
  doc.text(`Overall: ${fmt(res.overall, 1)}%`, 75, y + 12.5)
  doc.text(`Grade: ${res.grade}`, 130, y + 12.5)
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(100)
  doc.text('Grade scale: A+ 80-100 | A 70-79 | A- 60-69 | B 50-59 | C 40-49 | D 33-39 | F 0-32. Any F makes GPA 0.00.', 14, y + 30)
  const h = doc.internal.pageSize.getHeight()
  doc.setDrawColor(150).line(20, h - 30, 70, h - 30).line(140, h - 30, 190, h - 30)
  doc.setTextColor(...INK).text('Class teacher', 33, h - 24).text('Principal', 158, h - 24)
}

export function downloadMarksheet(s: Student, res: Result, term: string, position?: number, classSize?: number) {
  const doc = new jsPDF()
  marksheetPage(doc, s, res, term, position, classSize)
  doc.save(`Marksheet_${s.id}_${s.name.replace(/\s+/g, '_')}.pdf`)
}

/** All marksheets of a class in one PDF, one page per student. */
export function downloadClassMarksheets(rows: { student: Student; result: Result; position: number }[], term: string, filename: string) {
  const doc = new jsPDF()
  rows.forEach((r, i) => { if (i) doc.addPage(); marksheetPage(doc, r.student, r.result, term, r.position, rows.length) })
  doc.save(filename)
}

/** Generic report: title + optional summary lines + any number of tables. */
export function downloadReportPdf(opts: { filename: string; title: string; subtitle?: string; summary?: [string, string][]; tables: { title?: string; head: string[]; body: (string | number)[][] }[]; landscape?: boolean }) {
  const doc = new jsPDF({ orientation: opts.landscape ? 'landscape' : 'portrait' })
  let y = header(doc, opts.title, opts.subtitle)
  if (opts.summary?.length) {
    autoTable(doc, { startY: y, theme: 'plain', body: [opts.summary.flatMap(([k, v]) => [k, v])], styles: { fontSize: 10 }, columnStyles: Object.fromEntries(opts.summary.map((_, i) => [i * 2, { fontStyle: 'bold' as const }])) })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  }
  for (const t of opts.tables) {
    if (t.title) { doc.setFont('helvetica', 'bold').setFontSize(11).text(t.title, 14, y + 4); y += 7 }
    autoTable(doc, { startY: y, head: [t.head], body: t.body.map(r => r.map(String)), headStyles: { fillColor: INK }, styles: { fontSize: 9 }, alternateRowStyles: { fillColor: [246, 247, 249] } })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  }
  doc.setFontSize(8).setTextColor(130).text(`Generated by Pathshala on ${new Date().toLocaleString('en-GB')}`, 14, doc.internal.pageSize.getHeight() - 8)
  doc.save(opts.filename)
}

export function downloadReceipt(o: { receiptNo: string; student: Student; month: string; amount: number; method: string; date: string }) {
  const doc = new jsPDF({ format: 'a5' })
  let y = header(doc, 'Fee Receipt', `Receipt #${o.receiptNo}  ·  ${o.date}`)
  autoTable(doc, {
    startY: y, theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: INK },
    body: [['Student', `${o.student.name} (${o.student.id})`], ['Class', `${o.student.cls} · ${o.student.section} · ${o.student.shift}`], ['Fee month', o.month], ['Paid via', o.method], ['Amount', tk(o.amount)]],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14
  doc.setFontSize(9).setTextColor(110).text('This is a computer-generated receipt.', 14, y)
  doc.save(`Receipt_${o.receiptNo}.pdf`)
}

/** Placeholder textbook PDF for the demo library; real files come from Supabase Storage later. */
export function openBookPdf(title: string, subject: string, cls: string) {
  const doc = new jsPDF()
  const y = header(doc, title, `${subject} · ${cls} · Sample chapter`)
  doc.setFontSize(11).setTextColor(60).text(doc.splitTextToSize('This is a sample chapter for the demo. Once storage is connected, the real textbook PDF uploaded by the school appears here, and students can read it online or download it.', 180), 14, y + 4)
  window.open(doc.output('bloburl'), '_blank')
}

export { tk }
