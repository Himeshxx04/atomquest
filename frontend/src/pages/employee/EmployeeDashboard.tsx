import React, { useEffect, useState } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Send, Lock, ChevronDown, ChevronUp,
  Target, TrendingUp, AlertCircle, CheckCircle, Clock,
  Pencil, BarChart2
} from 'lucide-react'
import GoalFormModal from './GoalFormModal'
import ActualModal from './ActualModal'

interface ThrustArea { id: number; name: string }
interface Cycle { id: number; year: number; phase: string; is_active: boolean; start_date: string; end_date: string }
interface Goal {
  id: number; title: string; description: string; uom_type: string;
  target_numeric: number | null; target_date: string | null;
  weightage: number; is_locked: boolean; thrust_area_id: number;
}
interface GoalSheet {
  id: number; status: string; submitted_at: string | null; approved_at: string | null;
  return_reason: string | null; goals: Goal[]
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  draft:     { color: 'text-slate-600',  bg: 'bg-slate-100',  icon: <Clock size={14} />,         label: 'Draft' },
  submitted: { color: 'text-amber-700',  bg: 'bg-amber-50',   icon: <AlertCircle size={14} />,   label: 'Submitted — Awaiting Approval' },
  approved:  { color: 'text-emerald-700',bg: 'bg-emerald-50', icon: <CheckCircle size={14} />,   label: 'Approved' },
  returned:  { color: 'text-red-700',    bg: 'bg-red-50',     icon: <AlertCircle size={14} />,   label: 'Returned — Needs Changes' },
}

const UOM_COLORS: Record<string, string> = {
  min: 'bg-blue-100 text-blue-700', max: 'bg-purple-100 text-purple-700',
  timeline: 'bg-amber-100 text-amber-700', zero: 'bg-red-100 text-red-700',
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
    }).catch(() => toast.error('Failed to load data'))
  }, [])

  useEffect(() => {
    if (!selectedCycle) return
    setLoading(true)
    api.get(`/goals/sheets/me?cycle_id=${selectedCycle.id}`)
      .then((r) => setSheet(r.data))
      .catch(() => setSheet(null))
      .finally(() => setLoading(false))
  }, [selectedCycle])

  const reloadSheet = async () => {
    if (!selectedCycle) return
    const { data } = await api.get(`/goals/sheets/me?cycle_id=${selectedCycle.id}`)
    setSheet(data)
  }

  const ensureSheet = async () => {
    if (sheet) return sheet
    const { data } = await api.post(`/goals/sheets?cycle_id=${selectedCycle?.id}`)
    setSheet(data)
    return data
  }

  const handleGoalSaved = async () => {
    setShowForm(false)
    setEditGoal(null)
    await reloadSheet()
  }

  const handleDelete = async (goalId: number) => {
    if (!sheet || !confirm('Delete this goal?')) return
    try {
      await api.delete(`/goals/sheets/${sheet.id}/goals/${goalId}`)
      toast.success('Goal deleted')
      await reloadSheet()
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
      await reloadSheet()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  const totalWeight = sheet?.goals.reduce((s, g) => s + g.weightage, 0) || 0
  const weightOk = Math.abs(totalWeight - 100) < 0.01
  const canEdit = sheet?.status === 'draft' || sheet?.status === 'returned'
  const canSubmit = canEdit && weightOk && (sheet?.goals.length || 0) > 0
  const isGoalSetting = selectedCycle?.phase?.toLowerCase() === 'goal_setting'
  const checkinCycles = cycles.filter((c) => ['q1', 'q2', 'q3', 'q4'].includes(c.phase.toLowerCase()))
  const statusCfg = STATUS_CONFIG[sheet?.status || 'draft']

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Goals</h1>
          <p className="text-slate-400 mt-0.5 text-sm">Welcome back, <span className="text-slate-600 font-medium">{user?.name}</span></p>
        </div>
        <select
          value={selectedCycle?.id || ''}
          onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 shadow-sm"
        >
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.year} {c.phase.replace('_', ' ').toUpperCase()} {c.is_active ? '✦ Active' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Status banner */}
      {sheet && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl mb-4 border ${statusCfg.bg}`}>
          <span className={statusCfg.color}>{statusCfg.icon}</span>
          <span className={`font-semibold text-sm ${statusCfg.color}`}>{statusCfg.label}</span>
          {sheet.return_reason && (
            <span className="text-red-600 text-sm ml-1">· "{sheet.return_reason}"</span>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right text-xs text-slate-500">
              <span>{sheet.goals.length} / 8 goals</span>
            </div>
            <div className={`text-sm font-bold ${weightOk ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalWeight.toFixed(0)}% weight
            </div>
          </div>
        </div>
      )}

      {/* Weight progress bar */}
      {sheet && (
        <div className="mb-5">
          <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                weightOk ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(totalWeight, 100)}%` }}
            />
          </div>
          {!weightOk && sheet.goals.length > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              {totalWeight < 100
                ? `${(100 - totalWeight).toFixed(0)}% remaining — distribute to reach exactly 100% before submitting`
                : `${(totalWeight - 100).toFixed(0)}% over limit — reduce weightage to submit`}
            </p>
          )}
        </div>
      )}

      {/* Goals */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : !sheet || sheet.goals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target size={28} className="text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold text-lg">No goals yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-6">
            {isGoalSetting ? 'Add your first goal to get started on this cycle.' : 'No goals set for this cycle.'}
          </p>
          {isGoalSetting && (
            <button
              onClick={async () => { await ensureSheet(); setShowForm(true) }}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 font-medium text-sm"
            >
              <Plus size={16} /> Add First Goal
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {sheet.goals.map((goal, i) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              thrustAreas={thrustAreas}
              index={i}
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
      <div className="mt-5 flex gap-3">
        {canEdit && isGoalSetting && (sheet?.goals.length || 0) < 8 && (
          <button
            onClick={async () => { await ensureSheet(); setShowForm(true) }}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm font-medium text-sm"
          >
            <Plus size={16} /> Add Goal
          </button>
        )}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/20 font-medium text-sm"
          >
            {submitting
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
              : <><Send size={16} /> Submit for Approval</>}
          </button>
        )}
      </div>

      {/* Check-in section */}
      {sheet?.status === 'approved' && checkinCycles.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BarChart2 size={16} className="text-blue-500" /> Quarterly Check-ins
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {checkinCycles.map((cc) => (
              <div key={cc.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center hover:border-blue-200 transition-colors">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <TrendingUp size={14} className="text-blue-500" />
                </div>
                <p className="font-bold text-slate-800 text-sm">{cc.phase.toUpperCase()}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{cc.year}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{cc.start_date}–{cc.end_date}</p>
                {sheet.goals.length > 0 && (
                  <button
                    onClick={() => setShowActual(sheet.goals[0])}
                    className="mt-3 text-[11px] bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors w-full font-medium"
                  >
                    Log Actuals
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showForm && sheet && (
        <GoalFormModal sheetId={sheet.id} goal={null} thrustAreas={thrustAreas} onSaved={handleGoalSaved} onClose={() => setShowForm(false)} />
      )}
      {editGoal && sheet && (
        <GoalFormModal sheetId={sheet.id} goal={editGoal} thrustAreas={thrustAreas} onSaved={handleGoalSaved} onClose={() => setEditGoal(null)} />
      )}
      {showActual && sheet && (
        <ActualModal goal={showActual} cycles={checkinCycles} onClose={() => setShowActual(null)} />
      )}
    </div>
  )
}

function GoalCard({ goal, thrustAreas, index, canEdit, onEdit, onDelete, onLogActual, isApproved }: {
  goal: Goal; thrustAreas: ThrustArea[]; index: number; canEdit: boolean;
  onEdit: () => void; onDelete: () => void; onLogActual: () => void; isApproved: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const thrust = thrustAreas.find((t) => t.id === goal.thrust_area_id)

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Number + lock indicator */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
          goal.is_locked ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'
        }`}>
          {goal.is_locked ? <Lock size={13} /> : index + 1}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-slate-800 truncate text-sm">{goal.title}</p>
            {goal.is_locked && <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Locked</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {thrust && (
              <span className="text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{thrust.name}</span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium uppercase ${UOM_COLORS[goal.uom_type] || 'bg-slate-100 text-slate-600'}`}>
              {goal.uom_type}
            </span>
            {goal.target_numeric != null && (
              <span className="text-[11px] text-slate-400">Target: {goal.target_numeric.toLocaleString()}</span>
            )}
            {goal.target_date && (
              <span className="text-[11px] text-slate-400">Deadline: {goal.target_date}</span>
            )}
          </div>
        </div>

        {/* Weight */}
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-slate-800">{goal.weightage}<span className="text-sm font-normal text-slate-400">%</span></p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">weight</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isApproved && (
            <button onClick={onLogActual} title="Log Actual" className="w-8 h-8 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
              <TrendingUp size={15} />
            </button>
          )}
          {canEdit && (
            <>
              <button onClick={onEdit} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={onDelete} title="Delete" className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                <Trash2 size={14} />
              </button>
            </>
          )}
          {goal.description && (
            <button onClick={() => setExpanded(!expanded)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 transition-colors">
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>

      {expanded && goal.description && (
        <div className="px-5 pb-4 pt-0 border-t border-slate-50">
          <p className="text-sm text-slate-500 leading-relaxed mt-3">{goal.description}</p>
        </div>
      )}
    </div>
  )
}
