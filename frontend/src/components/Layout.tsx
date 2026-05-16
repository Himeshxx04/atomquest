import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import {
  BarChart3, Users, Settings, LogOut,
  LayoutDashboard, CheckSquare, TrendingUp, Shield, Zap,
  Target
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
  employee: { gradient: 'from-emerald-400 to-teal-500',   ring: 'ring-emerald-500/30', label: 'Employee' },
  manager:  { gradient: 'from-blue-400 to-indigo-500',    ring: 'ring-blue-500/30',    label: 'Manager'  },
  admin:    { gradient: 'from-purple-400 to-violet-500',  ring: 'ring-purple-500/30',  label: 'Admin'    },
}

const DEMO_ROLES = [
  { key: 'employee' as const, short: 'Employee', color: 'hover:bg-emerald-500/20 data-[active=true]:bg-emerald-500 data-[active=true]:text-white text-slate-400' },
  { key: 'manager'  as const, short: 'Manager',  color: 'hover:bg-blue-500/20 data-[active=true]:bg-blue-500 data-[active=true]:text-white text-slate-400' },
  { key: 'admin'    as const, short: 'Admin',    color: 'hover:bg-purple-500/20 data-[active=true]:bg-purple-500 data-[active=true]:text-white text-slate-400' },
]

export default function Layout({ children }: LayoutProps) {
  const { user, logout, demoSwitch } = useAuthStore()
  const location = useLocation()

  const links =
    user?.role === 'admin'   ? adminLinks :
    user?.role === 'manager' ? managerLinks : employeeLinks

  const meta = ROLE_META[user?.role ?? 'employee']

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0f172a' }}>
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/5" style={{ background: '#0f172a' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/40 flex-shrink-0">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">GoalFlow</p>
            <p className="text-slate-500 text-[11px] mt-0.5">Tracking Portal</p>
          </div>
        </div>

        {/* User */}
        <div className="px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.gradient} ring-2 ${meta.ring} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm font-semibold truncate leading-none">{user?.name}</p>
              <p className="text-slate-400 text-xs mt-1 truncate">{user?.department ?? meta.label}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider flex-shrink-0 ${
              user?.role === 'admin'   ? 'bg-purple-500/20 text-purple-300' :
              user?.role === 'manager' ? 'bg-blue-500/20 text-blue-300' :
                                        'bg-emerald-500/20 text-emerald-300'
            }`}>
              {user?.role?.slice(0, 3)}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {links.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/8'
                }`}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-slate-500'} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Demo switcher */}
        <div className="px-4 pb-2">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2.5">Demo Role</p>
            <div className="grid grid-cols-3 gap-1.5">
              {DEMO_ROLES.map(({ key, short }) => (
                <button
                  key={key}
                  onClick={() => demoSwitch(key)}
                  data-active={user?.role === key}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-semibold transition-all ${
                    user?.role === key
                      ? key === 'employee' ? 'bg-emerald-500 text-white'
                        : key === 'manager' ? 'bg-blue-500 text-white'
                        : 'bg-purple-500 text-white'
                      : 'text-slate-500 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {short}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="px-4 pb-5 pt-1">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-all"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {children}
      </main>
    </div>
  )
}
