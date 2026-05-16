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

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  draft:     { bg: 'bg-slate-50',   border: 'border-slate-200',  text: 'text-slate-600',   icon: <Clock size={14} />,       label: 'Draft' },
  submitted: { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   icon: <AlertCircle size={14} />, label: 'Submitted — Awaiting Approval' },
  approved:  { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700', icon: <CheckCircle size={14} />, label: 'Approved ✓' },
  returned:  { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',     icon: <AlertCircle size={14} />, label: 'Returned — Needs Changes' },
}

const UOM_PILL: Record<string, string> = {
  min:      'bg-blue-100 text-blue-700',
  max:      'bg-purple-100 text-purple-700',
  timeline: 'bg-amber-100 text-amber-700',
  zero:     'bg-red-100 text-red-700',
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
    const { data } = await api.get(`/goals/sheets/me?cycle_id=${selectedCycle.id}`)
    setSheet(data)
  }

  const ensureSheet = async () => {
    if (sheet) return sheet
    const { data } = await api.post(`/goals/sheets?cycle_id=${selectedCycle?.id}`)
    setSheet(data); return data
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
    <div className="min-h-full">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Goals</h1>
            <p className="text-slate-500 text-sm mt-1">Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span></p>
          </div>
          <select
            value={selectedCycle?.id || ''}
            onChange={(e) => setSelectedCycle(cycles.find((c) => c.id === Number(e.target.value)) || null)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm font-medium"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year} {c.phase.replace('_', ' ').toUpperCase()} {c.is_active ? '✦ Active' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-8 py-7 max-w-4xl">
        {/* Status + weight bar */}
        {sheet && (
          <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border mb-6 ${sc.bg} ${sc.border}`}>
            <span className={sc.text}>{sc.icon}</span>
            <span className={`font-semibold text-sm ${sc.text}`}>{sc.label}</span>
            {sheet.return_reason && <span className="text-red-600 text-sm">· "{sheet.return_reason}"</span>}
            <div className="ml-auto flex items-center gap-5">
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Goals</p>
                <p className="text-sm font-bold text-slate-700">{sheet.goals.length} / 8</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wide">Weight</p>
                <p className={`text-sm font-bold ${weightOk ? 'text-emerald-600' : 'text-red-500'}`}>{totalWeight.toFixed(0)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Weight progress */}
        {sheet && (
          <div className="mb-7">
            <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  weightOk ? 'bg-emerald-500' : totalWeight > 100 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
            {!weightOk && sheet.goals.length > 0 && (
              <p className="text-xs text-slate-400 mt-1.5">
                {totalWeight < 100
                  ? `Allocate ${(100 - totalWeight).toFixed(0)}% more to reach exactly 100% before submitting`
                  : `Over by ${(totalWeight - 100).toFixed(0)}% — reduce a goal's weightage`}
              </p>
            )}
          </div>
        )}

        {/* Goals list */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : !sheet || sheet.goals.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Target size={36} className="text-blue-400" />
            </div>
            <p className="text-lg font-bold text-slate-800">No goals yet</p>
            <p className="text-slate-400 text-sm mt-2 mb-7">
              {isGoalPhase ? 'Start adding goals for this cycle. You can add up to 8 goals.' : 'No goals were set for this cycle.'}
            </p>
            {isGoalPhase && (
              <button
                onClick={async () => { await ensureSheet(); setShowForm(true) }}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 font-semibold text-sm"
              >
                <Plus size={16} /> Add First Goal
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sheet.goals.map((goal, i) => (
              <GoalCard
                key={goal.id} goal={goal} index={i}
                thrustAreas={thrustAreas} canEdit={canEdit && !goal.is_locked}
                onEdit={() => setEditGoal(goal)} onDelete={() => handleDelete(goal.id)}
                onLogActual={() => setShowActual(goal)} isApproved={sheet.status === 'approved'}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-6">
          {canEdit && isGoalPhase && (sheet?.goals.length ?? 0) < 8 && (
            <button
              onClick={async () => { await ensureSheet(); setShowForm(true) }}
              className="flex items-center gap-2 bg-white border-2 border-dashed border-slate-300 text-slate-600 px-5 py-2.5 rounded-xl hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium text-sm"
            >
              <Plus size={16} /> Add Goal
            </button>
          )}
          {canSubmit && (
            <button
              onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/25 font-semibold text-sm"
            >
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                : <><Send size={15} /> Submit for Approval</>}
            </button>
          )}
        </div>

        {/* Check-in actuals */}
        {sheet?.status === 'approved' && checkinCycles.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={18} className="text-blue-500" />
              <h2 className="text-base font-bold text-slate-800">Quarterly Check-ins</h2>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {checkinCycles.map((cc) => (
                <div key={cc.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-center hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Zap size={16} className="text-blue-500" />
                  </div>
                  <p className="font-bold text-slate-800">{cc.phase.toUpperCase()}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{cc.year}</p>
                  <p className="text-[11px] text-slate-300 mt-1">{cc.start_date} – {cc.end_date}</p>
                  {sheet.goals.length > 0 && (
                    <button
                      onClick={() => setShowActual(sheet.goals[0])}
                      className="mt-4 text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full font-semibold"
                    >
                      Log Actuals
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
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
        <ActualModal goal={showActual} cycles={checkinCycles} onClose={() => setShowActual(null)} />
      )}
    </div>
  )
}

function GoalCard({ goal, index, thrustAreas, canEdit, onEdit, onDelete, onLogActual, isApproved }: {
  goal: Goal; index: number; thrustAreas: ThrustArea[]; canEdit: boolean;
  onEdit: () => void; onDelete: () => void; onLogActual: () => void; isApproved: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const thrust = thrustAreas.find((t) => t.id === goal.thrust_area_id)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
          goal.is_locked ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
        }`}>
          {goal.is_locked ? <Lock size={14} /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="font-semibold text-slate-900 truncate">{goal.title}</p>
            {goal.is_locked && (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide flex-shrink-0">Locked</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {thrust && <span className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">{thrust.name}</span>}
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase ${UOM_PILL[goal.uom_type] || 'bg-slate-100 text-slate-600'}`}>
              {goal.uom_type}
            </span>
            {goal.target_numeric != null && <span className="text-[11px] text-slate-400 px-1">Target: {goal.target_numeric.toLocaleString()}</span>}
            {goal.target_date && <span className="text-[11px] text-slate-400 px-1">Deadline: {goal.target_date}</span>}
          </div>
        </div>

        <div className="text-right flex-shrink-0 mr-2">
          <p className="text-3xl font-black text-slate-800 leading-none">{goal.weightage}<span className="text-base font-normal text-slate-400">%</span></p>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">weight</p>
        </div>

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
            <button onClick={() => setExpanded(!expanded)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>
      {expanded && goal.description && (
        <div className="px-6 pb-5 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500 leading-relaxed">{goal.description}</p>
        </div>
      )}
    </div>
  )
}
