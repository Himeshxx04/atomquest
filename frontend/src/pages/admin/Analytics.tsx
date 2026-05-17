import { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'

interface QoQPoint { quarter: string; avg_score: number | null; entries: number }
interface HeatmapRow { department: string; quarter: string; completion_pct: number }
interface DistributionData {
  by_thrust_area: { name: string; count: number; avg_weightage: number }[]
  by_uom_type: { uom_type: string; count: number }[]
  by_status: { status: string; count: number }[]
}
interface ManagerRow {
  manager_name: string; department: string; team_size: number;
  approval_rate_pct: number; avg_approval_days: number | null; checkin_comments_logged: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']
const STATUS_COLORS: Record<string, string> = {
  on_track: '#10b981', at_risk: '#f59e0b', behind: '#ef4444',
  completed: '#3b82f6', exceeded: '#8b5cf6'
}

export default function Analytics() {
  const [qoq, setQoq] = useState<QoQPoint[]>([])
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([])
  const [distribution, setDistribution] = useState<DistributionData | null>(null)
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [dept, setDept] = useState('')
  const [loading, setLoading] = useState(true)

  // Fetch the full (unfiltered) heatmap once for the department list
  const [allDepts, setAllDepts] = useState<string[]>([])
  useEffect(() => {
    api.get('/analytics/heatmap').then((r) => {
      const depts = [...new Set((r.data as HeatmapRow[]).map((row) => row.department))].sort()
      setAllDepts(depts)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const params = dept ? `?department=${encodeURIComponent(dept)}` : ''
    setLoading(true)
    Promise.all([
      api.get(`/analytics/qoq-trend${params}`),
      api.get(`/analytics/heatmap${params}`),
      api.get('/analytics/goal-distribution'),
      api.get('/analytics/manager-effectiveness'),
    ]).then(([q, h, d, m]) => {
      setQoq(q.data)
      setHeatmap(h.data)
      setDistribution(d.data)
      setManagers(m.data)
    }).catch(() => toast.error('Analytics load failed'))
    .finally(() => setLoading(false))
  }, [dept])

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Loading analytics…</div>

  return (
    <div style={{ minHeight: '100%', background: '#f8fafc', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Analytics</h1>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          style={{ padding: '10px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', outline: 'none', background: 'white', cursor: 'pointer' }}
        >
          <option value="">All Departments</option>
          {allDepts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div style={{ padding: '28px 40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* QoQ Trend */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>Quarter-on-Quarter Progress Score Trend</h2>
        {qoq.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No check-in data yet. Data appears after Q1–Q4 actuals are logged.</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={qoq}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
              <Line type="monotone" dataKey="avg_score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} name="Avg Score" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Heatmap */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>Completion Rate Heatmap (Dept × Quarter)</h2>
        {heatmap.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No data yet for heatmap.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <HeatmapTable data={heatmap} />
          </div>
        )}
      </div>

      {/* Goal Distribution */}
      {distribution && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>By Thrust Area</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distribution.by_thrust_area} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {distribution.by_thrust_area.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>By UoM Type</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={distribution.by_uom_type} dataKey="count" nameKey="uom_type" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(name as string).toUpperCase()} ${((percent as number) * 100).toFixed(0)}%`}>
                  {distribution.by_uom_type.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>By Achievement Status</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={distribution.by_status}>
                <XAxis dataKey="status" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.by_status.map((row, i) => (
                    <Cell key={i} fill={STATUS_COLORS[row.status] || COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Manager Effectiveness */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>Manager Effectiveness</h2>
        {managers.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No manager data available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Manager', 'Dept', 'Team Size', 'Approval Rate', 'Avg Days to Approve', 'Check-in Comments'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i <= 1 ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {managers.map((mgr, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#1e293b' }}>{mgr.manager_name}</td>
                    <td style={{ padding: '12px', color: '#64748b' }}>{mgr.department}</td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>{mgr.team_size}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: mgr.approval_rate_pct >= 80 ? '#16a34a' : mgr.approval_rate_pct >= 50 ? '#d97706' : '#dc2626' }}>
                        {mgr.approval_rate_pct}%
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>
                      {mgr.avg_approval_days != null ? `${mgr.avg_approval_days}d` : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', color: '#475569' }}>{mgr.checkin_comments_logged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

function HeatmapTable({ data }: { data: HeatmapRow[] }) {
  const departments = [...new Set(data.map((r) => r.department))]
  const quarters = [...new Set(data.map((r) => r.quarter))]
  const lookup = new Map(data.map((r) => [`${r.department}|${r.quarter}`, r.completion_pct]))

  const getHeatColor = (pct: number): { bg: string; text: string } => {
    if (pct >= 80) return { bg: '#16a34a', text: 'white' }
    if (pct >= 50) return { bg: '#f59e0b', text: 'white' }
    if (pct >= 20) return { bg: '#f97316', text: 'white' }
    return { bg: '#ef4444', text: 'white' }
  }

  const cellStyle = { padding: '8px 12px', border: '1px solid #e2e8f0', fontSize: '12px' }

  return (
    <table style={{ fontSize: '12px', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ ...cellStyle, textAlign: 'left', fontWeight: 600, color: '#64748b', background: '#f8fafc' }}>Department</th>
          {quarters.map((q) => (
            <th key={q} style={{ ...cellStyle, textAlign: 'center', fontWeight: 600, color: '#64748b', background: '#f8fafc', minWidth: '96px' }}>{q}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {departments.map((dept) => (
          <tr key={dept}>
            <td style={{ ...cellStyle, fontWeight: 600, color: '#374151', background: '#f8fafc' }}>{dept}</td>
            {quarters.map((q) => {
              const pct = lookup.get(`${dept}|${q}`)
              const hc = pct != null ? getHeatColor(pct) : null
              return (
                <td key={q} style={{ ...cellStyle, textAlign: 'center' }}>
                  {pct != null && hc ? (
                    <span style={{ display: 'inline-block', borderRadius: '6px', padding: '2px 8px', fontWeight: 700, background: hc.bg, color: hc.text }}>
                      {pct}%
                    </span>
                  ) : (
                    <span style={{ color: '#cbd5e1' }}>—</span>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
