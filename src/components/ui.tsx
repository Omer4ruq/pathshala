import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CLASSES, SECTIONS, SHIFTS, type Section, type Shift } from '../lib/data'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-2',
  accent: 'bg-marigold text-ink hover:brightness-95',
  outline: 'border border-line bg-white text-ink hover:bg-paper',
  ghost: 'text-ink-soft hover:bg-paper hover:text-ink',
  danger: 'bg-rose text-white hover:brightness-95',
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: LucideIcon }) {
  return (
    <button
      {...p}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap', size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm', VARIANTS[variant], className)}
    >
      {Icon && <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2.2} />}
      {children}
    </button>
  )
}

export function Card({ title, action, className, children, pad = true }: { title?: ReactNode; action?: ReactNode; className?: string; children: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('rounded-2xl border border-line bg-white', !pad && 'overflow-hidden', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5 pt-2' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const TONES = {
  ink: 'bg-ink/5 text-ink',
  marigold: 'bg-marigold-soft text-marigold-deep',
  teal: 'bg-teal-soft text-teal',
  rose: 'bg-rose-soft text-rose',
  sky: 'bg-sky-soft text-sky',
}
export type Tone = keyof typeof TONES

export function Badge({ tone = 'ink', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone])}>{children}</span>
}

export function Stat({ label, value, hint, icon: Icon, tone = 'ink' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-soft">{label}</span>
        {Icon && <span className={cx('grid size-9 place-items-center rounded-xl', TONES[tone])}><Icon size={18} /></span>}
      </div>
      <div className="mt-2 font-display text-[22px] font-bold leading-none sm:text-[30px]">{value}</div>
      {hint && <div className="mt-2 text-[13px] text-ink-soft">{hint}</div>}
    </div>
  )
}

// Base look lives in index.css (.field, components layer) so per-use utilities like w-20 / w-auto / h-8 always win.
export const inputCls = 'field'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
    </label>
  )
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('animate-pop flex max-h-[90vh] w-full flex-col rounded-3xl bg-white shadow-2xl shadow-ink/20', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-soft hover:bg-paper"><X size={18} /></button>
        </header>
        <div className="scrollbar-thin overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-paper text-ink-soft"><Icon size={22} /></span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-soft">{children}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-ink/5 p-1" role="tablist">
      {items.map(i => (
        <button key={i.value} role="tab" aria-selected={value === i.value} onClick={() => onChange(i.value)}
          className={cx('rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', value === i.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink')}>
          {i.label}
        </button>
      ))}
    </div>
  )
}

const AVATAR_BG = ['#F4A93B', '#1F9D8B', '#3B7DD8', '#E0475B', '#8B5CF6', '#14213D']
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('')
  const bg = AVATAR_BG[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length]
  return <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }}>{initials}</span>
}

export function Progress({ value, tone = 'teal' }: { value: number; tone?: 'teal' | 'rose' | 'marigold' | 'sky' }) {
  const color = { teal: 'bg-teal', rose: 'bg-rose', marigold: 'bg-marigold', sky: 'bg-sky' }[tone]
  return <div className="h-2 w-full overflow-hidden rounded-full bg-ink/5"><div className={cx('h-full rounded-full', color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

export interface Group { cls: string; section: Section; shift: Shift }

/** Class / section / shift picker. Pass `allowed` to limit choices (e.g. a teacher's assigned groups). */
export function GroupPicker({ value, onChange, allowed, allowAll }: { value: Group | null; onChange: (g: Group | null) => void; allowed?: Group[]; allowAll?: boolean }) {
  if (allowed) {
    return (
      <select className={cx(inputCls, 'w-auto min-w-56')} value={value ? `${value.cls}|${value.section}|${value.shift}` : ''}
        onChange={e => { const g = allowed.find(a => `${a.cls}|${a.section}|${a.shift}` === e.target.value); onChange(g ?? null) }} aria-label="Class">
        {allowAll && <option value="">All classes</option>}
        {allowed.map(g => <option key={`${g.cls}|${g.section}|${g.shift}`} value={`${g.cls}|${g.section}|${g.shift}`}>{g.cls} · Section {g.section} · {g.shift}</option>)}
      </select>
    )
  }
  const v = value ?? { cls: CLASSES[0], section: 'A' as Section, shift: 'Morning' as Shift }
  return (
    <div className="flex flex-wrap gap-2">
      <select aria-label="Class" className={cx(inputCls, 'w-auto')} value={v.cls} onChange={e => onChange({ ...v, cls: e.target.value })}>
        {CLASSES.map(c => <option key={c}>{c}</option>)}
      </select>
      <select aria-label="Section" className={cx(inputCls, 'w-auto')} value={v.section} onChange={e => onChange({ ...v, section: e.target.value as Section })}>
        {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
      </select>
      <select aria-label="Shift" className={cx(inputCls, 'w-auto')} value={v.shift} onChange={e => onChange({ ...v, shift: e.target.value as Shift })}>
        {SHIFTS.map(s => <option key={s} value={s}>{s} shift</option>)}
      </select>
    </div>
  )
}

export const gradeTone = (g: string): Tone => (g === 'A+' || g === 'A' ? 'teal' : g === 'F' ? 'rose' : g === 'D' || g === 'C' ? 'marigold' : g === '—' ? 'ink' : 'sky')
