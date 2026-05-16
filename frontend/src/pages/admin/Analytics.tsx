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

  useEffect(() => {
    const params = dept ? `?department=${encodeURIComponent(dept)}` : ''
    setLoading(true)
    Promise.all([
      api.get(`/analytics/qoq-trend${params}`),
      api.get('/analytics/heatmap'),
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

  const departments = [...new Set(heatmap.map((r) => r.department))]

  if (loading) return <div className="p-6 text-center text-slate-400 py-16">Loading analytics…</div>

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* QoQ Trend */}
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Quarter-on-Quarter Progress Score Trend</h2>
        {qoq.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No check-in data yet. Data appears after Q1–Q4 actuals are logged.</p>
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
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Completion Rate Heatmap (Dept × Quarter)</h2>
        {heatmap.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No data yet for heatmap.</p>
        ) : (
          <div className="overflow-x-auto">
            <HeatmapTable data={heatmap} />
          </div>
        )}
      </div>

      {/* Goal Distribution */}
      {distribution && (
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">By Thrust Area</h2>
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

          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">By UoM Type</h2>
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

          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">By Achievement Status</h2>
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
      <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Manager Effectiveness</h2>
        {managers.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">No manager data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Manager</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dept</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Size</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Approval Rate</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Days to Approve</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Check-in Comments</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((mgr, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-800">{mgr.manager_name}</td>
                    <td className="py-3 px-3 text-slate-500">{mgr.department}</td>
                    <td className="py-3 px-3 text-center text-slate-600">{mgr.team_size}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`font-semibold ${mgr.approval_rate_pct >= 80 ? 'text-green-600' : mgr.approval_rate_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {mgr.approval_rate_pct}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600">
                      {mgr.avg_approval_days != null ? `${mgr.avg_approval_days}d` : '—'}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600">{mgr.checkin_comments_logged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function HeatmapTable({ data }: { data: HeatmapRow[] }) {
  const departments = [...new Set(data.map((r) => r.department))]
  const quarters = [...new Set(data.map((r) => r.quarter))]
  const lookup = new Map(data.map((r) => [`${r.department}|${r.quarter}`, r.completion_pct]))

  const getColor = (pct: number) => {
    if (pct >= 80) return 'bg-green-500 text-white'
    if (pct >= 50) return 'bg-amber-400 text-white'
    if (pct >= 20) return 'bg-orange-400 text-white'
    return 'bg-red-400 text-white'
  }

  return (
    <table className="text-xs border-collapse">
      <thead>
        <tr>
          <th className="py-2 px-3 text-left font-medium text-slate-500 bg-slate-50 border border-slate-200">Department</th>
          {quarters.map((q) => (
            <th key={q} className="py-2 px-3 text-center font-medium text-slate-500 bg-slate-50 border border-slate-200 min-w-24">{q}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {departments.map((dept) => (
          <tr key={dept}>
            <td className="py-2 px-3 font-medium text-slate-700 border border-slate-200 bg-slate-50">{dept}</td>
            {quarters.map((q) => {
              const pct = lookup.get(`${dept}|${q}`)
              return (
                <td key={q} className="py-2 px-3 text-center border border-slate-200">
                  {pct != null ? (
                    <span className={`inline-block rounded px-2 py-0.5 font-semibold ${getColor(pct)}`}>
                      {pct}%
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
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
