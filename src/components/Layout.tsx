import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, CornerDownLeft, LogOut, Menu, Search, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { navFor, type NavItem } from '../nav'
import { useStore } from '../lib/store'
import { DEMO_USERS } from '../lib/data'
import { Avatar, cx } from './ui'

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span className="grid size-9 place-items-center rounded-xl bg-marigold">
        <svg viewBox="0 0 32 32" className="size-6"><path d="M6 12l10-5 10 5-10 5z" fill="#14213D" /><path d="M10 14.5v5.5c0 1.6 2.7 3.5 6 3.5s6-1.9 6-3.5v-5.5" stroke="#14213D" strokeWidth="2.4" fill="none" /></svg>
      </span>
      <div className="leading-tight">
        <div className="font-display text-[17px] font-bold text-white">Pathshala</div>
        <div className="text-[11px] text-white/55">Model School, Dhaka</div>
      </div>
    </div>
  )
}

function Sidebar({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const groups = [...new Set(items.map(i => i.group))]
  return (
    <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-6" aria-label="Main">
      {groups.map(g => (
        <div key={g} className="mt-6">
          <div className="mb-1.5 px-3 text-xs font-semibold text-white/40">{g}</div>
          {items.filter(i => i.group === g).map(i => (
            <NavLink key={i.to} to={i.to} end={i.to === '/'} onClick={onNavigate}
              className={({ isActive }) => cx('group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] font-medium transition',
                isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white')}>
              {({ isActive }) => <>
                {isActive && <span className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r-full bg-marigold" />}
                <i.icon size={18} className={isActive ? 'text-marigold' : ''} />
                {i.label}
              </>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const { db, user } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])

  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    const pages = navFor(user!.role).filter(n => !t || `${n.label} ${n.keywords ?? ''}`.toLowerCase().includes(t))
      .map(n => ({ key: n.to, label: n.label, sub: n.group, icon: n.icon, go: n.to }))
    const people = user!.role === 'super_admin' && t.length > 1
      ? db.students.filter(s => s.name.toLowerCase().includes(t) || s.id.toLowerCase() === t).slice(0, 6)
        .map(s => ({ key: s.id, label: s.name, sub: `Student · ${s.cls} ${s.section} · ${s.shift}`, icon: undefined, go: `/students?q=${encodeURIComponent(s.name)}` }))
      : []
    return [...pages, ...people]
  }, [q, db.students, user])

  const go = (to: string) => { nav(to); onClose() }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="animate-pop w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl shadow-ink/25" role="dialog" aria-label="Find a feature">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="text-ink-soft" />
          <input ref={input} value={q} placeholder="What do you want to do? e.g. take attendance, monthly report…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-soft/70"
            onChange={e => { setQ(e.target.value); setActive(0) }}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
              if (e.key === 'Enter' && results[active]) go(results[active].go)
            }} />
          <kbd className="rounded-md border border-line px-1.5 text-xs text-ink-soft">Esc</kbd>
        </div>
        <ul className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-soft">Nothing matches “{q}”. Try a word like “fees” or “report”.</li>}
          {results.map((r, i) => (
            <li key={r.key}>
              <button onMouseEnter={() => setActive(i)} onClick={() => go(r.go)}
                className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', i === active && 'bg-marigold-soft')}>
                {r.icon ? <span className="grid size-8 place-items-center rounded-lg bg-ink/5"><r.icon size={16} /></span> : <Avatar name={r.label} size={32} />}
                <span className="flex-1"><span className="block text-sm font-semibold">{r.label}</span><span className="block text-xs text-ink-soft">{r.sub}</span></span>
                {i === active && <CornerDownLeft size={15} className="text-ink-soft" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function UserMenu() {
  const { user, login, logout } = useStore()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  if (!user) return null
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 hover:bg-white" aria-expanded={open}>
        <Avatar name={user.name} size={34} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold">{user.name}</span>
          <span className="block text-xs text-ink-soft">{user.title}</span>
        </span>
        <ChevronDown size={16} className="hidden text-ink-soft sm:block" />
      </button>
      {open && <>
        <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div className="animate-pop absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-line bg-white p-2 shadow-xl shadow-ink/10">
          <div className="px-3 pb-1 pt-2 text-xs font-semibold text-ink-soft">Demo: view the app as</div>
          {DEMO_USERS.map(u => (
            <button key={u.id} onClick={() => { login(u); setOpen(false); nav('/') }}
              className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-paper', u.id === user.id && 'bg-marigold-soft')}>
              <Avatar name={u.name} size={30} />
              <span className="leading-tight"><span className="block text-sm font-semibold">{u.name}</span><span className="block text-xs text-ink-soft">{u.title}</span></span>
            </button>
          ))}
          <div className="my-1 border-t border-line" />
          <button onClick={() => { logout(); nav('/') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-rose hover:bg-rose-soft"><LogOut size={16} /> Sign out</button>
        </div>
      </>}
    </div>
  )
}

function Toasts() {
  const { toasts } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="animate-pop flex items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-lg">
          {t.tone === 'ok' ? <CheckCircle2 size={17} className="text-marigold" /> : <AlertCircle size={17} className="text-rose" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}

export default function Layout() {
  const { user } = useStore()
  const items = navFor(user!.role)
  const [palette, setPalette] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  const sidebar = <><div className="py-5"><Logo /></div><Sidebar items={items} onNavigate={() => setDrawer(false)} /></>

  return (
    <div className="min-h-full lg:pl-[264px]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-ink px-3 lg:flex">{sidebar}</aside>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} />
          <aside className="animate-pop absolute inset-y-0 left-0 flex w-[280px] flex-col bg-ink px-3">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-6 text-white/70" aria-label="Close menu"><X size={20} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur sm:px-8">
        <button className="rounded-lg p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={20} /></button>
        <button onClick={() => setPalette(true)} className="flex h-10 w-full max-w-md items-center gap-2.5 rounded-xl border border-line bg-white px-3 text-sm text-ink-soft hover:border-ink/30">
          <Search size={16} />
          <span className="flex-1 truncate text-left">Find a feature or student…</span>
          <kbd className="hidden rounded-md border border-line px-1.5 text-xs sm:inline">⌘K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => nav('/notices')} className="relative rounded-xl p-2.5 text-ink-soft hover:bg-white" aria-label="Notices">
            <Bell size={19} />
          </button>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8"><Outlet /></main>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
      <Toasts />
    </div>
  )
}
