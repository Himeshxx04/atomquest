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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Department Analytics</h1>
        <p className="text-slate-500 mt-0.5">{user?.department} — Quarter-on-Quarter trend</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-blue-500" />
            <h2 className="font-semibold text-slate-700">Average Progress Score by Quarter</h2>
          </div>
          {qoq.length === 0 ? (
            <div className="text-center py-12">
              <Target size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-slate-400">No check-in data yet.</p>
              <p className="text-slate-400 text-sm">Data appears after team members log quarterly actuals.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={qoq}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, 'Avg Score']} />
                <Line
                  type="monotone"
                  dataKey="avg_score"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ fill: '#3b82f6', r: 5 }}
                  name="Avg Score"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          {qoq.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
              {qoq.map((p) => (
                <div key={p.quarter} className="text-center">
                  <p className="text-xs text-slate-400">{p.quarter}</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">
                    {p.avg_score != null ? `${p.avg_score}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-400">{p.entries} entries</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
