import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Users, AlertTriangle, CheckCircle,
  TrendingUp, Download, RefreshCw, Play, FileSpreadsheet, FileText
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
  const [downloading, setDownloading] = useState<string | null>(null)

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

  const download = async (url: string, filename: string, tag: string) => {
    setDownloading(tag)
    try {
      const res = await api.get(url, { responseType: 'blob' })
      const blobUrl = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
      toast.success('Report downloaded')
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloading(null)
    }
  }

  const runEscalation = async () => {
    setRunningEscalation(true)
    try {
      await api.post('/admin/escalation/run-now')
      toast.success('Escalation checks completed')
    } catch {
      toast.error('Escalation run failed')
    } finally {
      setRunningEscalation(false)
    }
  }

  const pct = overview?.goal_setting.completion_rate_pct || 0
  const total = overview?.total_employees || 1

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Organisation-wide KPIs and controls</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCycle?.id || ''}
            onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-sm"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.year} {c.phase.replace('_', ' ').toUpperCase()} {c.is_active ? '✦ Active' : ''}</option>
            ))}
          </select>
          <button
            onClick={runEscalation}
            disabled={runningEscalation}
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-amber-600 disabled:opacity-50 transition-all shadow-lg shadow-amber-500/20 font-medium"
          >
            {runningEscalation ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            Run Escalations
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : overview ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <KpiCard
              icon={<Users size={20} />}
              label="Total Employees"
              value={overview.total_employees}
              sub="active users"
              color="blue"
            />
            <KpiCard
              icon={<CheckCircle size={20} />}
              label="Approved Sheets"
              value={overview.goal_setting.approved}
              sub={`${pct}% of org`}
              color="emerald"
            />
            <KpiCard
              icon={<TrendingUp size={20} />}
              label="Avg Progress Score"
              value={overview.avg_progress_score != null ? `${overview.avg_progress_score}%` : '—'}
              sub="across all check-ins"
              color="purple"
            />
            <KpiCard
              icon={<AlertTriangle size={20} />}
              label="Open Escalations"
              value={overview.open_escalations}
              sub="unresolved alerts"
              color={overview.open_escalations > 0 ? 'red' : 'slate'}
            />
          </div>

          {/* Middle row: funnel + reports */}
          <div className="grid grid-cols-3 gap-5 mb-6">
            {/* Goal Setting Funnel */}
            <div className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-slate-800">Goal Setting Progress</h2>
                <span className="text-xs text-slate-400">{selectedCycle?.year} {selectedCycle?.phase.replace('_', ' ').toUpperCase()}</span>
              </div>

              <div className="space-y-4">
                <FunnelRow label="Approved" value={overview.goal_setting.approved} total={total} color="bg-emerald-500" textColor="text-emerald-700" />
                <FunnelRow label="Submitted — Pending Review" value={overview.goal_setting.submitted} total={total} color="bg-amber-400" textColor="text-amber-700" />
                <FunnelRow label="Not Started" value={Math.max(0, overview.goal_setting.not_started)} total={total} color="bg-slate-300" textColor="text-slate-600" />
              </div>

              {/* Completion gauge */}
              <div className="mt-5 pt-5 border-t border-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600 font-medium">Overall Completion Rate</span>
                  <span className="text-2xl font-bold text-slate-800">{pct}%</span>
                </div>
                <div className="bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-3 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Reports */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h2 className="font-semibold text-slate-800 mb-4">Download Reports</h2>
              <div className="space-y-2.5">
                <ReportButton
                  icon={<FileText size={16} className="text-blue-500" />}
                  label="Achievement CSV"
                  sub="All employees, all goals"
                  loading={downloading === 'csv'}
                  onClick={() => download(
                    `/admin/reports/achievement/csv?cycle_id=${selectedCycle?.id}`,
                    `achievement-${selectedCycle?.year}-${selectedCycle?.phase}.csv`,
                    'csv'
                  )}
                />
                <ReportButton
                  icon={<FileSpreadsheet size={16} className="text-emerald-600" />}
                  label="Achievement Excel"
                  sub="Color-coded, BRD compliant"
                  loading={downloading === 'excel'}
                  onClick={() => download(
                    `/admin/reports/achievement/excel?cycle_id=${selectedCycle?.id}`,
                    `achievement-${selectedCycle?.year}.xlsx`,
                    'excel'
                  )}
                />
                <ReportButton
                  icon={<FileSpreadsheet size={16} className="text-purple-500" />}
                  label="Completion Excel"
                  sub="Dept completion rates"
                  loading={downloading === 'completion'}
                  onClick={() => download(
                    `/admin/reports/completion/excel?cycle_id=${selectedCycle?.id}`,
                    `completion-${selectedCycle?.year}.xlsx`,
                    'completion'
                  )}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string }) {
  const colors: Record<string, { bg: string; icon: string; border: string }> = {
    blue:   { bg: 'bg-blue-50',    icon: 'text-blue-500',    border: 'border-slate-100' },
    emerald:{ bg: 'bg-emerald-50', icon: 'text-emerald-500', border: 'border-slate-100' },
    purple: { bg: 'bg-purple-50',  icon: 'text-purple-500',  border: 'border-slate-100' },
    red:    { bg: 'bg-red-50',     icon: 'text-red-500',     border: 'border-red-100' },
    slate:  { bg: 'bg-slate-50',   icon: 'text-slate-400',   border: 'border-slate-100' },
  }
  const c = colors[color] || colors.slate
  return (
    <div className={`bg-white rounded-2xl border ${c.border} shadow-sm p-5`}>
      <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3 ${c.icon}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-sm font-medium text-slate-700 mt-0.5">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function FunnelRow({ label, value, total, color, textColor }: { label: string; value: number; total: number; color: string; textColor: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${textColor}`}>{value}</span>
          <span className="text-xs text-slate-400">({pct}%)</span>
        </div>
      </div>
      <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`${color} h-2 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ReportButton({ icon, label, sub, loading, onClick }: { icon: React.ReactNode; label: string; sub: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-3.5 border border-slate-100 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-50 text-left group"
    >
      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors flex-shrink-0">
        {loading ? <RefreshCw size={14} className="animate-spin text-slate-400" /> : icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
      <Download size={14} className="text-slate-300 ml-auto flex-shrink-0 group-hover:text-slate-500 transition-colors" />
    </button>
  )
}

