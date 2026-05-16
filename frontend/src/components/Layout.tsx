import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import {
  Target, BarChart3, Users, Settings, LogOut,
  LayoutDashboard, CheckSquare, TrendingUp, Shield, Zap,
  ChevronRight
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

const ROLE_META = {
  employee: { color: 'bg-emerald-500', label: 'Employee', gradient: 'from-emerald-500 to-teal-600' },
  manager:  { color: 'bg-blue-500',    label: 'Manager',  gradient: 'from-blue-500 to-indigo-600' },
  admin:    { color: 'bg-purple-500',  label: 'Admin',    gradient: 'from-purple-500 to-violet-600' },
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout, demoSwitch } = useAuthStore()
  const location = useLocation()

  const links =
    user?.role === 'admin' ? adminLinks :
    user?.role === 'manager' ? managerLinks : employeeLinks

  const meta = ROLE_META[user?.role || 'employee']

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f0f4f8' }}>
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#0f172a' }}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-base tracking-tight">GoalFlow</p>
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">Goal Tracking Portal</p>
            </div>
          </div>
        </div>

        {/* User card */}
        <div className="mx-3 my-3 rounded-xl p-3" style={{ backgroundColor: '#1e293b' }}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-medium truncate leading-tight">{user?.name}</p>
              <p className="text-slate-400 text-xs truncate">{user?.department || meta.label}</p>
            </div>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
              user?.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
              user?.role === 'manager' ? 'bg-blue-500/20 text-blue-400' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>{user?.role?.slice(0, 3)}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto py-1">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1 pt-2">Navigation</p>
          {links.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all group ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={15} className={active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={12} className="text-white/60" />}
              </Link>
            )
          })}
        </nav>

        {/* Demo switcher */}
        <div className="px-3 pb-3">
          <div className="rounded-xl p-3" style={{ backgroundColor: '#1e293b' }}>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Demo — Switch Role</p>
            <div className="grid grid-cols-3 gap-1">
              {(['employee', 'manager', 'admin'] as const).map((r) => {
                const rm = ROLE_META[r]
                const isActive = user?.role === r
                return (
                  <button
                    key={r}
                    onClick={() => demoSwitch(r)}
                    className={`py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                      isActive
                        ? `bg-gradient-to-br ${rm.gradient} text-white shadow-sm`
                        : 'text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {r === 'employee' ? 'Emp' : r === 'manager' ? 'Mgr' : 'Adm'}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg text-sm transition-all"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
