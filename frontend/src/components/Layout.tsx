import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import {
  Target, BarChart3, Users, Settings, LogOut,
  LayoutDashboard, CheckSquare, TrendingUp, Shield
} from 'lucide-react'

interface LayoutProps { children: ReactNode }

const employeeLinks = [
  { to: '/employee', label: 'My Goals', icon: Target },
]
const managerLinks = [
  { to: '/manager', label: 'Team Overview', icon: LayoutDashboard },
  { to: '/manager/approvals', label: 'Approvals', icon: CheckSquare },
  { to: '/manager/analytics', label: 'Analytics', icon: TrendingUp },
]
const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/cycles', label: 'Cycles', icon: Settings },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit Log', icon: Shield },
]

export default function Layout({ children }: LayoutProps) {
  const { user, logout, demoSwitch } = useAuthStore()
  const location = useLocation()

  const links =
    user?.role === 'admin' ? adminLinks :
    user?.role === 'manager' ? managerLinks : employeeLinks

  const roleColor =
    user?.role === 'admin' ? 'bg-purple-600' :
    user?.role === 'manager' ? 'bg-blue-600' : 'bg-emerald-600'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-white flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Target size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">AtomQuest</p>
              <p className="text-xs text-slate-400">Goal Tracker</p>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full ${roleColor} flex items-center justify-center text-sm font-bold`}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Demo role switcher */}
        <div className="p-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Demo: Switch Role</p>
          <div className="flex gap-1">
            {(['employee', 'manager', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => demoSwitch(r)}
                className={`flex-1 text-xs py-1 rounded capitalize transition-colors ${
                  user?.role === r
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {r === 'employee' ? 'Emp' : r === 'manager' ? 'Mgr' : 'Adm'}
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm w-full px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
