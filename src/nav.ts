import { Banknote, BookOpen, Bot, CalendarCheck, ClipboardList, FileBarChart, GraduationCap, HandCoins, LayoutDashboard, Megaphone, School, Settings, Trophy, UserSquare2, Wallet, LineChart, CalendarDays } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './lib/data'

export interface NavItem { to: string; label: string; icon: LucideIcon; roles: Role[]; group: string; keywords?: string }

const ADMIN: Role = 'super_admin'
// Order here = order in the sidebar. `keywords` feed the ⌘K search so people find features by what they want to do.
export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: [ADMIN, 'teacher', 'accountant', 'student'], group: 'Overview', keywords: 'home summary' },
  { to: '/notices', label: 'Notice board', icon: Megaphone, roles: [ADMIN, 'teacher', 'accountant', 'student'], group: 'Overview', keywords: 'announcement news circular' },

  { to: '/students', label: 'Students', icon: GraduationCap, roles: [ADMIN], group: 'People', keywords: 'add student admission excel bulk import update' },
  { to: '/teachers', label: 'Teachers', icon: UserSquare2, roles: [ADMIN], group: 'People', keywords: 'add teacher staff excel bulk import' },
  { to: '/classes', label: 'Classes & sections', icon: School, roles: [ADMIN], group: 'People', keywords: 'assign teacher shift section class teacher' },

  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: [ADMIN, 'teacher'], group: 'Teaching', keywords: 'take attendance present absent roll call' },
  { to: '/exams', label: 'Tests & exams', icon: ClipboardList, roles: [ADMIN, 'teacher'], group: 'Teaching', keywords: 'class test mid term final marks entry' },
  { to: '/results', label: 'Results & marksheets', icon: Trophy, roles: [ADMIN, 'teacher'], group: 'Teaching', keywords: 'marksheet gpa grade download pdf average attendance weight' },
  { to: '/reports', label: 'Weekly & monthly reports', icon: FileBarChart, roles: [ADMIN, 'teacher'], group: 'Teaching', keywords: 'weekly report monthly report progress at risk' },

  { to: '/finance', label: 'Finance overview', icon: Wallet, roles: [ADMIN, 'accountant'], group: 'Accounts', keywords: 'income expense accounting balance' },
  { to: '/fees', label: 'Student fees', icon: HandCoins, roles: [ADMIN, 'accountant'], group: 'Accounts', keywords: 'collect fee due receipt invoice bkash' },
  { to: '/salaries', label: 'Teacher salaries', icon: Banknote, roles: [ADMIN, 'accountant'], group: 'Accounts', keywords: 'pay salary payroll' },

  { to: '/my/results', label: 'My results', icon: LineChart, roles: ['student'], group: 'My school', keywords: 'marksheet grade performance' },
  { to: '/my/attendance', label: 'My attendance', icon: CalendarDays, roles: ['student'], group: 'My school', keywords: 'present absent' },
  { to: '/library', label: 'Books & PDFs', icon: BookOpen, roles: [ADMIN, 'teacher', 'student'], group: 'My school', keywords: 'textbook pdf library' },
  { to: '/tutor', label: 'AI tutor', icon: Bot, roles: [ADMIN, 'student'], group: 'My school', keywords: 'ask question help homework ai' },

  { to: '/settings', label: 'Settings', icon: Settings, roles: [ADMIN], group: 'System', keywords: 'grading weights reset demo data' },
]

export const navFor = (role: Role) => NAV.filter(n => n.roles.includes(role))
export const canSee = (role: Role, path: string) => navFor(role).some(n => n.to === path)
