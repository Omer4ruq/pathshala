import { ShieldCheck, UserSquare2, Calculator, GraduationCap, type LucideIcon } from 'lucide-react'
import { DEMO_USERS, type Role } from '../lib/data'
import { useStore } from '../lib/store'

const ROLE_INFO: Record<Role, { icon: LucideIcon; label: string; can: string }> = {
  super_admin: { icon: ShieldCheck, label: 'Super admin', can: 'Everything: people, classes, results, accounts and settings' },
  teacher: { icon: UserSquare2, label: 'Teacher', can: 'Attendance, tests, marks and ready-made reports for assigned classes' },
  accountant: { icon: Calculator, label: 'Accountant', can: 'Fee collection, dues, receipts and teacher salaries' },
  student: { icon: GraduationCap, label: 'Student', can: 'Performance graph, marksheets, books and the AI tutor' },
}

export default function Login() {
  const { login } = useStore()
  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-marigold">
            <svg viewBox="0 0 32 32" className="size-7"><path d="M6 12l10-5 10 5-10 5z" fill="#14213D" /><path d="M10 14.5v5.5c0 1.6 2.7 3.5 6 3.5s6-1.9 6-3.5v-5.5" stroke="#14213D" strokeWidth="2.4" fill="none" /></svg>
          </span>
          <span className="font-display text-xl font-bold">Pathshala</span>
        </div>
        <div className="my-auto max-w-lg">
          <h1 className="font-display text-[56px] font-extrabold leading-[1.02]">Mark it once. The reports are already done.</h1>
          <p className="mt-6 text-lg leading-relaxed text-white/70">
            Teachers take attendance and enter marks. Pathshala turns them into weekly reports, monthly reports and final marksheets, from Play to Class 10.
          </p>
        </div>
        {/* Report card motif: the thing this product produces */}
        <div className="absolute -bottom-10 -right-10 w-80 rotate-[-8deg] rounded-2xl bg-white p-5 text-ink shadow-2xl">
          <div className="flex items-center justify-between text-sm font-semibold"><span>Monthly report · Class 8 A</span><span className="rounded-full bg-teal-soft px-2 py-0.5 text-xs text-teal">Ready</span></div>
          {[['Attendance', 94, '#1F9D8B'], ['Math', 82, '#F4A93B'], ['English', 76, '#3B7DD8'], ['Science', 69, '#E0475B']].map(([k, v, c]) => (
            <div key={k as string} className="mt-3">
              <div className="flex justify-between text-xs text-ink-soft"><span>{k}</span><span>{v}%</span></div>
              <div className="mt-1 h-2 rounded-full bg-ink/5"><div className="h-2 rounded-full" style={{ width: `${v}%`, background: c as string }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold">Sign in</h2>
          <p className="mt-2 text-ink-soft">Choose an account. Each one opens only the features that role is allowed to use.</p>
          <div className="mt-8 space-y-3">
            {DEMO_USERS.map(u => {
              const info = ROLE_INFO[u.role]
              return (
                <button key={u.id} onClick={() => login(u)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-ink hover:shadow-lg hover:shadow-ink/5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink/5 text-ink transition group-hover:bg-marigold"><info.icon size={22} /></span>
                  <span className="flex-1">
                    <span className="flex items-baseline gap-2"><span className="font-semibold">{info.label}</span><span className="text-sm text-ink-soft">{u.name}</span></span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{info.can}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-6 text-center text-xs text-ink-soft">Demo build: sample data, no password needed.</p>
        </div>
      </div>
    </div>
  )
}
