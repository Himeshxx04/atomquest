import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertCircle, Clock, Users, TrendingUp, MessageSquare } from 'lucide-react'

interface Cycle { id: number; year: number; phase: string; is_active: boolean }
interface Goal {
  id: number; title: string; weightage: number; uom_type: string;
  target_numeric: number | null; target_date: string | null
}
interface Employee { id: number; name: string; email: string; department: string }
interface GoalSheet {
  id: number; status: string; submitted_at: string | null; approved_at: string | null;
  return_reason: string | null; goals: Goal[]; employee: Employee
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  draft: <Clock size={14} className="text-slate-500" />,
  submitted: <AlertCircle size={14} className="text-amber-500" />,
  approved: <CheckCircle size={14} className="text-green-500" />,
  returned: <XCircle size={14} className="text-red-500" />,
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-700',
}

export default function ManagerDashboard() {
  const { user } = useAuthStore()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [sheets, setSheets] = useState<GoalSheet[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedSheet, setExpandedSheet] = useState<number | null>(null)
  const [approving, setApproving] = useState<number | null>(null)
  const [returnReason, setReturnReason] = useState('')
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
    if (!returnReason.trim()) { toast.error('Please provide a return reason'); return }
    try {
      await api.post(`/goals/sheets/${sheetId}/manager-action`, { action: 'return', return_reason: returnReason })
      toast.success('Sheet returned to employee')
      setSheets((prev) => prev.map((s) => s.id === sheetId ? { ...s, status: 'returned', return_reason: returnReason } : s))
      setShowReturnId(null)
      setReturnReason('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Return failed')
    }
  }

  const handleCheckinComment = async (_sheetId: number, employeeId: number) => {
    if (!checkinComment.trim() || !selectedCycle) return
    try {
      // Find the sheet for this employee in the current cycle
      const empSheet = sheets.find((s) => s.employee.id === employeeId)
      if (!empSheet) return
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
  const approved = sheets.filter((s) => s.status === 'approved').length
  const total = sheets.length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Overview</h1>
          <p className="text-slate-500 mt-0.5">Manager: {user?.name} · {user?.department}</p>
        </div>
        <select
          value={selectedCycle?.id || ''}
          onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.year} {c.phase.toUpperCase()} {c.is_active ? '(Active)' : ''}</option>
          ))}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<Users size={20} className="text-blue-500" />} label="Team Size" value={total} color="blue" />
        <KpiCard icon={<AlertCircle size={20} className="text-amber-500" />} label="Pending Review" value={submitted} color="amber" />
        <KpiCard icon={<CheckCircle size={20} className="text-green-500" />} label="Approved" value={approved} color="green" />
        <KpiCard
          icon={<TrendingUp size={20} className="text-purple-500" />}
          label="Approval Rate"
          value={total ? `${Math.round((approved / total) * 100)}%` : '—'}
          color="purple"
        />
      </div>

      {/* Team sheets */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : sheets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
          <Users size={40} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500">No team members found for this cycle</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sheets.map((sheet) => (
            <div key={sheet.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Sheet header */}
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-semibold text-slate-600">
                  {sheet.employee?.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{sheet.employee?.name}</p>
                  <p className="text-xs text-slate-500">{sheet.employee?.email} · {sheet.employee?.department}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[sheet.status]}`}>
                    {STATUS_ICON[sheet.status]}
                    {sheet.status.charAt(0).toUpperCase() + sheet.status.slice(1)}
                  </span>
                  <span className="text-xs text-slate-400">{sheet.goals.length} goals</span>
                </div>
                <div className="flex gap-2">
                  {sheet.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => handleApprove(sheet.id)}
                        disabled={approving === sheet.id}
                        className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle size={13} /> Approve
                      </button>
                      <button
                        onClick={() => setShowReturnId(showReturnId === sheet.id ? null : sheet.id)}
                        className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <XCircle size={13} /> Return
                      </button>
                    </>
                  )}
                  {sheet.status === 'approved' && (
                    <button
                      onClick={() => setCommentSheetId(commentSheetId === sheet.id ? null : sheet.id)}
                      className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <MessageSquare size={13} /> Check-in
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedSheet(expandedSheet === sheet.id ? null : sheet.id)}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2"
                  >
                    {expandedSheet === sheet.id ? 'Less' : 'Goals'}
                  </button>
                </div>
              </div>

              {/* Return reason input */}
              {showReturnId === sheet.id && (
                <div className="px-4 pb-4 border-t border-slate-50 pt-3 flex gap-3">
                  <input
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Reason for returning…"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <button
                    onClick={() => handleReturn(sheet.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                  >
                    Confirm Return
                  </button>
                </div>
              )}

              {/* Check-in comment input */}
              {commentSheetId === sheet.id && (
                <div className="px-4 pb-4 border-t border-slate-50 pt-3 flex gap-3">
                  <textarea
                    value={checkinComment}
                    onChange={(e) => setCheckinComment(e.target.value)}
                    placeholder="Write your check-in feedback…"
                    rows={2}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  />
                  <button
                    onClick={() => handleCheckinComment(0, sheet.employee.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors self-end"
                  >
                    Save
                  </button>
                </div>
              )}

              {/* Goals list */}
              {expandedSheet === sheet.id && (
                <div className="border-t border-slate-50">
                  {sheet.goals.map((g, i) => (
                    <div key={g.id} className={`flex items-center gap-4 px-4 py-3 ${i !== 0 ? 'border-t border-slate-50' : ''}`}>
                      <div className="w-1 h-8 bg-blue-400 rounded-full" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">{g.title}</p>
                        <p className="text-xs text-slate-400 uppercase mt-0.5">{g.uom_type} {g.target_numeric != null ? `· Target: ${g.target_numeric}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-700">{g.weightage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50', amber: 'bg-amber-50', green: 'bg-green-50', purple: 'bg-purple-50'
  }
  return (
    <div className={`${colorMap[color]} rounded-xl p-4 border border-${color}-100`}>
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-xs text-slate-500 font-medium">{label}</p></div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  )
}
