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

const ROLE_GRADIENTS: Record<string, string> = {
  employee: 'linear-gradient(135deg,#34d399,#14b8a6)',
  manager:  'linear-gradient(135deg,#60a5fa,#6366f1)',
  admin:    'linear-gradient(135deg,#a78bfa,#8b5cf6)',
}
const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  employee: { bg: 'rgba(52,211,153,0.15)',  color: '#34d399' },
  manager:  { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
  admin:    { bg: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
}
const DEMO_ROLES = [
  { key: 'employee' as const, label: 'Employee', activeBg: '#10b981' },
  { key: 'manager'  as const, label: 'Manager',  activeBg: '#3b82f6' },
  { key: 'admin'    as const, label: 'Admin',    activeBg: '#8b5cf6' },
]

export default function Layout({ children }: LayoutProps) {
  const { user, logout, demoSwitch } = useAuthStore()
  const location = useLocation()

  const links =
    user?.role === 'admin'   ? adminLinks :
    user?.role === 'manager' ? managerLinks : employeeLinks

  const roleKey = (user?.role ?? 'employee') as keyof typeof ROLE_BADGE
  const badge = ROLE_BADGE[roleKey] || ROLE_BADGE.employee

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f172a', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)', background: '#0f172a' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(59,130,246,0.4)' }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <p style={{ color: 'white', fontWeight: 800, fontSize: '15px', margin: 0, lineHeight: 1 }}>GoalFlow</p>
            <p style={{ color: '#475569', fontSize: '11px', margin: '3px 0 0' }}>Tracking Portal</p>
          </div>
        </div>

        {/* User card */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: ROLE_GRADIENTS[roleKey] || ROLE_GRADIENTS.employee, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'white', fontSize: '13px', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.department ?? roleKey}</p>
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, background: badge.bg, color: badge.color }}>
              {user?.role?.slice(0, 3)}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {links.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to} to={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: '10px', fontSize: '13px',
                  fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? 'white' : '#64748b',
                  boxShadow: active ? '0 4px 12px rgba(37,99,235,0.3)' : 'none',
                }}
              >
                <Icon size={15} color={active ? 'white' : '#475569'} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Demo role switcher — only shown for demo accounts */}
        {user?.email?.endsWith('@demo.com') && (
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Demo Role</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {DEMO_ROLES.map(({ key, label, activeBg }) => {
                const isActive = user?.role === key
                return (
                  <button
                    key={key}
                    onClick={() => demoSwitch(key)}
                    style={{
                      padding: '6px 4px', borderRadius: '8px', fontSize: '11px',
                      fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: isActive ? activeBg : 'transparent',
                      color: isActive ? 'white' : '#475569',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        )}

        {/* Sign out */}
        <div style={{ padding: '0 16px 20px' }}>
          <button
            onClick={logout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', color: '#475569', background: 'transparent', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#f87171'; el.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.color = '#475569'; el.style.background = 'transparent' }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
