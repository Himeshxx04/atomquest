import { useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { X, TrendingUp } from 'lucide-react'

interface Cycle { id: number; year: number; phase: string; start_date: string; end_date: string }
interface Goal { id: number; title: string; uom_type: string; target_numeric: number | null; target_date: string | null; weightage: number }

interface Props { goal: Goal; cycles: Cycle[]; onClose: () => void }

const STATUSES = [
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'behind', label: 'Behind' },
  { value: 'completed', label: 'Completed' },
  { value: 'exceeded', label: 'Exceeded' },
]

export default function ActualModal({ goal, cycles, onClose }: Props) {
  const [cycleId, setCycleId] = useState(cycles[0]?.id?.toString() || '')
  const [actualNumeric, setActualNumeric] = useState('')
  const [actualDate, setActualDate] = useState('')
  const [status, setStatus] = useState('on_track')
  const [saving, setSaving] = useState(false)

  const needsNumeric = ['min', 'max', 'zero'].includes(goal.uom_type)
  const needsDate = goal.uom_type === 'timeline'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/goals/actuals/${goal.id}`, {
        cycle_id: Number(cycleId),
        actual_numeric: actualNumeric ? Number(actualNumeric) : null,
        actual_date: actualDate || null,
        status,
      })
      toast.success('Actual logged successfully!')
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to log actual')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-green-600" />
            <h2 className="text-lg font-semibold text-slate-900">Log Actual</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="font-medium text-sm text-slate-800">{goal.title}</p>
            <div className="flex gap-3 mt-1 text-xs text-slate-500">
              <span className="uppercase">{goal.uom_type}</span>
              {goal.target_numeric != null && <span>Target: {goal.target_numeric}</span>}
              {goal.target_date && <span>Deadline: {goal.target_date}</span>}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Check-in Quarter *</label>
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.phase.toUpperCase()} ({c.start_date} – {c.end_date})
                </option>
              ))}
            </select>
          </div>

          {needsNumeric && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Actual Value *</label>
              <input
                type="number"
                step="any"
                value={actualNumeric}
                onChange={(e) => setActualNumeric(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter actual achievement"
                required
              />
            </div>
          )}

          {needsDate && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Actual Completion Date *</label>
              <input
                type="date"
                value={actualDate}
                onChange={(e) => setActualDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 transition-colors font-medium">
              {saving ? 'Saving…' : 'Log Actual'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
