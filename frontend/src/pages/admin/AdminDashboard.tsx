import { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Users, AlertTriangle, CheckCircle,
  TrendingUp, Download, RefreshCw, Play
} from 'lucide-react'

interface OrgOverview {
  cycle_id: number
  total_employees: number
  goal_setting: { approved: number; submitted: number; not_started: number; completion_rate_pct: number }
  avg_progress_score: number | null
  open_escalations: number
}
interface Cycle { id: number; year: number; phase: string; is_active: boolean }

export default function AdminDashboard() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [overview, setOverview] = useState<OrgOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [runningEscalation, setRunningEscalation] = useState(false)

  useEffect(() => {
    api.get('/goals/cycles').then((r) => {
      const cs: Cycle[] = r.data
      setCycles(cs)
      const active = cs.find((c) => c.is_active) || cs[0]
      if (active) setSelectedCycle(active)
    })
  }, [])

  useEffect(() => {
    if (!selectedCycle) return
    setLoading(true)
    api.get(`/analytics/overview?cycle_id=${selectedCycle.id}`)
      .then((r) => setOverview(r.data))
      .catch(() => toast.error('Failed to load overview'))
      .finally(() => setLoading(false))
  }, [selectedCycle])

  const downloadReport = async (type: 'csv' | 'excel') => {
    if (!selectedCycle) return
    try {
      const res = await api.get(`/admin/reports/achievement/${type}?cycle_id=${selectedCycle.id}`, {
        responseType: 'blob'
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `achievement-report-${selectedCycle.year}-${selectedCycle.phase}.${type === 'csv' ? 'csv' : 'xlsx'}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  const runEscalation = async () => {
    setRunningEscalation(true)
    try {
      await api.post('/admin/escalation/run-now')
      toast.success('Escalation check completed')
    } catch {
      toast.error('Escalation run failed')
    } finally {
      setRunningEscalation(false)
    }
  }

  const ring = overview?.goal_setting.completion_rate_pct || 0

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 mt-0.5">Organisation-wide overview</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCycle?.id || ''}
            onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.year} {c.phase.toUpperCase()} {c.is_active ? '(Active)' : ''}</option>
            ))}
          </select>
          <button
            onClick={runEscalation}
            disabled={runningEscalation}
            className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {runningEscalation ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
            Run Escalations
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : overview ? (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Users size={18} className="text-blue-500" />
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Employees</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{overview.total_employees}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-green-500" />
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Approved Sheets</p>
              </div>
              <p className="text-3xl font-bold text-green-700">{overview.goal_setting.approved}</p>
              <p className="text-xs text-slate-400 mt-1">{overview.goal_setting.completion_rate_pct}% completion</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className="text-purple-500" />
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Avg Progress Score</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                {overview.avg_progress_score != null ? `${overview.avg_progress_score}%` : '—'}
              </p>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-500" />
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Open Escalations</p>
              </div>
              <p className="text-3xl font-bold text-red-600">{overview.open_escalations}</p>
            </div>
          </div>

          {/* Goal Setting Funnel */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="col-span-2 bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Goal Setting Progress</h2>
              <div className="space-y-3">
                <FunnelBar label="Approved" value={overview.goal_setting.approved} total={overview.total_employees} color="bg-green-500" />
                <FunnelBar label="Submitted (Pending)" value={overview.goal_setting.submitted} total={overview.total_employees} color="bg-amber-500" />
                <FunnelBar label="Not Started" value={overview.goal_setting.not_started} total={overview.total_employees} color="bg-slate-300" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Overall Completion Rate</span>
                  <span className="font-bold text-slate-800">{overview.goal_setting.completion_rate_pct}%</span>
                </div>
                <div className="mt-2 bg-slate-100 rounded-full h-3">
                  <div
                    className="h-3 bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${ring}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wider">Reports</h2>
              <div className="space-y-3">
                <button
                  onClick={() => downloadReport('csv')}
                  className="w-full flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <Download size={16} className="text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Achievement CSV</p>
                    <p className="text-xs text-slate-400">All employees, all goals</p>
                  </div>
                </button>
                <button
                  onClick={() => downloadReport('excel')}
                  className="w-full flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <Download size={16} className="text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Achievement Excel</p>
                    <p className="text-xs text-slate-400">Color-coded, BRD compliant</p>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    if (!selectedCycle) return
                    try {
                      const res = await api.get(`/admin/reports/completion/excel?cycle_id=${selectedCycle.id}`, { responseType: 'blob' })
                      const url = URL.createObjectURL(res.data)
                      const a = document.createElement('a'); a.href = url
                      a.download = `completion-${selectedCycle.year}.xlsx`; a.click()
                      URL.revokeObjectURL(url)
                      toast.success('Downloaded')
                    } catch { toast.error('Failed') }
                  }}
                  className="w-full flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors text-left"
                >
                  <Download size={16} className="text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Completion Excel</p>
                    <p className="text-xs text-slate-400">Department completion rates</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function FunnelBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-700">{value} ({pct}%)</span>
      </div>
      <div className="bg-slate-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
