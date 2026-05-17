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
    <div style={{ minHeight: '100%', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#f8fafc' }}>
      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Admin Dashboard</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>Organisation-wide snapshot</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={selectedCycle?.id || ''}
              onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
              style={{ padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', color: '#374151', outline: 'none', fontWeight: 500, cursor: 'pointer' }}
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.phase.replace('_', ' ').toUpperCase()} {c.is_active ? '✦ Active' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={runEscalation} disabled={runningEscalation}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f59e0b', color: 'white', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: runningEscalation ? 'not-allowed' : 'pointer', opacity: runningEscalation ? 0.7 : 1 }}
            >
              {runningEscalation
                ? <RefreshCw size={14} style={{ animation: 'adminSpin 1s linear infinite' }} />
                : <Play size={14} />}
              Run Escalations
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '32px 40px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 0' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(59,130,246,0.15)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'adminSpin 0.8s linear infinite' }} />
          </div>
        ) : overview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* KPI row — 4 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              <KpiCard icon={<Users size={22} />} label="Total Employees" value={overview.total_employees} sub="active in org" accent="blue" />
              <KpiCard icon={<CheckCircle size={22} />} label="Approved Sheets" value={approved} sub={`${pct}% completion rate`} accent="emerald" badge={approved > 0 ? `${pct}%` : undefined} />
              <KpiCard icon={<TrendingUp size={22} />} label="Avg Progress Score" value={overview.avg_progress_score != null ? `${overview.avg_progress_score}%` : '—'} sub="across check-ins" accent="purple" />
              <KpiCard icon={<AlertTriangle size={22} />} label="Open Escalations" value={overview.open_escalations} sub="unresolved alerts" accent={overview.open_escalations > 0 ? 'red' : 'slate'} />
            </div>

            {/* Second row — funnel (2/3) + reports (1/3) */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>

              {/* Goal Setting Funnel */}
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px', margin: 0 }}>Goal Setting Progress</h2>
                    <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '3px', marginBottom: 0 }}>
                      {selectedCycle?.year} · {selectedCycle?.phase.replace('_', ' ').toUpperCase()} cycle
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{pct}%</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', marginBottom: 0 }}>completion rate</p>
                  </div>
                </div>
                <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <FunnelRow label="Approved"            value={approved}   total={total} color="#10b981" textColor="#065f46" />
                  <FunnelRow label="Submitted — Pending" value={submitted}  total={total} color="#fbbf24" textColor="#92400e" />
                  <FunnelRow label="Not Started"         value={notStarted} total={total} color="#cbd5e1" textColor="#475569" />
                </div>
                <div style={{ padding: '0 28px 28px' }}>
                  <div style={{ background: '#f1f5f9', borderRadius: '999px', height: '14px', overflow: 'hidden' }}>
                    <div style={{ height: '14px', background: 'linear-gradient(90deg,#3b82f6,#6366f1,#10b981)', borderRadius: '999px', width: `${pct}%`, transition: 'width 0.7s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
                    <span>0%</span>
                    <span style={{ fontWeight: 600, color: '#475569' }}>{approved} of {total} employees approved</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Reports panel */}
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <h2 style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px', margin: 0 }}>Download Reports</h2>
                  <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '3px', marginBottom: 0 }}>BRD-compliant exports</p>
                </div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <ReportBtn
                    icon={<FileText size={18} color="#3b82f6" />} iconBg="#eff6ff"
                    label="Achievement CSV" sub="All employees · all goals"
                    loading={downloading === 'csv'}
                    onClick={() => download(`/admin/reports/achievement/csv?cycle_id=${selectedCycle?.id}`, `achievement-${selectedCycle?.year}.csv`, 'csv')}
                  />
                  <ReportBtn
                    icon={<FileSpreadsheet size={18} color="#059669" />} iconBg="#ecfdf5"
                    label="Achievement Excel" sub="Color-coded · BRD Section 4"
                    loading={downloading === 'excel'}
                    onClick={() => download(`/admin/reports/achievement/excel?cycle_id=${selectedCycle?.id}`, `achievement-${selectedCycle?.year}.xlsx`, 'excel')}
                  />
                  <ReportBtn
                    icon={<FileSpreadsheet size={18} color="#7c3aed" />} iconBg="#f5f3ff"
                    label="Completion Excel" sub="Dept completion rates"
                    loading={downloading === 'completion'}
                    onClick={() => download(`/admin/reports/completion/excel?cycle_id=${selectedCycle?.id}`, `completion-${selectedCycle?.year}.xlsx`, 'completion')}
                  />
                </div>
                <div style={{ margin: '0 16px 16px', padding: '16px', borderRadius: '12px', border: '1px solid #f1f5f9', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: 0 }}>Escalation Engine</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px', marginBottom: 0 }}>Runs every 6 hours</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '8px', height: '8px', background: '#34d399', borderRadius: '50%' }} />
                      <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Active</span>
                    </div>
                  </div>
                  <button
                    onClick={runEscalation} disabled={runningEscalation}
                    style={{ marginTop: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '9px', borderRadius: '8px', background: '#f59e0b', color: 'white', fontSize: '12px', fontWeight: 700, border: 'none', cursor: runningEscalation ? 'not-allowed' : 'pointer', opacity: runningEscalation ? 0.6 : 1, boxSizing: 'border-box' }}
                  >
                    {runningEscalation ? <RefreshCw size={12} style={{ animation: 'adminSpin 1s linear infinite' }} /> : <Play size={12} />}
                    Run Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8', fontSize: '15px' }}>Select a cycle to view data</div>
        )}
      </div>
      <style>{`@keyframes adminSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const ACCENT: Record<string, { bg: string; iconColor: string; border: string; numColor: string }> = {
  blue:    { bg: '#eff6ff', iconColor: '#3b82f6', border: '#bfdbfe', numColor: '#1d4ed8' },
  emerald: { bg: '#ecfdf5', iconColor: '#059669', border: '#a7f3d0', numColor: '#065f46' },
  purple:  { bg: '#f5f3ff', iconColor: '#7c3aed', border: '#ddd6fe', numColor: '#6d28d9' },
  red:     { bg: '#fef2f2', iconColor: '#ef4444', border: '#fecaca', numColor: '#dc2626' },
  slate:   { bg: '#f8fafc', iconColor: '#64748b', border: '#e2e8f0', numColor: '#475569' },
}

function KpiCard({ icon, label, value, sub, accent, badge }: {
  icon: React.ReactNode; label: string; value: string | number
  sub: string; accent: string; badge?: string
}) {
  const a = ACCENT[accent] || ACCENT.slate
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${a.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ width: '48px', height: '48px', background: a.bg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: a.iconColor, flexShrink: 0 }}>
          {icon}
        </div>
        {badge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: 700, color: a.numColor }}>
            <ArrowUpRight size={12} />{badge}
          </div>
        )}
      </div>
      <p style={{ fontSize: '36px', fontWeight: 800, color: a.numColor, margin: 0, letterSpacing: '-1px' }}>{value}</p>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginTop: '8px', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{sub}</p>
    </div>
  )
}

function FunnelRow({ label, value, total, color, textColor }: {
  label: string; value: number; total: number; color: string; textColor: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '156px', flexShrink: 0 }}>
        <p style={{ fontSize: '13px', color: '#475569', fontWeight: 500, margin: 0 }}>{label}</p>
      </div>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
        <div style={{ background: color, height: '10px', borderRadius: '999px', width: `${pct}%`, transition: 'width 0.7s ease' }} />
      </div>
      <div style={{ width: '88px', textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: textColor }}>{value}</span>
        <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '4px' }}>({pct}%)</span>
      </div>
    </div>
  )
}

function ReportBtn({ icon, iconBg, label, sub, loading, onClick }: {
  icon: React.ReactNode; iconBg: string; label: string; sub: string; loading: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick} disabled={loading}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '12px', border: `1px solid ${hovered ? '#cbd5e1' : '#f1f5f9'}`, background: hovered ? '#f8fafc' : 'white', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, textAlign: 'left', transition: 'all 0.15s', boxSizing: 'border-box' }}
    >
      <div style={{ width: '38px', height: '38px', background: iconBg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {loading ? <RefreshCw size={15} color="#94a3b8" style={{ animation: 'adminSpin 1s linear infinite' }} /> : icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{label}</p>
        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', marginBottom: 0 }}>{sub}</p>
      </div>
      <Download size={13} color={hovered ? '#475569' : '#cbd5e1'} style={{ flexShrink: 0 }} />
    </button>
  )
}
