import { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { Plus, Edit2, ToggleLeft, ToggleRight, X } from 'lucide-react'

interface Cycle {
  id: number; year: number; phase: string; start_date: string; end_date: string; is_active: boolean
}

const PHASES = ['goal_setting', 'q1', 'q2', 'q3', 'q4']

export default function Cycles() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editCycle, setEditCycle] = useState<Cycle | null>(null)
  const [form, setForm] = useState({ year: new Date().getFullYear().toString(), phase: 'goal_setting', start_date: '', end_date: '', is_active: false })

  const load = () => {
    setLoading(true)
    api.get('/admin/cycles').then((r) => setCycles(r.data)).catch(() => toast.error('Failed to load cycles')).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = { ...form, year: Number(form.year) }
      if (editCycle) {
        await api.put(`/admin/cycles/${editCycle.id}`, payload)
        toast.success('Cycle updated')
      } else {
        await api.post('/admin/cycles', payload)
        toast.success('Cycle created')
      }
      setShowCreate(false); setEditCycle(null)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Save failed')
    }
  }

  const toggleActive = async (c: Cycle) => {
    try {
      await api.put(`/admin/cycles/${c.id}`, { is_active: !c.is_active })
      toast.success(`Cycle ${c.is_active ? 'deactivated' : 'activated'}`)
      load()
    } catch { toast.error('Failed') }
  }

  const PHASE_BADGE: Record<string, string> = {
    goal_setting: 'bg-purple-100 text-purple-700',
    q1: 'bg-blue-100 text-blue-700',
    q2: 'bg-cyan-100 text-cyan-700',
    q3: 'bg-teal-100 text-teal-700',
    q4: 'bg-green-100 text-green-700',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Cycle Management</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
          <Plus size={16} /> Create Cycle
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Year</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phase</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">End</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Active</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>
            ) : cycles.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4 font-bold text-slate-800">{c.year}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${PHASE_BADGE[c.phase] || 'bg-slate-100 text-slate-600'}`}>
                    {c.phase.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-500">{c.start_date}</td>
                <td className="py-3 px-4 text-slate-500">{c.end_date}</td>
                <td className="py-3 px-4 text-center">
                  <button onClick={() => toggleActive(c)} className="transition-colors">
                    {c.is_active
                      ? <ToggleRight size={22} className="text-green-500 mx-auto" />
                      : <ToggleLeft size={22} className="text-slate-300 mx-auto" />}
                  </button>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => { setEditCycle(c); setForm({ year: c.year.toString(), phase: c.phase, start_date: c.start_date, end_date: c.end_date, is_active: c.is_active }) }}
                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showCreate || editCycle) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-slate-900">{editCycle ? 'Edit Cycle' : 'Create Cycle'}</h2>
              <button onClick={() => { setShowCreate(false); setEditCycle(null) }} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Year *</label>
                  <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phase *</label>
                  <select value={form.phase} onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {PHASES.map((p) => <option key={p} value={p}>{p.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date *</label>
                  <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                <label htmlFor="active" className="text-sm text-slate-700">Set as active cycle</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setEditCycle(null) }} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium">{editCycle ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
