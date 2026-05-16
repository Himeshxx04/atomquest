import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Send, Lock, ChevronDown, ChevronUp,
  Target, TrendingUp, AlertCircle, CheckCircle, Clock
} from 'lucide-react'
import GoalFormModal from './GoalFormModal'
import ActualModal from './ActualModal'

interface ThrustArea { id: number; name: string }
interface Cycle { id: number; year: number; phase: string; is_active: boolean; start_date: string; end_date: string }
interface Goal {
  id: number; title: string; description: string; uom_type: string;
  target_numeric: number | null; target_date: string | null;
  weightage: number; is_locked: boolean; thrust_area_id: number;
  thrust_area?: { name: string }
}
interface GoalSheet {
  id: number; status: string; submitted_at: string | null; approved_at: string | null;
  return_reason: string | null; goals: Goal[]
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'bg-slate-100 text-slate-700', icon: <Clock size={14} />, label: 'Draft' },
  submitted: { color: 'bg-amber-100 text-amber-700', icon: <AlertCircle size={14} />, label: 'Submitted' },
  approved: { color: 'bg-green-100 text-green-700', icon: <CheckCircle size={14} />, label: 'Approved' },
  returned: { color: 'bg-red-100 text-red-700', icon: <AlertCircle size={14} />, label: 'Returned' },
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
  const [showActual, setShowActual] = useState<Goal | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/goals/cycles'),
      api.get('/goals/thrust-areas'),
    ]).then(([cRes, tRes]) => {
      const cs: Cycle[] = cRes.data
      setCycles(cs)
      setThrustAreas(tRes.data)
      const active = cs.find((c) => c.is_active) || cs[0]
      if (active) setSelectedCycle(active)
    }).catch(() => toast.error('Failed to load cycles'))
  }, [])

  useEffect(() => {
    if (!selectedCycle) return
    setLoading(true)
    api.get(`/goals/my-sheet?cycle_id=${selectedCycle.id}`)
      .then((r) => setSheet(r.data))
      .catch(() => setSheet(null))
      .finally(() => setLoading(false))
  }, [selectedCycle])

  const ensureSheet = async () => {
    if (!sheet && selectedCycle) {
      const { data } = await api.post(`/goals/sheets?cycle_id=${selectedCycle.id}`)
      setSheet(data)
      return data
    }
    return sheet
  }

  const handleGoalSaved = async () => {
    setShowForm(false)
    setEditGoal(null)
    if (!selectedCycle) return
    const { data } = await api.get(`/goals/my-sheet?cycle_id=${selectedCycle.id}`)
    setSheet(data)
  }

  const handleDelete = async (goalId: number) => {
    if (!sheet) return
    if (!confirm('Delete this goal?')) return
    try {
      await api.delete(`/goals/sheets/${sheet.id}/goals/${goalId}`)
      toast.success('Goal deleted')
      handleGoalSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Delete failed')
    }
  }

  const handleSubmit = async () => {
    if (!sheet) return
    setSubmitting(true)
    try {
      await api.post(`/goals/sheets/${sheet.id}/submit`)
      toast.success('Sheet submitted for approval!')
      handleGoalSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const totalWeight = sheet?.goals.reduce((s, g) => s + g.weightage, 0) || 0
  const canEdit = sheet?.status === 'draft' || sheet?.status === 'returned'
  const canSubmit = canEdit && Math.abs(totalWeight - 100) < 0.01 && (sheet?.goals.length || 0) > 0
  const statusCfg = STATUS_CONFIG[sheet?.status || 'draft']

  const checkinCycles = cycles.filter((c) =>
    ['q1', 'q2', 'q3', 'q4'].includes(c.phase.toLowerCase())
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Goals</h1>
          <p className="text-slate-500 mt-0.5">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCycle?.id || ''}
            onChange={(e) => {
              const c = cycles.find((c) => c.id === Number(e.target.value))
              setSelectedCycle(c || null)
            }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year} {c.phase.toUpperCase()} {c.is_active ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sheet status bar */}
      {sheet && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl mb-4 ${statusCfg.color} border border-current/20`}>
          {statusCfg.icon}
          <span className="font-medium text-sm">Status: {statusCfg.label}</span>
          {sheet.return_reason && (
            <span className="ml-2 text-sm">— {sheet.return_reason}</span>
          )}
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span>Goals: {sheet.goals.length}/8</span>
            <span className={`font-semibold ${Math.abs(totalWeight - 100) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>
              Weight: {totalWeight.toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Weight bar */}
      {sheet && (
        <div className="bg-slate-100 rounded-full h-2 mb-6">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              Math.abs(totalWeight - 100) < 0.01 ? 'bg-green-500' :
              totalWeight > 100 ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(totalWeight, 100)}%` }}
          />
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : !sheet || sheet.goals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Target size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-lg">No goals yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Add your first goal to get started</p>
          {selectedCycle?.phase.toLowerCase() === 'goal_setting' && (
            <button
              onClick={async () => { await ensureSheet(); setShowForm(true) }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus size={16} /> Add Goal
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sheet.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              thrustAreas={thrustAreas}
              canEdit={canEdit && !goal.is_locked}
              onEdit={() => setEditGoal(goal)}
              onDelete={() => handleDelete(goal.id)}
              onLogActual={() => setShowActual(goal)}
              isApproved={sheet.status === 'approved'}
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        {canEdit && selectedCycle?.phase.toLowerCase() === 'goal_setting' && (sheet?.goals.length || 0) < 8 && (
          <button
            onClick={async () => { await ensureSheet(); setShowForm(true) }}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} /> Add Goal
          </button>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Send size={16} /> {submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
        )}
      </div>

      {/* Check-in actuals section */}
      {sheet?.status === 'approved' && checkinCycles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Check-in Actuals</h2>
          <div className="grid grid-cols-4 gap-3">
            {checkinCycles.map((cc) => (
              <div key={cc.id} className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-sm">
                <p className="font-medium text-slate-800">{cc.phase.toUpperCase()}</p>
                <p className="text-xs text-slate-500 mt-0.5">{cc.year}</p>
                <p className="text-xs mt-1 text-slate-400">{cc.start_date} – {cc.end_date}</p>
                <button
                  onClick={() => {
                    if (sheet.goals.length > 0) setShowActual(sheet.goals[0])
                  }}
                  className="mt-3 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors w-full"
                >
                  Log Actuals
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showForm && sheet && (
        <GoalFormModal
          sheetId={sheet.id}
          goal={null}
          thrustAreas={thrustAreas}
          onSaved={handleGoalSaved}
          onClose={() => setShowForm(false)}
        />
      )}
      {editGoal && sheet && (
        <GoalFormModal
          sheetId={sheet.id}
          goal={editGoal}
          thrustAreas={thrustAreas}
          onSaved={handleGoalSaved}
          onClose={() => setEditGoal(null)}
        />
      )}
      {showActual && sheet && (
        <ActualModal
          goal={showActual}
          cycles={checkinCycles}
          onClose={() => setShowActual(null)}
        />
      )}
    </div>
  )
}

function GoalCard({ goal, thrustAreas, canEdit, onEdit, onDelete, onLogActual, isApproved }: {
  goal: Goal; thrustAreas: ThrustArea[]; canEdit: boolean;
  onEdit: () => void; onDelete: () => void; onLogActual: () => void; isApproved: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const thrust = thrustAreas.find((t) => t.id === goal.thrust_area_id)

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
          {goal.is_locked ? <Lock size={16} className="text-slate-400" /> : <Target size={16} className="text-blue-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-900 truncate">{goal.title}</p>
            {goal.is_locked && (
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Locked</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
            {thrust && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{thrust.name}</span>}
            <span className="uppercase">{goal.uom_type}</span>
            {goal.target_numeric != null && <span>Target: {goal.target_numeric}</span>}
            {goal.target_date && <span>By: {goal.target_date}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold text-slate-800">{goal.weightage}%</p>
            <p className="text-xs text-slate-400">weight</p>
          </div>
          <div className="flex gap-1">
            {isApproved && (
              <button onClick={onLogActual} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Log Actual">
                <TrendingUp size={16} />
              </button>
            )}
            {canEdit && (
              <>
                <button onClick={onEdit} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-xs px-3 py-1.5">Edit</button>
                <button onClick={onDelete} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>
      {expanded && goal.description && (
        <div className="px-4 pb-4 border-t border-slate-50 pt-3">
          <p className="text-sm text-slate-600">{goal.description}</p>
        </div>
      )}
    </div>
  )
}
