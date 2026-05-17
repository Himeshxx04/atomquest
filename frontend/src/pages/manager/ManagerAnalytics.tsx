import { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { TrendingUp, Target } from 'lucide-react'

interface QoQPoint { quarter: string; avg_score: number | null; entries: number }

export default function ManagerAnalytics() {
  const { user } = useAuthStore()
  const [qoq, setQoq] = useState<QoQPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dept = user?.department
    const params = dept ? `?department=${encodeURIComponent(dept)}` : ''
    api.get(`/analytics/qoq-trend${params}`)
      .then((r) => setQoq(r.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <div style={{ minHeight: '100%', background: '#f8fafc', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Department Analytics</h1>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>{user?.department} — Quarter-on-Quarter trend</p>
      </div>

      <div style={{ padding: '32px 40px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>Loading…</div>
        ) : (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <TrendingUp size={18} color="#3b82f6" />
              <h2 style={{ fontWeight: 700, color: '#374151', fontSize: '15px', margin: 0 }}>Average Progress Score by Quarter</h2>
            </div>
            {qoq.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Target size={40} color="#cbd5e1" style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ color: '#94a3b8', margin: '0 0 4px' }}>No check-in data yet.</p>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Data appears after team members log quarterly actuals.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={qoq}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
                  <Line type="monotone" dataKey="avg_score" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 5 }} name="Avg Score" />
                </LineChart>
              </ResponsiveContainer>
            )}
            {qoq.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                {qoq.map((p) => (
                  <div key={p.quarter} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 4px' }}>{p.quarter}</p>
                    <p style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{p.avg_score != null ? `${p.avg_score}%` : '—'}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{p.entries} entries</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
