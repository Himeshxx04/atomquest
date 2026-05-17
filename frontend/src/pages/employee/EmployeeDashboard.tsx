import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Send, Lock, ChevronDown, ChevronUp,
  Target, TrendingUp, AlertCircle, CheckCircle, Clock,
  Pencil, BarChart2, Zap
} from 'lucide-react'
import GoalFormModal from './GoalFormModal'
import ActualModal from './ActualModal'

interface ThrustArea { id: number; name: string }
interface Cycle { id: number; year: number; phase: string; is_active: boolean; window_open: string; window_close: string }
interface Goal {
  id: number; title: string; description: string; uom_type: string;
  target_numeric: number | null; target_date: string | null;
  weightage: number; is_locked: boolean; thrust_area_id: number;
}
interface GoalSheet {
  id: number; status: string; submitted_at: string | null; approved_at: string | null;
  return_reason: string | null; goals: Goal[]
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  draft:     { bg: '#f8fafc',  border: '#e2e8f0', text: '#475569',  icon: <Clock size={14} />,       label: 'Draft' },
  submitted: { bg: '#fffbeb',  border: '#fde68a', text: '#b45309',  icon: <AlertCircle size={14} />, label: 'Submitted — Awaiting Approval' },
  approved:  { bg: '#ecfdf5',  border: '#a7f3d0', text: '#065f46',  icon: <CheckCircle size={14} />, label: 'Approved ✓' },
  returned:  { bg: '#fef2f2',  border: '#fecaca', text: '#dc2626',  icon: <AlertCircle size={14} />, label: 'Returned — Needs Changes' },
}

export default function EmployeeDashboard() {
  const { user } = useAuthStore()
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null)
  const [sheet, setSheet] = useState<GoalSheet | null>(null)
  const [thrustAreas, setThrustAreas] = useState<ThrustArea[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [showActual, setShowActual] = useState<{ goal: Goal; defaultCycleId?: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/goals/cycles'), api.get('/goals/thrust-areas')])
      .then(([cRes, tRes]) => {
        const cs: Cycle[] = cRes.data
        setCycles(cs)
        setThrustAreas(tRes.data)
        const active = cs.find((c) => c.is_active) || cs[0]
        if (active) setSelectedCycle(active)
      })
      .catch(() => toast.error('Failed to load data'))
  }, [])

  useEffect(() => {
    if (!selectedCycle) return
    setLoading(true)
    api.get(`/goals/sheets/me?cycle_id=${selectedCycle.id}`)
      .then((r) => setSheet(r.data))
      .catch(() => setSheet(null))
      .finally(() => setLoading(false))
  }, [selectedCycle])

  const reload = async () => {
    if (!selectedCycle) return
    try {
      const { data } = await api.get(`/goals/sheets/me?cycle_id=${selectedCycle.id}`)
      setSheet(data)
    } catch {
      toast.error('Failed to refresh sheet')
    }
  }

  const ensureSheet = async () => {
    if (sheet) return sheet
    try {
      const { data } = await api.post(`/goals/sheets?cycle_id=${selectedCycle?.id}`)
      setSheet(data)
      return data
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create sheet')
      return null
    }
  }

  const handleDelete = async (goalId: number) => {
    if (!sheet || !confirm('Delete this goal?')) return
    try {
      await api.delete(`/goals/sheets/${sheet.id}/goals/${goalId}`)
      toast.success('Goal deleted'); await reload()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Delete failed') }
  }

  const handleSubmit = async () => {
    if (!sheet) return
    setSubmitting(true)
    try {
      await api.post(`/goals/sheets/${sheet.id}/submit`)
      toast.success('Sheet submitted for approval!'); await reload()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Submit failed') }
    finally { setSubmitting(false) }
  }

  const totalWeight  = sheet?.goals.reduce((s, g) => s + g.weightage, 0) ?? 0
  const weightOk     = Math.abs(totalWeight - 100) < 0.01
  const canEdit      = sheet?.status === 'draft' || sheet?.status === 'returned'
  const canSubmit    = canEdit && weightOk && (sheet?.goals.length ?? 0) > 0
  const isGoalPhase  = selectedCycle?.phase?.toLowerCase() === 'goal_setting'
  const checkinCycles = cycles.filter((c) => ['q1', 'q2', 'q3', 'q4'].includes(c.phase.toLowerCase()))
  const sc = STATUS_CONFIG[sheet?.status ?? 'draft']

  return (
    <div style={{ minHeight: '100%', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#f8fafc' }}>
      {/* Page header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>My Goals</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
              Welcome back, <span style={{ fontWeight: 600, color: '#374151' }}>{user?.name}</span>
            </p>
          </div>
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
        </div>
      </div>

      <div style={{ padding: '32px 40px', maxWidth: '900px' }}>
        {/* Status banner */}
        {sheet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderRadius: '14px', border: `1px solid ${sc.border}`, background: sc.bg, marginBottom: '20px' }}>
            <span style={{ color: sc.text }}>{sc.icon}</span>
            <span style={{ fontWeight: 700, fontSize: '13px', color: sc.text }}>{sc.label}</span>
            {sheet.return_reason && <span style={{ color: '#dc2626', fontSize: '13px' }}>· "{sheet.return_reason}"</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Goals</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: 0 }}>{sheet.goals.length} / 8</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>Weight</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: weightOk ? '#059669' : '#dc2626', margin: 0 }}>{totalWeight.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Weight progress bar */}
        {sheet && (
          <div style={{ marginBottom: '28px' }}>
            <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '8px', borderRadius: '999px', transition: 'width 0.5s ease',
                background: weightOk ? '#10b981' : totalWeight > 100 ? '#ef4444' : '#3b82f6',
                width: `${Math.min(totalWeight, 100)}%`
              }} />
            </div>
            {!weightOk && sheet.goals.length > 0 && (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
                {totalWeight < 100
                  ? `Allocate ${(100 - totalWeight).toFixed(0)}% more to reach exactly 100% before submitting`
                  : `Over by ${(totalWeight - 100).toFixed(0)}% — reduce a goal's weightage`}
              </p>
            )}
          </div>
        )}

        {/* Goals list */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 0' }}>
            <div style={{ width: '40px', height: '40px', border: '2px solid rgba(59,130,246,0.15)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'empSpin 0.8s linear infinite' }} />
          </div>
        ) : !sheet || sheet.goals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '72px 20px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ width: '72px', height: '72px', background: '#eff6ff', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Target size={32} color="#3b82f6" />
            </div>
            <p style={{ fontSize: '17px', fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>No goals yet</p>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 28px' }}>
              {isGoalPhase ? 'Start adding goals for this cycle. You can add up to 8 goals.' : 'No goals were set for this cycle.'}
            </p>
            {isGoalPhase && (
              <button
                onClick={async () => { const s = await ensureSheet(); if (s) setShowForm(true) }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#2563eb', color: 'white', padding: '12px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                <Plus size={16} /> Add First Goal
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sheet.goals.map((goal, i) => (
              <GoalCard
                key={goal.id} goal={goal} index={i}
                thrustAreas={thrustAreas} canEdit={canEdit && !goal.is_locked}
                onEdit={() => setEditGoal(goal)} onDelete={() => handleDelete(goal.id)}
                onLogActual={() => setShowActual({ goal })} isApproved={sheet.status === 'approved'}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          {canEdit && isGoalPhase && (sheet?.goals.length ?? 0) < 8 && (
            <button
              onClick={async () => { const s = await ensureSheet(); if (s) setShowForm(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '2px dashed #cbd5e1', color: '#475569', padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={16} /> Add Goal
            </button>
          )}
          {canSubmit && (
            <button
              onClick={handleSubmit} disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#059669', color: 'white', padding: '10px 24px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting
                ? <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'empSpin 0.8s linear infinite' }} /> Submitting…</>
                : <><Send size={15} /> Submit for Approval</>}
            </button>
          )}
        </div>

        {/* Quarterly Check-ins */}
        {sheet?.status === 'approved' && checkinCycles.length > 0 && (
          <CheckinSection
            checkinCycles={checkinCycles}
            goals={sheet.goals}
            onLogActual={(goal, cycle) => setShowActual({ goal, defaultCycleId: cycle.id })}
          />
        )}
      </div>

      {showForm && sheet && (
        <GoalFormModal sheetId={sheet.id} goal={null} thrustAreas={thrustAreas}
          onSaved={async () => { setShowForm(false); await reload() }} onClose={() => setShowForm(false)} />
      )}
      {editGoal && sheet && (
        <GoalFormModal sheetId={sheet.id} goal={editGoal} thrustAreas={thrustAreas}
          onSaved={async () => { setEditGoal(null); await reload() }} onClose={() => setEditGoal(null)} />
      )}
      {showActual && (
        <ActualModal
          goal={showActual.goal}
          cycles={checkinCycles}
          defaultCycleId={showActual.defaultCycleId}
          onClose={() => setShowActual(null)}
        />
      )}
      <style>{`@keyframes empSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function GoalCard({ goal, index, thrustAreas, canEdit, onEdit, onDelete, onLogActual, isApproved }: {
  goal: Goal; index: number; thrustAreas: ThrustArea[]; canEdit: boolean;
  onEdit: () => void; onDelete: () => void; onLogActual: () => void; isApproved: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const thrust = thrustAreas.find((t) => t.id === goal.thrust_area_id)
  const uomStyle = UOM_COLORS[goal.uom_type] || { bg: '#f1f5f9', text: '#475569' }

  return (
    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
        {/* Number / lock badge */}
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '13px', fontWeight: 700, background: goal.is_locked ? '#f1f5f9' : '#2563eb', color: goal.is_locked ? '#94a3b8' : 'white' }}>
          {goal.is_locked ? <Lock size={14} /> : index + 1}
        </div>

        {/* Title + tags */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <p style={{ fontWeight: 600, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>{goal.title}</p>
            {goal.is_locked && (
              <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#94a3b8', padding: '2px 8px', borderRadius: '999px', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>Locked</span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {thrust && <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: '999px', fontWeight: 500 }}>{thrust.name}</span>}
            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', fontWeight: 700, textTransform: 'uppercase', background: uomStyle.bg, color: uomStyle.text }}>{goal.uom_type}</span>
            {goal.target_numeric != null && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: {goal.target_numeric.toLocaleString()}</span>}
            {goal.target_date && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Deadline: {goal.target_date}</span>}
          </div>
        </div>

        {/* Weight */}
        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: '8px' }}>
          <p style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1 }}>
            {goal.weightage}<span style={{ fontSize: '14px', fontWeight: 400, color: '#94a3b8' }}>%</span>
          </p>
          <p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '4px 0 0' }}>weight</p>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {isApproved && (
            <button onClick={onLogActual} title="Log Actual" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: '#059669', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <TrendingUp size={15} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={onEdit} title="Edit" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <Pencil size={14} />
              </button>
              <button onClick={onDelete} title="Delete" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <Trash2 size={14} />
              </button>
            </>
          )}
          {goal.description && (
            <button onClick={() => setExpanded(!expanded)} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>
      {expanded && goal.description && (
        <div style={{ padding: '14px 20px 18px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, margin: 0 }}>{goal.description}</p>
        </div>
      )}
    </div>
  )
}

const UOM_COLORS: Record<string, { bg: string; text: string }> = {
  min:      { bg: '#eff6ff', text: '#1d4ed8' },
  max:      { bg: '#f5f3ff', text: '#6d28d9' },
  timeline: { bg: '#fffbeb', text: '#b45309' },
  zero:     { bg: '#fef2f2', text: '#dc2626' },
}

function CheckinSection({ checkinCycles, goals, onLogActual }: {
  checkinCycles: Cycle[]
  goals: Goal[]
  onLogActual: (goal: Goal, cycle: Cycle) => void
}) {
  const [expandedCycle, setExpandedCycle] = useState<number | null>(
    checkinCycles.find((c) => c.is_active)?.id ?? checkinCycles[0]?.id ?? null
  )

  const QUARTER_COLORS: Record<string, { border: string; headerBg: string; accent: string; light: string }> = {
    q1: { border: '#bfdbfe', headerBg: '#eff6ff', accent: '#2563eb', light: '#dbeafe' },
    q2: { border: '#a7f3d0', headerBg: '#ecfdf5', accent: '#059669', light: '#d1fae5' },
    q3: { border: '#fde68a', headerBg: '#fffbeb', accent: '#d97706', light: '#fef3c7' },
    q4: { border: '#ddd6fe', headerBg: '#f5f3ff', accent: '#7c3aed', light: '#ede9fe' },
  }

  return (
    <div style={{ marginTop: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <BarChart2 size={18} color="#2563eb" />
        <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Quarterly Check-ins</h2>
        <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>— click a quarter to log your actuals</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {checkinCycles.map((cc) => {
          const qc = QUARTER_COLORS[cc.phase.toLowerCase()] || QUARTER_COLORS.q1
          const isOpen = expandedCycle === cc.id

          return (
            <div key={cc.id} style={{
              borderRadius: '14px',
              border: `1px solid ${isOpen ? qc.border : '#e2e8f0'}`,
              background: 'white',
              overflow: 'hidden',
              boxShadow: isOpen ? `0 0 0 3px ${qc.border}40` : '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
            }}>
              {/* Quarter header — clickable */}
              <button
                onClick={() => setExpandedCycle(isOpen ? null : cc.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '14px 20px', background: isOpen ? qc.headerBg : 'white',
                  border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: isOpen ? qc.light : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Zap size={16} color={isOpen ? qc.accent : '#94a3b8'} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: isOpen ? qc.accent : '#1e293b' }}>
                      {cc.phase.toUpperCase()} {cc.year}
                    </span>
                    {cc.is_active && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: qc.accent,
                        background: qc.light, padding: '2px 8px', borderRadius: '999px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>Active</span>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                    {cc.window_open} – {cc.window_close} · {goals.length} goal{goals.length !== 1 ? 's' : ''} to log
                  </p>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isOpen ? 'Collapse' : 'Log Actuals'}
                  <ChevronDown size={16} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
              </button>

              {/* Goals list — shown when expanded */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${qc.border}` }}>
                  {goals.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>No goals to log for.</p>
                  ) : goals.map((g, i) => (
                    <div key={g.id} style={{
                      display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px',
                      borderTop: i > 0 ? '1px solid #f8fafc' : 'none',
                      background: i % 2 === 0 ? 'white' : '#fafafa',
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: qc.light, color: qc.accent,
                        fontSize: '11px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {g.title}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                            padding: '2px 7px', borderRadius: '999px',
                            background: UOM_COLORS[g.uom_type]?.bg || '#f1f5f9',
                            color: UOM_COLORS[g.uom_type]?.text || '#475569',
                          }}>{g.uom_type}</span>
                          {g.target_numeric != null && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: {g.target_numeric.toLocaleString()}</span>}
                          {g.target_date && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Deadline: {g.target_date}</span>}
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{g.weightage}%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => onLogActual(g, cc)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                          border: `1.5px solid ${qc.accent}`, color: qc.accent,
                          background: qc.light, cursor: 'pointer', flexShrink: 0,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = qc.accent; (e.currentTarget as HTMLElement).style.color = 'white' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = qc.light; (e.currentTarget as HTMLElement).style.color = qc.accent }}
                      >
                        <TrendingUp size={13} /> Log Actual
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
