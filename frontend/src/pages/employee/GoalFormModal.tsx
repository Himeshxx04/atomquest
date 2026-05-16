import { useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'

interface ThrustArea { id: number; name: string }
interface Goal {
  id: number; title: string; description: string; uom_type: string;
  target_numeric: number | null; target_date: string | null;
  weightage: number; thrust_area_id: number
}

interface Props {
  sheetId: number
  goal: Goal | null
  thrustAreas: ThrustArea[]
  onSaved: () => void
  onClose: () => void
}

const UOM_TYPES = [
  { value: 'min', label: 'MIN — Higher is better (Revenue, Units)' },
  { value: 'max', label: 'MAX — Lower is better (TAT, Cost)' },
  { value: 'timeline', label: 'TIMELINE — Date-based completion' },
  { value: 'zero', label: 'ZERO — Zero incidents (Safety, Defects)' },
]

export default function GoalFormModal({ sheetId, goal, thrustAreas, onSaved, onClose }: Props) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    thrust_area_id: goal?.thrust_area_id || (thrustAreas[0]?.id || ''),
    uom_type: goal?.uom_type || 'min',
    target_numeric: goal?.target_numeric?.toString() || '',
    target_date: goal?.target_date || '',
    weightage: goal?.weightage?.toString() || '10',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        thrust_area_id: Number(form.thrust_area_id),
        uom_type: form.uom_type,
        target_numeric: form.target_numeric ? Number(form.target_numeric) : null,
        target_date: form.target_date || null,
        weightage: Number(form.weightage),
      }

      if (goal) {
        await api.put(`/goals/sheets/${sheetId}/goals/${goal.id}`, payload)
        toast.success('Goal updated')
      } else {
        await api.post(`/goals/sheets/${sheetId}/goals`, payload)
        toast.success('Goal added')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const needsNumeric = ['min', 'max', 'zero'].includes(form.uom_type)
  const needsDate = form.uom_type === 'timeline'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-slate-900">{goal ? 'Edit Goal' : 'Add New Goal'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Goal Title *</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Increase quarterly revenue by 15%"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              placeholder="Additional context or measurement criteria…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thrust Area *</label>
              <select
                value={form.thrust_area_id}
                onChange={(e) => set('thrust_area_id', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                required
              >
                {thrustAreas.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Weightage % <span className="text-slate-400">(min 10)</span>
              </label>
              <input
                type="number"
                min="10"
                max="100"
                step="5"
                value={form.weightage}
                onChange={(e) => set('weightage', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">UoM Type *</label>
            <select
              value={form.uom_type}
              onChange={(e) => set('uom_type', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {UOM_TYPES.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          {needsNumeric && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Value *</label>
              <input
                type="number"
                step="any"
                value={form.target_numeric}
                onChange={(e) => set('target_numeric', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 1000000"
                required
              />
            </div>
          )}

          {needsDate && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target Date *</label>
              <input
                type="date"
                value={form.target_date}
                onChange={(e) => set('target_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {form.uom_type === 'zero' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              ZERO UoM: Goal is achieved when actual value equals zero (e.g. safety incidents, defects)
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? 'Saving…' : goal ? 'Update Goal' : 'Add Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
