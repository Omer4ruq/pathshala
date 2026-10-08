import { useState } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, cx, inputCls, type Tone } from '../components/ui'
import { useStore } from '../lib/store'
import type { Notice, Role } from '../lib/data'

type Audience = Notice['audience']
const VISIBLE: Record<Role, Audience[]> = {
  super_admin: ['All', 'Teachers', 'Students', 'Staff'],
  teacher: ['All', 'Teachers', 'Staff'],
  accountant: ['All', 'Staff'],
  student: ['All', 'Students'],
}
const CAN_POST: Partial<Record<Role, Audience[]>> = { super_admin: ['All', 'Teachers', 'Students', 'Staff'], teacher: ['All', 'Students', 'Teachers'] }
const TONE: Record<Audience, Tone> = { All: 'ink', Teachers: 'sky', Students: 'marigold', Staff: 'teal' }
const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function Notices() {
  const { db, user, addNotice, deleteNotice, toast } = useStore()
  const role = user!.role
  const visible = VISIBLE[role]
  const postable = CAN_POST[role]
  const [filter, setFilter] = useState<Audience | 'any'>('any')
  const [form, setForm] = useState<{ title: string; body: string; audience: Audience } | null>(null)

  const list = db.notices.filter(n => visible.includes(n.audience) && (filter === 'any' || n.audience === filter)).sort((a, b) => b.date.localeCompare(a.date))
  const [first, ...rest] = list

  const post = () => {
    if (!form || !form.title.trim() || !form.body.trim()) return toast('Add a title and a message', 'err')
    addNotice({ title: form.title.trim(), body: form.body.trim(), audience: form.audience })
    toast('Notice posted')
    setForm(null)
  }
  const remove = (n: Notice) => { deleteNotice(n.id); toast('Notice deleted') }

  return (
    <div>
      <PageHeader title="Notice board" subtitle="Announcements for the school community."
        actions={postable && <Button icon={Plus} onClick={() => setForm({ title: '', body: '', audience: 'All' })}>Post notice</Button>} />

      {visible.length > 2 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(['any', ...visible] as const).map(a => (
            <button key={a} onClick={() => setFilter(a)}
              className={cx('rounded-full border px-3.5 py-1.5 text-sm font-semibold transition', filter === a ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft hover:text-ink')}>
              {a === 'any' ? 'Everything' : a === 'All' ? 'Everyone' : a}
            </button>
          ))}
        </div>
      )}

      {!first ? <Card><EmptyState icon={Megaphone} title="No notices here">New announcements will show up on this board.</EmptyState></Card> : (
        <div className="space-y-4">
          {/* newest notice gets the spotlight */}
          <article className="rounded-2xl border border-marigold/40 bg-marigold-soft/60 p-6">
            <div className="flex items-center gap-2 text-sm text-ink-soft"><Badge tone="marigold">Latest</Badge>{fmt(first.date)} · For {first.audience === 'All' ? 'everyone' : first.audience.toLowerCase()}</div>
            <h2 className="mt-2 text-xl font-bold">{first.title}</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-line leading-relaxed">{first.body}</p>
            {role === 'super_admin' && <Button size="sm" variant="ghost" icon={Trash2} className="mt-3 -ml-3" onClick={() => remove(first)}>Delete</Button>}
          </article>
          {rest.length > 0 && (
            <Card pad={false}>
              <ul className="divide-y divide-line">
                {rest.map(n => (
                  <li key={n.id} className="flex gap-4 px-5 py-4">
                    <div className="w-16 shrink-0 pt-0.5 text-sm text-ink-soft">{fmt(n.date).replace(/ \d{4}$/, '')}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{n.title}</h3><Badge tone={TONE[n.audience]}>{n.audience === 'All' ? 'Everyone' : n.audience}</Badge></div>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{n.body}</p>
                    </div>
                    {role === 'super_admin' && <button onClick={() => remove(n)} aria-label={`Delete ${n.title}`} className="self-start rounded-lg p-2 text-ink-soft hover:bg-rose-soft hover:text-rose"><Trash2 size={16} /></button>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {form && postable && (
        <Modal title="Post a notice" onClose={() => setForm(null)}
          footer={<><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button onClick={post}>Post notice</Button></>}>
          <div className="space-y-4">
            <Field label="Title"><input autoFocus className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. School closed on Sunday" /></Field>
            <Field label="Message"><textarea rows={5} className={cx(inputCls, 'h-auto py-2')} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></Field>
            <Field label="Who should see it">
              <div className="flex flex-wrap gap-2">
                {postable.map(a => (
                  <button key={a} type="button" onClick={() => setForm({ ...form, audience: a })}
                    className={cx('rounded-full border px-3.5 py-1.5 text-sm font-semibold', form.audience === a ? 'border-ink bg-ink text-white' : 'border-line text-ink-soft hover:text-ink')}>
                    {a === 'All' ? 'Everyone' : a}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  )
}
