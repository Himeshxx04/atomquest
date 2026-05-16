import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { Eye, EyeOff, Zap, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

const DEMO_CREDENTIALS = [
  {
    role: 'Employee',
    email: 'employee@demo.com',
    password: 'Employee@123',
    emoji: '👤',
    color: 'from-emerald-500 to-teal-600',
    bg: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100',
    badge: 'bg-emerald-100 text-emerald-700',
    desc: 'Set goals, log actuals',
  },
  {
    role: 'Manager',
    email: 'manager@demo.com',
    password: 'Manager@123',
    emoji: '👔',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100',
    badge: 'bg-blue-100 text-blue-700',
    desc: 'Approve & review team',
  },
  {
    role: 'Admin',
    email: 'admin@demo.com',
    password: 'Admin@123',
    emoji: '🛡️',
    color: 'from-purple-500 to-violet-600',
    bg: 'bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-100',
    badge: 'bg-purple-100 text-purple-700',
    desc: 'Org config & analytics',
  },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const doLogin = async (e: string, p: string, tag: string) => {
    setLoading(tag)
    try {
      await login(e, p)
      const role = useAuthStore.getState().user?.role
      toast.success(`Signed in as ${role}`)
      navigate(`/${role}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doLogin(email, password, 'form')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Zap size={22} className="text-white" />
          </div>
          <span className="text-white text-2xl font-bold tracking-tight">GoalFlow</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h1 className="text-white text-4xl font-bold leading-snug mb-4">
            Set goals.<br />Track progress.<br />
            <span className="text-blue-400">Win together.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            The complete goal-setting and performance tracking portal — from goal creation to quarterly check-ins to final appraisal.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {['BRD-compliant workflows', 'Role-based access', 'Live analytics', 'Excel reports', 'Email alerts'].map((f) => (
              <span key={f} className="text-xs bg-white/10 text-slate-300 px-3 py-1.5 rounded-full border border-white/10">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-slate-600 text-xs">
          Built for AtomQuest Hackathon 1.0
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-slate-900 text-xl font-bold">GoalFlow</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
          <p className="text-slate-500 mb-8">Sign in to your GoalFlow workspace</p>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Work Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-sm"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all shadow-sm pr-12"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              {loading === 'form' ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</span>
              ) : (
                <><ArrowRight size={18} /> Sign In</>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="text-xs text-slate-400 bg-slate-50 px-3">or jump in as a demo user</span>
            </div>
          </div>

          {/* Demo cards */}
          <div className="space-y-3">
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.role}
                onClick={() => doLogin(cred.email, cred.password, cred.role)}
                disabled={loading !== null}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] ${cred.bg}`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${cred.color} flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>
                  {loading === cred.role
                    ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                    : cred.emoji
                  }
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-slate-800 text-sm">{cred.role}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cred.badge}`}>{cred.role}</span>
                  </div>
                  <p className="text-xs text-slate-500">{cred.desc}</p>
                </div>
                <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            GoalFlow · Built with FastAPI + React + PostgreSQL
          </p>
        </div>
      </div>
    </div>
  )
}
