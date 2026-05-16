import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import {
  Users, AlertTriangle, CheckCircle, TrendingUp,
  Download, RefreshCw, Play, FileSpreadsheet, FileText,
  ArrowUpRight
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
      a.href = blobUrl; a.download = filename; a.click()
      URL.revokeObjectURL(blobUrl)
      toast.success('Report downloaded')
    } catch { toast.error('Download failed') }
    finally { setDownloading(null) }
  }

  const runEscalation = async () => {
    setRunningEscalation(true)
    try {
      await api.post('/admin/escalation/run-now')
      toast.success('Escalation checks completed')
    } catch { toast.error('Escalation run failed') }
    finally { setRunningEscalation(false) }
  }

  const approved   = overview?.goal_setting.approved ?? 0
  const submitted  = overview?.goal_setting.submitted ?? 0
  const notStarted = Math.max(0, overview?.goal_setting.not_started ?? 0)
  const total      = overview?.total_employees ?? 1
  const pct        = overview?.goal_setting.completion_rate_pct ?? 0

  return (
    <div className="min-h-full">
      {/* ── Page header ── */}
      <div className="bg-white border-b border-slate-200 px-10 py-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Organisation-wide snapshot</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCycle?.id || ''}
              onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 shadow-sm font-medium"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.phase.replace('_', ' ').toUpperCase()} {c.is_active ? '✦ Active' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={runEscalation}
              disabled={runningEscalation}
              className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2.5 rounded-xl text-sm hover:bg-amber-600 disabled:opacity-50 transition-all shadow-md shadow-amber-500/25 font-semibold"
            >
              {runningEscalation
                ? <RefreshCw size={14} className="animate-spin" />
                : <Play size={14} />}
              Run Escalations
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-10 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : overview ? (
          <div className="space-y-7">

            {/* KPI row */}
            <div className="grid grid-cols-4 gap-6">
              <KpiCard
                icon={<Users size={22} />}
                label="Total Employees"
                value={overview.total_employees}
                sub="active in org"
                accent="blue"
              />
              <KpiCard
                icon={<CheckCircle size={22} />}
                label="Approved Sheets"
                value={approved}
                sub={`${pct}% completion rate`}
                accent="emerald"
                badge={approved > 0 ? `${pct}%` : undefined}
              />
              <KpiCard
                icon={<TrendingUp size={22} />}
                label="Avg Progress Score"
                value={overview.avg_progress_score != null ? `${overview.avg_progress_score}%` : '—'}
                sub="across check-ins"
                accent="purple"
              />
              <KpiCard
                icon={<AlertTriangle size={22} />}
                label="Open Escalations"
                value={overview.open_escalations}
                sub="unresolved alerts"
                accent={overview.open_escalations > 0 ? 'red' : 'slate'}
              />
            </div>

            {/* Second row */}
            <div className="grid grid-cols-3 gap-6">

              {/* Goal Setting Funnel — spans 2 cols */}
              <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-7 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-900 text-base">Goal Setting Progress</h2>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {selectedCycle?.year} · {selectedCycle?.phase.replace('_', ' ').toUpperCase()} cycle
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-slate-900">{pct}%</p>
                    <p className="text-xs text-slate-400 mt-0.5">completion rate</p>
                  </div>
                </div>
                <div className="px-7 py-6 space-y-5">
                  <FunnelRow label="Approved"               value={approved}   total={total} color="bg-emerald-500" shade="emerald" />
                  <FunnelRow label="Submitted — Pending"    value={submitted}  total={total} color="bg-amber-400"  shade="amber"   />
                  <FunnelRow label="Not Started"            value={notStarted} total={total} color="bg-slate-300"  shade="slate"   />
                </div>
                {/* Big gauge */}
                <div className="px-7 pb-7">
                  <div className="bg-slate-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 rounded-full transition-all duration-700 relative"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>0%</span>
                    <span className="font-medium text-slate-600">{approved} of {total} employees approved</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Reports */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="font-bold text-slate-900 text-base">Download Reports</h2>
                  <p className="text-slate-400 text-sm mt-0.5">BRD-compliant exports</p>
                </div>
                <div className="p-4 space-y-3">
                  <ReportBtn
                    icon={<FileText size={18} className="text-blue-500" />}
                    iconBg="bg-blue-50"
                    label="Achievement CSV"
                    sub="All employees · all goals"
                    loading={downloading === 'csv'}
                    onClick={() => download(`/admin/reports/achievement/csv?cycle_id=${selectedCycle?.id}`, `achievement-${selectedCycle?.year}.csv`, 'csv')}
                  />
                  <ReportBtn
                    icon={<FileSpreadsheet size={18} className="text-emerald-600" />}
                    iconBg="bg-emerald-50"
                    label="Achievement Excel"
                    sub="Color-coded · BRD Section 4"
                    loading={downloading === 'excel'}
                    onClick={() => download(`/admin/reports/achievement/excel?cycle_id=${selectedCycle?.id}`, `achievement-${selectedCycle?.year}.xlsx`, 'excel')}
                  />
                  <ReportBtn
                    icon={<FileSpreadsheet size={18} className="text-purple-500" />}
                    iconBg="bg-purple-50"
                    label="Completion Excel"
                    sub="Dept completion rates"
                    loading={downloading === 'completion'}
                    onClick={() => download(`/admin/reports/completion/excel?cycle_id=${selectedCycle?.id}`, `completion-${selectedCycle?.year}.xlsx`, 'completion')}
                  />
                </div>

                {/* Quick escalation status */}
                <div className="mx-4 mb-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Escalation Engine</p>
                      <p className="text-xs text-slate-400 mt-0.5">Runs every 6 hours</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-xs text-emerald-600 font-medium">Active</span>
                    </div>
                  </div>
                  <button
                    onClick={runEscalation}
                    disabled={runningEscalation}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {runningEscalation ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    Run Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-24 text-slate-400">Select a cycle to view data</div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ACCENT: Record<string, { bg: string; icon: string; border: string; num: string }> = {
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-500',    border: 'border-blue-100',    num: 'text-blue-600'    },
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100', num: 'text-emerald-700' },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-500',  border: 'border-purple-100',  num: 'text-purple-700'  },
  red:     { bg: 'bg-red-50',     icon: 'text-red-500',     border: 'border-red-100',     num: 'text-red-600'     },
  slate:   { bg: 'bg-slate-100',  icon: 'text-slate-500',   border: 'border-slate-200',   num: 'text-slate-700'   },
}

function KpiCard({ icon, label, value, sub, accent, badge }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub: string; accent: string; badge?: string
}) {
  const a = ACCENT[accent] || ACCENT.slate
  return (
    <div className={`bg-white rounded-2xl border ${a.border} shadow-sm p-6 flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 ${a.bg} rounded-xl flex items-center justify-center ${a.icon}`}>
          {icon}
        </div>
        {badge && (
          <div className={`flex items-center gap-1 text-xs font-bold ${a.num}`}>
            <ArrowUpRight size={12} />
            {badge}
          </div>
        )}
      </div>
      <div>
        <p className={`text-4xl font-bold tracking-tight ${a.num}`}>{value}</p>
        <p className="text-sm font-semibold text-slate-700 mt-2">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

function FunnelRow({ label, value, total, color, shade }: {
  label: string; value: number; total: number; color: string; shade: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const textColors: Record<string, string> = {
    emerald: 'text-emerald-700', amber: 'text-amber-700', slate: 'text-slate-600'
  }
  return (
    <div className="flex items-center gap-4">
      <div className="w-40 flex-shrink-0">
        <p className="text-sm text-slate-600 font-medium truncate">{label}</p>
      </div>
      <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className={`${color} h-3 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-24 text-right flex-shrink-0">
        <span className={`text-sm font-bold ${textColors[shade] || 'text-slate-600'}`}>{value}</span>
        <span className="text-xs text-slate-400 ml-1">({pct}%)</span>
      </div>
    </div>
  )
}

function ReportBtn({ icon, iconBg, label, sub, loading, onClick }: {
  icon: React.ReactNode; iconBg: string; label: string; sub: string; loading: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-50 text-left group"
    >
      <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
        {loading ? <RefreshCw size={16} className="animate-spin text-slate-400" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
      <Download size={14} className="text-slate-300 group-hover:text-slate-600 transition-colors flex-shrink-0" />
    </button>
  )
}
