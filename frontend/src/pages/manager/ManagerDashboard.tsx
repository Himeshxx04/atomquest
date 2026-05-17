import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertCircle, Users, TrendingUp, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

interface Cycle { id: number; year: number; phase: string; is_active: boolean }
interface Goal { id: number; title: string; weightage: number; uom_type: string; target_numeric: number | null }
interface Employee { id: number; name: string; email: string; department: string }
interface GoalSheet {
  id: number; status: string; submitted_at: string | null; approved_at: string | null;
  return_reason: string | null; goals: Goal[]; employee: Employee
}

const STATUS: Record<string, { label: string; dotColor: string; badgeBg: string; badgeText: string }> = {
  draft:     { label: 'Draft',     dotColor: '#94a3b8', badgeBg: '#f1f5f9', badgeText: '#475569' },
  submitted: { label: 'Submitted', dotColor: '#fbbf24', badgeBg: '#fffbeb', badgeText: '#b45309' },
  approved:  { label: 'Approved',  dotColor: '#10b981', badgeBg: '#ecfdf5', badgeText: '#065f46' },
  returned:  { label: 'Returned',  dotColor: '#f87171', badgeBg: '#fef2f2', badgeText: '#dc2626' },
}

const AVATAR_GRADIENTS = [
  ['#60a5fa', '#6366f1'], ['#34d399', '#14b8a6'], ['#fb7185', '#ec4899'],
  ['#fbbf24', '#f97316'], ['#a78bfa', '#8b5cf6'], ['#22d3ee', '#3b82f6'],
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
    // Reset all per-sheet UI state when cycle changes
    setExpanded(null)
    setApproving(null)
    setReturnInputs({})
    setShowReturn(null)
    setCheckinComment('')
    setCommentSheet(null)
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
    <div style={{ minHeight: '100%', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#f8fafc' }}>
      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Team Overview</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
              {user?.name} · <span style={{ color: '#374151', fontWeight: 600 }}>{user?.department}</span>
            </p>
          </div>
          <select
            value={selectedCycle?.id || ''}
            onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
            style={{ padding: '10px 16px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', color: '#374151', outline: 'none', fontWeight: 500, cursor: 'pointer' }}
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>{c.year} {c.phase.toUpperCase()} {c.is_active ? '✦ Active' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ padding: '32px 40px' }}>
        {/* Stats row — 4 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
          <StatCard icon={<Users size={22} />}       label="Team Size"      value={total}     sub="direct reports"    accentBg="#eff6ff" accentIcon="#3b82f6" accentBorder="#bfdbfe" accentNum="#1d4ed8" />
          <StatCard icon={<AlertCircle size={22} />} label="Needs Review"   value={submitted} sub="awaiting approval" accentBg={submitted > 0 ? '#fffbeb' : '#f8fafc'} accentIcon={submitted > 0 ? '#f59e0b' : '#94a3b8'} accentBorder={submitted > 0 ? '#fde68a' : '#e2e8f0'} accentNum={submitted > 0 ? '#b45309' : '#475569'} />
          <StatCard icon={<CheckCircle size={22} />} label="Approved"       value={approved}  sub="sheets locked"     accentBg="#ecfdf5" accentIcon="#10b981" accentBorder="#a7f3d0" accentNum="#065f46" />
          <StatCard icon={<TrendingUp size={22} />}  label="Approval Rate"  value={total ? `${Math.round((approved / total) * 100)}%` : '—'} sub="of team" accentBg="#f5f3ff" accentIcon="#7c3aed" accentBorder="#ddd6fe" accentNum="#6d28d9" />
        </div>

        {/* Team sheets */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 0' }}>
            <div style={{ width: '40px', height: '40px', border: '2px solid rgba(59,130,246,0.15)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'mgrSpin 0.8s linear infinite' }} />
          </div>
        ) : sheets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: '72px', height: '72px', background: '#f1f5f9', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Users size={32} color="#94a3b8" />
            </div>
            <p style={{ fontSize: '17px', fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>No team sheets</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Your direct reports haven't created goal sheets for this cycle yet.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sheets.map((sheet, idx) => {
              const sc = STATUS[sheet.status] || STATUS.draft
              const [c1, c2] = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length]
              return (
                <div key={sheet.id} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                  {/* Main row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px' }}>
                    {/* Avatar */}
                    <div style={{ width: '44px', height: '44px', background: `linear-gradient(135deg,${c1},${c2})`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', fontSize: '16px', flexShrink: 0 }}>
                      {sheet.employee?.name?.charAt(0)}
                    </div>

                    {/* Name + email */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 3px', fontSize: '14px' }}>{sheet.employee?.name}</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{sheet.employee?.email} · {sheet.employee?.department}</p>
                    </div>

                    {/* Goals count + status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>{sheet.goals.length} goals</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '5px 12px', borderRadius: '999px', fontWeight: 700, background: sc.badgeBg, color: sc.badgeText }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.dotColor, flexShrink: 0 }} />
                        {sc.label}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {sheet.status === 'submitted' && (
                        <>
                          <button
                            onClick={() => handleApprove(sheet.id)} disabled={approving === sheet.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', background: '#059669', color: 'white', padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: approving === sheet.id ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: approving === sheet.id ? 0.7 : 1 }}
                          >
                            {approving === sheet.id
                              ? <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'mgrSpin 0.8s linear infinite' }} />
                              : <CheckCircle size={13} />}
                            Approve
                          </button>
                          <button
                            onClick={() => setShowReturn(showReturn === sheet.id ? null : sheet.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', border: '1px solid #fecaca', color: '#dc2626', background: '#fef2f2', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                          >
                            <XCircle size={13} /> Return
                          </button>
                        </>
                      )}
                      {sheet.status === 'approved' && (
                        <button
                          onClick={() => { setCommentSheet(commentSheet === sheet.id ? null : sheet.id); setCheckinComment('') }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', border: '1px solid #bfdbfe', color: '#2563eb', background: '#eff6ff', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                        >
                          <MessageSquare size={13} /> Check-in
                        </button>
                      )}
                      <button
                        onClick={() => setExpanded(expanded === sheet.id ? null : sheet.id)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                      >
                        {expanded === sheet.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Return input */}
                  {showReturn === sheet.id && (
                    <div style={{ padding: '16px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px' }}>
                      <input
                        value={returnInputs[sheet.id] || ''}
                        onChange={(e) => setReturnInputs((p) => ({ ...p, [sheet.id]: e.target.value }))}
                        placeholder="Reason for returning this sheet…"
                        style={{ flex: 1, padding: '10px 16px', border: '1px solid #fecaca', background: '#fef2f2', borderRadius: '10px', fontSize: '13px', color: '#991b1b', outline: 'none' }}
                      />
                      <button
                        onClick={() => handleReturn(sheet.id)}
                        style={{ padding: '10px 20px', background: '#dc2626', color: 'white', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                      >
                        Confirm
                      </button>
                    </div>
                  )}

                  {/* Check-in comment */}
                  {commentSheet === sheet.id && (
                    <div style={{ padding: '16px 24px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '12px' }}>
                      <textarea
                        value={checkinComment}
                        onChange={(e) => setCheckinComment(e.target.value)}
                        placeholder="Write structured check-in feedback for this quarter…"
                        rows={2}
                        style={{ flex: 1, padding: '10px 16px', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '10px', fontSize: '13px', color: '#1e3a5f', outline: 'none', resize: 'none' }}
                      />
                      <button
                        onClick={() => handleComment(sheet.employee.id)}
                        style={{ padding: '10px 20px', background: '#2563eb', color: 'white', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', alignSelf: 'flex-end' }}
                      >
                        Save
                      </button>
                    </div>
                  )}

                  {/* Expanded goals list */}
                  {expanded === sheet.id && (
                    <div style={{ borderTop: '1px solid #f1f5f9' }}>
                      {sheet.goals.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>No goals added yet</p>
                      ) : sheet.goals.map((g, i) => (
                        <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 24px', borderTop: i > 0 ? '1px solid #f8fafc' : 'none' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>{g.uom_type}{g.target_numeric != null ? ` · ${g.target_numeric.toLocaleString()}` : ''}</p>
                          </div>
                          <span style={{ fontSize: '18px', fontWeight: 900, color: '#374151', flexShrink: 0 }}>{g.weightage}%</span>
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
      <style>{`@keyframes mgrSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function StatCard({ icon, label, value, sub, accentBg, accentIcon, accentBorder, accentNum }: {
  icon: React.ReactNode; label: string; value: string | number; sub: string
  accentBg: string; accentIcon: string; accentBorder: string; accentNum: string
}) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${accentBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '24px' }}>
      <div style={{ width: '48px', height: '48px', background: accentBg, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentIcon, marginBottom: '16px' }}>
        {icon}
      </div>
      <p style={{ fontSize: '32px', fontWeight: 900, color: accentNum, margin: '0 0 6px', letterSpacing: '-1px' }}>{value}</p>
      <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{sub}</p>
    </div>
  )
}
