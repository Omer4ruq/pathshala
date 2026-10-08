import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import { StoreProvider, useStore } from './lib/store'
import { canSee } from './nav'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Notices from './pages/Notices'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import Classes from './pages/Classes'
import Attendance from './pages/Attendance'
import Exams from './pages/Exams'
import Results from './pages/Results'
import Reports from './pages/Reports'
import Finance from './pages/Finance'
import Fees from './pages/Fees'
import Salaries from './pages/Salaries'
import MyResults from './pages/MyResults'
import MyAttendance from './pages/MyAttendance'
import Library from './pages/Library'
import Tutor from './pages/Tutor'
import Settings from './pages/Settings'

/** Role gate: a page not in the user's nav redirects to their dashboard. */
function Guard({ el }: { el: ReactElement }) {
  const { user } = useStore()
  const { pathname } = useLocation()
  return canSee(user!.role, pathname) ? el : <Navigate to="/" replace />
}

const PAGES: [string, ReactElement][] = [
  ['/notices', <Notices />], ['/students', <Students />], ['/teachers', <Teachers />], ['/classes', <Classes />],
  ['/attendance', <Attendance />], ['/exams', <Exams />], ['/results', <Results />], ['/reports', <Reports />],
  ['/finance', <Finance />], ['/fees', <Fees />], ['/salaries', <Salaries />],
  ['/my/results', <MyResults />], ['/my/attendance', <MyAttendance />], ['/library', <Library />], ['/tutor', <Tutor />],
  ['/settings', <Settings />],
]

function Shell() {
  const { user } = useStore()
  if (!user) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        {PAGES.map(([path, el]) => <Route key={path} path={path} element={<Guard el={el} />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter><Shell /></HashRouter>
    </StoreProvider>
  )
}
