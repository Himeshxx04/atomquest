import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import {
  CheckCircle, XCircle, AlertCircle, Users,
  TrendingUp, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react'

interface Cycle { id: number; year: number; phase: string; is_active: boolean }
interface Goal { id: number; title: string; weightage: number; uom_type: string; target_numeric: number | null }
interface Employee { id: number; name: string; email: string; department: string }
interface GoalSheet {
  id: number; status: string; submitted_at: string | null; approved_at: string | null;
  return_reason: string | null; goals: Goal[]; employee: Employee
}

const STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  draft:     { label: 'Draft',     dot: 'bg-slate-400',   badge: 'bg-slate-100 text-slate-600' },
  submitted: { label: 'Submitted', dot: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700' },
  approved:  { label: 'Approved',  dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  returned:  { label: 'Returned',  dot: 'bg-red-400',     badge: 'bg-red-100 text-red-600' },
}

const AVATARS = [
  'from-blue-400 to-indigo-500', 'from-emerald-400 to-teal-500', 'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500', 'from-purple-400 to-violet-500', 'from-cyan-400 to-blue-500',
]

export default function ManagerDashboard() {
  const { user } = useAuthStore()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [sheets, setSheets] = useState<GoalSheet[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [approving, setApproving] = useState<number | null>(null)
  const [returnInputs, setReturnInputs] = useState<Record<number, string>>({})
  const [showReturn, setShowReturn] = useState<number | null>(null)
  const [checkinComment, setCheckinComment] = useState('')
  const [commentSheet, setCommentSheet] = useState<number | null>(null)

  useEffect(() => {
    api.get('/goals/cycles').then((r) => {
      const cs: Cycle[] = r.data; setCycles(cs)
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
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Approval failed') }
    finally { setApproving(null) }
  }

  const handleReturn = async (sheetId: number) => {
    const reason = returnInputs[sheetId]
    if (!reason?.trim()) { toast.error('Provide a return reason'); return }
    try {
      await api.post(`/goals/sheets/${sheetId}/manager-action`, { action: 'return', return_reason: reason })
      toast.success('Sheet returned')
      setSheets((prev) => prev.map((s) => s.id === sheetId ? { ...s, status: 'returned', return_reason: reason } : s))
      setShowReturn(null)
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Return failed') }
  }

  const handleComment = async (employeeId: number) => {
    if (!checkinComment.trim() || !selectedCycle) return
    const empSheet = sheets.find((s) => s.employee.id === employeeId)
    if (!empSheet) return
    try {
      await api.post(`/goals/sheets/${empSheet.id}/checkin-comment?cycle_id=${selectedCycle.id}`, { comment: checkinComment })
      toast.success('Check-in comment saved'); setCommentSheet(null); setCheckinComment('')
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const submitted = sheets.filter((s) => s.status === 'submitted').length
  const approved  = sheets.filter((s) => s.status === 'approved').length
  const total = sheets.length

  return (
    <div className="min-h-full">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team Overview</h1>
            <p className="text-slate-500 text-sm mt-1">{user?.name} · <span className="text-slate-600 font-medium">{user?.department}</span></p>
          </div>
          <select
            value={selectedCycle?.id || ''}
            onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.year} {c.phase.toUpperCase()} {c.is_active ? '✦ Active' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-8 py-7 max-w-5xl">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-5 mb-7">
          <StatCard icon={<Users size={22} />}         label="Team Size"      value={total}     sub="direct reports"    color="blue" />
          <StatCard icon={<AlertCircle size={22} />}   label="Needs Review"   value={submitted} sub="awaiting approval" color={submitted > 0 ? 'amber' : 'slate'} />
          <StatCard icon={<CheckCircle size={22} />}   label="Approved"       value={approved}  sub="sheets locked"     color="emerald" />
          <StatCard
            icon={<TrendingUp size={22} />}
            label="Approval Rate"
            value={total ? `${Math.round((approved / total) * 100)}%` : '—'}
            sub="of team"
            color="purple"
          />
        </div>

        {/* Team sheets */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Users size={36} className="text-slate-400" />
            </div>
            <p className="text-slate-700 font-bold text-lg">No team sheets</p>
            <p className="text-slate-400 text-sm mt-2">Your direct reports haven't created goal sheets for this cycle yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sheets.map((sheet, idx) => {
              const sc = STATUS[sheet.status] || STATUS.draft
              const avatarGrad = AVATARS[idx % AVATARS.length]
              return (
                <div key={sheet.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                  {/* Main row */}
                  <div className="flex items-center gap-4 px-6 py-5">
                    <div className={`w-11 h-11 bg-gradient-to-br ${avatarGrad} rounded-xl flex items-center justify-center font-bold text-white text-base flex-shrink-0 shadow-sm`}>
                      {sheet.employee?.name?.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900">{sheet.employee?.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{sheet.employee?.email} · {sheet.employee?.department}</p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-slate-400 font-medium">{sheet.goals.length} goals</span>
                      <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sheet.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => handleApprove(sheet.id)}
                            disabled={approving === sheet.id}
                            className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all font-semibold shadow-sm shadow-emerald-600/20"
                          >
                            {approving === sheet.id
                              ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                              : <CheckCircle size={13} />}
                            Approve
                          </button>
                          <button
                            onClick={() => setShowReturn(showReturn === sheet.id ? null : sheet.id)}
                            className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all font-semibold"
                          >
                            <XCircle size={13} /> Return
                          </button>
                        </>
                      )}
                      {sheet.status === 'approved' && (
                        <button
                          onClick={() => setCommentSheet(commentSheet === sheet.id ? null : sheet.id)}
                          className="flex items-center gap-1.5 text-xs border border-blue-200 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-all font-semibold"
                        >
                          <MessageSquare size={13} /> Check-in
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(expanded === sheet.id ? null : sheet.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        {expanded === sheet.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Return input */}
                  {showReturn === sheet.id && (
                    <div className="px-6 pb-5 border-t border-slate-100 pt-4 flex gap-3">
                      <input
                        value={returnInputs[sheet.id] || ''}
                        onChange={(e) => setReturnInputs((p) => ({ ...p, [sheet.id]: e.target.value }))}
                        placeholder="Reason for returning this sheet…"
                        className="flex-1 px-4 py-2.5 border border-red-200 bg-red-50 rounded-xl text-sm text-red-800 placeholder-red-300 focus:outline-none focus:ring-2 focus:ring-red-400/30"
                      />
                      <button onClick={() => handleReturn(sheet.id)} className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 transition-colors font-semibold">
                        Confirm
                      </button>
                    </div>
                  )}

                  {/* Check-in comment */}
                  {commentSheet === sheet.id && (
                    <div className="px-6 pb-5 border-t border-slate-100 pt-4 flex gap-3">
                      <textarea
                        value={checkinComment}
                        onChange={(e) => setCheckinComment(e.target.value)}
                        placeholder="Write structured check-in feedback for this quarter…"
                        rows={2}
                        className="flex-1 px-4 py-2.5 border border-blue-200 bg-blue-50 rounded-xl text-sm text-blue-900 placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400/30 resize-none"
                      />
                      <button onClick={() => handleComment(sheet.employee.id)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition-colors font-semibold self-end">
                        Save
                      </button>
                    </div>
                  )}

                  {/* Goals list */}
                  {expanded === sheet.id && (
                    <div className="border-t border-slate-100">
                      {sheet.goals.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-5">No goals added yet</p>
                      ) : sheet.goals.map((g, i) => (
                        <div key={g.id} className={`flex items-center gap-4 px-6 py-3.5 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-[11px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{g.title}</p>
                            <p className="text-xs text-slate-400 uppercase mt-0.5">{g.uom_type}{g.target_numeric != null ? ` · ${g.target_numeric.toLocaleString()}` : ''}</p>
                          </div>
                          <span className="text-lg font-black text-slate-700 flex-shrink-0">{g.weightage}%</span>
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
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub: string; color: string
}) {
  const colors: Record<string, { bg: string; icon: string; border: string }> = {
    blue:    { bg: 'bg-blue-50',    icon: 'text-blue-500',    border: 'border-blue-100' },
    amber:   { bg: 'bg-amber-50',   icon: 'text-amber-500',   border: 'border-amber-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    purple:  { bg: 'bg-purple-50',  icon: 'text-purple-500',  border: 'border-purple-100' },
    slate:   { bg: 'bg-slate-100',  icon: 'text-slate-500',   border: 'border-slate-200' },
  }
  const c = colors[color] || colors.slate
  return (
    <div className={`bg-white rounded-2xl border ${c.border} shadow-sm p-6`}>
      <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center mb-4 ${c.icon}`}>{icon}</div>
      <p className="text-3xl font-black text-slate-800">{value}</p>
      <p className="text-sm font-bold text-slate-700 mt-1.5">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
