import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/auth'
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { PublicClientApplication } from '@azure/msal-browser'

const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || ''
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || ''

const msalInstance = AZURE_CLIENT_ID ? new PublicClientApplication({
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/common`,  // accepts any Microsoft/personal account
    // Send the auth code directly back to /login.
    // sessionStorage survives same-tab navigation (not popup), so MSAL
    // finds the PKCE verifier when /login reloads after Microsoft redirects back.
    redirectUri: `${window.location.origin}/login`,
  },
  cache: { cacheLocation: 'sessionStorage' },
}) : null

// Initialize MSAL exactly once at module level.
const msalReady: Promise<void> = msalInstance
  ? msalInstance.initialize()
  : Promise.resolve()

const DEMOS = [
  { role: 'Employee', email: 'employee@demo.com', password: 'Employee@123', icon: '👤', color: '#10b981', light: '#ecfdf5', desc: 'Set goals · log actuals · view progress' },
  { role: 'Manager',  email: 'manager@demo.com',  password: 'Manager@123',  icon: '👔', color: '#3b82f6', light: '#eff6ff', desc: 'Approve sheets · check-in comments' },
  { role: 'Admin',    email: 'admin@demo.com',     password: 'Admin@123',   icon: '🛡️', color: '#8b5cf6', light: '#f5f3ff', desc: 'Org config · analytics · reports' },
]

export default function Login() {
  const [email, setEmail]   = useState('')
  const [password, setPass] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const { login } = useAuthStore()

  useEffect(() => {
    // Handle Microsoft redirect response — runs when /login reloads after OAuth redirect
    if (msalInstance) {
      msalReady.then(async () => {
        const result = await msalInstance.handleRedirectPromise().catch(() => null)
        if (result) {
          setLoading('azure')
          try {
            await useAuthStore.getState().loginWithAzure(result.idToken, result.accessToken ?? undefined)
            const role = useAuthStore.getState().user?.role
            toast.success(`Signed in via Microsoft as ${role}`)
            window.location.href = `/${role}`
          } catch (err: any) {
            toast.error(err?.response?.data?.detail || err?.message || 'Sign-in failed')
            setLoading(null)
          }
        }
      })
    }

    // Dev shortcut: /login?as=admin  /login?as=manager  /login?as=employee
    const role = new URLSearchParams(window.location.search).get('as')
    const demo = DEMOS.find(d => d.role.toLowerCase() === (role || '').toLowerCase())
    if (demo) doLogin(demo.email, demo.password, demo.role)
  }, []) // eslint-disable-line

  const doAzureLogin = async () => {
    if (!msalInstance) return
    setLoading('azure')
    try {
      await msalReady
      // Full-page redirect — Microsoft redirects back to /login with the auth code.
      // sessionStorage is intact on return (same tab), so MSAL finds the PKCE verifier.
      await msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        prompt: 'select_account',   // always show account picker, never silent-login
      })
      // Page navigates away — nothing below this runs.
    } catch (err: any) {
      toast.error(err?.message || 'Microsoft sign-in failed')
      setLoading(null)
    }
  }

  const doLogin = async (e: string, p: string, tag: string) => {
    setLoading(tag)
    try {
      await login(e, p)
      const role = useAuthStore.getState().user?.role
      if (!role) throw new Error('Could not determine role')
      toast.success(`Signed in as ${role}`)
      // Full page redirect — ensures ProtectedRoute sees the persisted token on load
      window.location.href = `/${role}`
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
      setLoading(null)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Left: Brand panel ── */}
      <div style={{
        width: '46%', minHeight: '100vh', flexShrink: 0,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex', flexDirection: 'column', padding: '56px 64px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', background: 'rgba(59,130,246,0.12)', borderRadius: '50%', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '240px', height: '240px', background: 'rgba(139,92,246,0.10)', borderRadius: '50%', filter: 'blur(60px)' }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '44px', height: '44px', background: '#3b82f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(59,130,246,0.40)' }}>
            <Zap size={22} color="white" />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: '22px', letterSpacing: '-0.5px' }}>GoalFlow</div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '1px' }}>Goal Tracking Portal</div>
          </div>
        </div>

        {/* Main copy */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ color: 'white', fontSize: '48px', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-1.5px', marginBottom: '20px' }}>
            Set goals.<br />
            Track progress.<br />
            <span style={{ color: '#60a5fa' }}>Win together.</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '17px', lineHeight: 1.65, maxWidth: '400px', marginBottom: '36px' }}>
            The complete goal-setting and performance tracking portal — from creation to quarterly check-ins to final appraisal.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['BRD-compliant workflows', 'Role-based access', 'Live analytics', 'Excel reports', 'Email alerts', 'SSO ready'].map((f) => (
              <span key={f} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '100px', background: 'rgba(255,255,255,0.07)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.10)', fontWeight: 500 }}>{f}</span>
            ))}
          </div>
        </div>

        <p style={{ color: '#334155', fontSize: '12px', position: 'relative', zIndex: 1 }}>Built for AtomQuest Hackathon 1.0</p>
      </div>

      {/* ── Right: Login form ── */}
      <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '6px', letterSpacing: '-0.5px' }}>Welcome back</h2>
          <p style={{ color: '#64748b', fontSize: '15px', marginBottom: '32px' }}>Sign in to your GoalFlow workspace</p>

          {/* Form */}
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Work Email</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#f8fafc', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '12px 44px 12px 16px', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '14px', color: '#0f172a', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  onKeyDown={(e) => e.key === 'Enter' && email && password && doLogin(email, password, 'form')}
                />
                <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              onClick={() => email && password && doLogin(email, password, 'form')}
              disabled={loading !== null || !email || !password}
              style={{ width: '100%', padding: '13px', background: loading === 'form' ? '#2563eb' : '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: loading !== null ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(59,130,246,0.35)', transition: 'all 0.15s', opacity: loading !== null && loading !== 'form' ? 0.6 : 1 }}
            >
              {loading === 'form' ? (
                <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Signing in…</>
              ) : (
                <><ArrowRight size={18} /> Sign In</>
              )}
            </button>
          </div>

          {/* Microsoft SSO button */}
          <div style={{ position: 'relative', marginBottom: '20px', marginTop: '10px' }}>
            <button
              onClick={doAzureLogin}
              disabled={loading !== null || !msalInstance}
              title={!msalInstance ? 'Azure AD SSO — requires enterprise configuration (VITE_AZURE_CLIENT_ID)' : 'Sign in with your Microsoft work account'}
              style={{
                width: '100%', padding: '12px', background: msalInstance ? 'white' : '#f8fafc',
                color: msalInstance ? '#0f172a' : '#94a3b8',
                border: `1.5px solid ${msalInstance ? '#e2e8f0' : '#f1f5f9'}`,
                borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                cursor: (!msalInstance || loading !== null) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: msalInstance ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s',
                opacity: (loading !== null && loading !== 'azure') ? 0.6 : 1,
              }}
              onMouseEnter={(e) => { if (msalInstance && !loading) (e.currentTarget as HTMLElement).style.borderColor = '#0078d4' }}
              onMouseLeave={(e) => { if (msalInstance && !loading) (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0' }}
            >
              {loading === 'azure' ? (
                <><span style={{ width: '16px', height: '16px', border: '2px solid #0078d430', borderTopColor: '#0078d4', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Signing in…</>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ opacity: msalInstance ? 1 : 0.4 }}>
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                  Sign in with Microsoft {!msalInstance && <span style={{ fontSize: '11px', color: '#cbd5e1' }}>(enterprise)</span>}
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>or jump in as a demo user</span>
            <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
          </div>

          {/* Demo cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DEMOS.map((d) => (
              <button
                key={d.role}
                onClick={() => doLogin(d.email, d.password, d.role)}
                disabled={loading !== null}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px',
                  background: 'white', border: `1.5px solid ${loading === d.role ? d.color : '#e2e8f0'}`,
                  borderRadius: '14px', cursor: loading !== null ? 'not-allowed' : 'pointer',
                  textAlign: 'left', transition: 'all 0.15s', opacity: loading !== null && loading !== d.role ? 0.6 : 1,
                  boxShadow: loading === d.role ? `0 0 0 3px ${d.color}25` : '0 1px 4px rgba(0,0,0,0.04)',
                }}
                onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = d.color; (e.currentTarget as HTMLElement).style.background = d.light } }}
                onMouseLeave={(e) => { if (!loading) { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.background = 'white' } }}
              >
                <div style={{ width: '44px', height: '44px', background: d.light, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0, border: `1px solid ${d.color}30` }}>
                  {loading === d.role
                    ? <span style={{ width: '18px', height: '18px', border: `2px solid ${d.color}40`, borderTopColor: d.color, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    : d.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{d.role}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: d.light, color: d.color }}>{d.role}</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{d.desc}</p>
                </div>
                <ArrowRight size={16} color="#cbd5e1" />
              </button>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '28px' }}>
            GoalFlow · FastAPI + React + PostgreSQL
          </p>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
