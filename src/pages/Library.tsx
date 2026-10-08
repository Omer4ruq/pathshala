import { useMemo, useState } from 'react'
import { BookOpen, Search, Upload } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader, cx, inputCls } from '../components/ui'
import { useStore } from '../lib/store'
import { CLASSES } from '../lib/data'
import { openBookPdf } from '../lib/export'

const COVER: Record<string, string> = {
  Bangla: 'from-[#E0475B] to-[#B5283C]', English: 'from-[#3B7DD8] to-[#22325A]', Math: 'from-[#F4A93B] to-[#B8740F]',
  Science: 'from-[#1F9D8B] to-[#126B5F]', BGS: 'from-[#8B5CF6] to-[#5B33B8]', ICT: 'from-[#22325A] to-[#14213D]', Drawing: 'from-[#EC7FA9] to-[#C2457A]',
}

export default function Library() {
  const { db, user, toast } = useStore()
  const student = user!.role === 'student' ? db.students.find(s => s.id === user!.refId) : undefined
  const [cls, setCls] = useState(student?.cls ?? 'Class 8')
  const [q, setQ] = useState('')
  const shownCls = student?.cls ?? cls

  const books = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.books.filter(b => (shownCls === 'All' || b.cls === shownCls) && (!t || `${b.title} ${b.subject}`.toLowerCase().includes(t)))
  }, [db.books, shownCls, q])

  return (
    <div>
      <PageHeader title="Books & PDFs" subtitle={student ? `Textbooks for ${student.cls}. Open any book to read it online.` : 'Textbooks for every class.'}
        actions={!student && <Button icon={Upload} variant="outline" onClick={() => toast('Uploads go live once file storage (Supabase Storage) is connected')}>Upload PDF</Button>} />

      <div className="mb-6 flex flex-wrap gap-2">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input className={cx(inputCls, 'pl-9')} value={q} onChange={e => setQ(e.target.value)} placeholder="Search books" aria-label="Search books" />
        </div>
        {!student && (
          <select className={cx(inputCls, 'w-auto')} value={cls} onChange={e => setCls(e.target.value)} aria-label="Class">
            <option value="All">All classes</option>
            {CLASSES.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
      </div>

      {books.length === 0 ? <Card><EmptyState icon={BookOpen} title="No books found">Try another search{student ? '' : ' or class'}.</EmptyState></Card> : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {books.map(b => (
            <div key={b.id} className="group">
              <button onClick={() => openBookPdf(b.title, b.subject, b.cls)} aria-label={`Read ${b.title}`}
                className={cx('relative flex aspect-3/4 w-full flex-col justify-between overflow-hidden rounded-r-2xl rounded-l-md bg-linear-to-br p-4 text-left text-white shadow-md shadow-ink/10 transition group-hover:-translate-y-1 group-hover:shadow-lg', COVER[b.subject] ?? COVER.ICT)}>
                <span className="absolute inset-y-0 left-0 w-2.5 bg-black/15" />
                <span className="pl-2 text-xs font-semibold text-white/80">{b.cls}</span>
                <span className="pl-2">
                  <span className="block font-display text-2xl font-bold leading-tight">{b.subject}</span>
                  <span className="mt-1 block text-xs text-white/75">Pathshala Model School</span>
                </span>
                <span className="absolute -bottom-6 -right-6 size-24 rounded-full bg-white/10" />
              </button>
              <div className="mt-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{b.title}</div>
                  <div className="text-xs text-ink-soft">{b.pages} pages · PDF</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openBookPdf(b.title, b.subject, b.cls)}>Read</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
