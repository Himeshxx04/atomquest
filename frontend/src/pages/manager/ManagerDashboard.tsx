import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import {
  CheckCircle, XCircle, AlertCircle, Clock, Users,
  TrendingUp, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react'

interface Cycle { id: number; year: number; phase: string; is_active: boolean }
interface Goal { id: number; title: string; weightage: number; uom_type: string; target_numeric: number | null; target_date: string | null }
interface Employee { id: number; name: string; email: string; department: string }
interface GoalSheet {
  id: number; status: string; submitted_at: string | null; approved_at: string | null;
  return_reason: string | null; goals: Goal[]; employee: Employee
}

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; badge: string; dot: string }> = {
  draft:     { icon: <Clock size={12} />,         badge: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400' },
  submitted: { icon: <AlertCircle size={12} />,   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  approved:  { icon: <CheckCircle size={12} />,   badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  returned:  { icon: <XCircle size={12} />,       badge: 'bg-red-100 text-red-600',       dot: 'bg-red-400' },
}

export default function ManagerDashboard() {
  const { user } = useAuthStore()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [sheets, setSheets] = useState<GoalSheet[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedSheet, setExpandedSheet] = useState<number | null>(null)
  const [approving, setApproving] = useState<number | null>(null)
  const [returnInput, setReturnInput] = useState<Record<number, string>>({})
  const [showReturnId, setShowReturnId] = useState<number | null>(null)
  const [checkinComment, setCheckinComment] = useState('')
  const [commentSheetId, setCommentSheetId] = useState<number | null>(null)

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
    api.get(`/goals/manager/team-sheets?cycle_id=${selectedCycle.id}`)
      .then((r) => setSheets(r.data))
      .catch(() => toast.error('Failed to load team sheets'))
      .finally(() => setLoading(false))
  }, [selectedCycle])

  const handleApprove = async (sheetId: number) => {
    setApproving(sheetId)
    try {
      await api.post(`/goals/sheets/${sheetId}/manager-action`, { action: 'approve' })
      toast.success('Sheet approved!')
      setSheets((prev) => prev.map((s) => s.id === sheetId ? { ...s, status: 'approved' } : s))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Approval failed')
    } finally {
      setApproving(null)
    }
  }

  const handleReturn = async (sheetId: number) => {
    const reason = returnInput[sheetId]
    if (!reason?.trim()) { toast.error('Provide a return reason'); return }
    try {
      await api.post(`/goals/sheets/${sheetId}/manager-action`, { action: 'return', return_reason: reason })
      toast.success('Sheet returned to employee')
      setSheets((prev) => prev.map((s) => s.id === sheetId ? { ...s, status: 'returned', return_reason: reason } : s))
      setShowReturnId(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Return failed')
    }
  }

  const handleCheckinComment = async (employeeId: number) => {
    if (!checkinComment.trim() || !selectedCycle) return
    const empSheet = sheets.find((s) => s.employee.id === employeeId)
    if (!empSheet) return
    try {
      await api.post(
        `/goals/sheets/${empSheet.id}/checkin-comment?cycle_id=${selectedCycle.id}`,
        { comment: checkinComment }
      )
      toast.success('Check-in comment saved')
      setCommentSheetId(null)
      setCheckinComment('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save comment')
    }
  }

  const submitted = sheets.filter((s) => s.status === 'submitted').length
  const approved  = sheets.filter((s) => s.status === 'approved').length
  const total = sheets.length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Overview</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {user?.name} · <span className="text-slate-500">{user?.department}</span>
          </p>
        </div>
        <select
          value={selectedCycle?.id || ''}
          onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-sm"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.year} {c.phase.toUpperCase()} {c.is_active ? '✦ Active' : ''}</option>
          ))}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Team Size" value={total} sub="direct reports" icon={<Users size={18} className="text-blue-500" />} iconBg="bg-blue-50" />
        <StatCard label="Pending Review" value={submitted} sub="awaiting approval" icon={<AlertCircle size={18} className="text-amber-500" />} iconBg="bg-amber-50" highlight={submitted > 0} />
        <StatCard label="Approved" value={approved} sub="sheets locked" icon={<CheckCircle size={18} className="text-emerald-500" />} iconBg="bg-emerald-50" />
        <StatCard
          label="Approval Rate"
          value={total ? `${Math.round((approved / total) * 100)}%` : '—'}
          sub="of team sheets"
          icon={<TrendingUp size={18} className="text-purple-500" />}
          iconBg="bg-purple-50"
        />
      </div>

      {/* Team sheets */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : sheets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Users size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No team sheets yet</p>
          <p className="text-slate-400 text-sm mt-1">Your direct reports haven't created goal sheets for this cycle.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sheets.map((sheet) => {
            const sc = STATUS_CONFIG[sheet.status] || STATUS_CONFIG.draft
            return (
              <div key={sheet.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                    {sheet.employee?.name?.charAt(0)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{sheet.employee?.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{sheet.employee?.email} · {sheet.employee?.department}</p>
                  </div>

                  {/* Status + goals count */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">{sheet.goals.length} goals</span>
                    <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${sc.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {sheet.status === 'submitted' && (
                      <>
                        <button
                          onClick={() => handleApprove(sheet.id)}
                          disabled={approving === sheet.id}
                          className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all font-medium shadow-sm"
                        >
                          {approving === sheet.id
                            ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                            : <CheckCircle size={12} />}
                          Approve
                        </button>
                        <button
                          onClick={() => setShowReturnId(showReturnId === sheet.id ? null : sheet.id)}
                          className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-all font-medium"
                        >
                          <XCircle size={12} /> Return
                        </button>
                      </>
                    )}
                    {sheet.status === 'approved' && (
                      <button
                        onClick={() => setCommentSheetId(commentSheetId === sheet.id ? null : sheet.id)}
                        className="flex items-center gap-1.5 text-xs border border-blue-200 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all font-medium"
                      >
                        <MessageSquare size={12} /> Check-in
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedSheet(expandedSheet === sheet.id ? null : sheet.id)}
                      className="w-7 h-7 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      {expandedSheet === sheet.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Return reason input */}
                {showReturnId === sheet.id && (
                  <div className="px-5 pb-4 pt-0 border-t border-slate-50 flex gap-3 mt-0 pt-3">
                    <input
                      value={returnInput[sheet.id] || ''}
                      onChange={(e) => setReturnInput((p) => ({ ...p, [sheet.id]: e.target.value }))}
                      placeholder="Reason for returning this sheet…"
                      className="flex-1 px-3 py-2 border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 bg-red-50 placeholder-red-300 text-red-800"
                    />
                    <button onClick={() => handleReturn(sheet.id)} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 transition-colors font-medium">
                      Confirm Return
                    </button>
                  </div>
                )}

                {/* Check-in comment */}
                {commentSheetId === sheet.id && (
                  <div className="px-5 pb-4 border-t border-slate-50 pt-3 flex gap-3">
                    <textarea
                      value={checkinComment}
                      onChange={(e) => setCheckinComment(e.target.value)}
                      placeholder="Write structured feedback for this quarter's check-in…"
                      rows={2}
                      className="flex-1 px-3 py-2 border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 bg-blue-50 placeholder-blue-300 text-blue-900 resize-none"
                    />
                    <button onClick={() => handleCheckinComment(sheet.employee.id)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition-colors font-medium self-end">
                      Save
                    </button>
                  </div>
                )}

                {/* Goals expanded */}
                {expandedSheet === sheet.id && (
                  <div className="border-t border-slate-50">
                    {sheet.goals.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-4">No goals added yet</p>
                    ) : sheet.goals.map((g, i) => (
                      <div key={g.id} className={`flex items-center gap-4 px-5 py-3 ${i !== 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{g.title}</p>
                          <p className="text-xs text-slate-400 uppercase mt-0.5">{g.uom_type}{g.target_numeric != null ? ` · ${g.target_numeric.toLocaleString()}` : ''}</p>
                        </div>
                        <span className="text-sm font-bold text-slate-600 flex-shrink-0">{g.weightage}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, icon, iconBg, highlight = false }: {
  label: string; value: string | number; sub: string; icon: React.ReactNode; iconBg: string; highlight?: boolean
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${highlight ? 'border-amber-200 shadow-amber-100' : 'border-slate-100'}`}>
      <div className={`w-9 h-9 ${iconBg} rounded-xl flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs font-medium text-slate-700 mt-0.5">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
