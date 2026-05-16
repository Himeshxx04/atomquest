import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { Target, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const DEMO_CREDENTIALS = [
  { role: 'Employee', email: 'alice@atomquest.com', password: 'Password123!' },
  { role: 'Manager', email: 'bob@atomquest.com', password: 'Password123!' },
  { role: 'Admin', email: 'carol@atomquest.com', password: 'Password123!' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      const role = useAuthStore.getState().user?.role
      navigate(`/${role}`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (cred: typeof DEMO_CREDENTIALS[0]) => {
    setLoading(true)
    try {
      await login(cred.email, cred.password)
      const role = useAuthStore.getState().user?.role
      navigate(`/${role}`)
    } catch {
      toast.error('Demo login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Target size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AtomQuest</h1>
          <p className="text-slate-400 mt-1">Goal Setting & Tracking Portal</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 pr-10"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3 text-slate-400"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Demo quick-login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs text-slate-500 bg-white px-2">
                Demo — one-click access
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {DEMO_CREDENTIALS.map((cred) => (
                <button
                  key={cred.role}
                  onClick={() => quickLogin(cred)}
                  disabled={loading}
                  className="flex flex-col items-center py-3 px-2 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-lg">
                    {cred.role === 'Employee' ? '👤' : cred.role === 'Manager' ? '👔' : '🛡️'}
                  </span>
                  <span className="text-xs font-medium text-slate-700 mt-1">{cred.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          AtomQuest Hackathon 1.0 · Built with FastAPI + React
        </p>
      </div>
    </div>
  )
}
