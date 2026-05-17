import { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { Plus, Edit2, ToggleLeft, ToggleRight, X } from 'lucide-react'

interface Cycle {
  id: number; year: number; phase: string; window_open: string; window_close: string; is_active: boolean
}

const PHASES = ['goal_setting', 'q1', 'q2', 'q3', 'q4']

const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  goal_setting: { bg: '#f5f3ff', text: '#6d28d9' },
  q1: { bg: '#eff6ff', text: '#1d4ed8' },
  q2: { bg: '#ecfeff', text: '#0e7490' },
  q3: { bg: '#f0fdfa', text: '#0f766e' },
  q4: { bg: '#f0fdf4', text: '#15803d' },
}

export default function Cycles() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editCycle, setEditCycle] = useState<Cycle | null>(null)
  const [form, setForm] = useState({ year: new Date().getFullYear().toString(), phase: 'goal_setting', window_open: '', window_close: '', is_active: false })

  const load = () => {
    setLoading(true)
    api.get('/goals/cycles').then((r) => setCycles(r.data)).catch(() => toast.error('Failed to load cycles')).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = { ...form, year: Number(form.year) }
      if (editCycle) {
        await api.patch(`/admin/cycles/${editCycle.id}`, payload)
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
      await api.patch(`/admin/cycles/${c.id}`, { is_active: !c.is_active })
      toast.success(`Cycle ${c.is_active ? 'deactivated' : 'activated'}`)
      load()
    } catch { toast.error('Failed') }
  }

  return (
    <div style={{ minHeight: '100%', background: '#f8fafc', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Cycle Management</h1>
        <button onClick={() => setShowCreate(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2563eb', color: 'white', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          <Plus size={16} /> Create Cycle
        </button>
      </div>

      <div style={{ padding: '28px 40px' }}>
        <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                {['Year', 'Phase', 'Start', 'End', 'Active', 'Actions'].map((h, i) => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i >= 4 ? 'center' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading…</td></tr>
              ) : cycles.map((c) => {
                const pc = PHASE_COLORS[c.phase] || { bg: '#f1f5f9', text: '#475569' }
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>{c.year}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', fontWeight: 700, textTransform: 'uppercase', background: pc.bg, color: pc.text }}>
                        {c.phase.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{c.window_open}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{c.window_close}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button onClick={() => toggleActive(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex' }}>
                        {c.is_active
                          ? <ToggleRight size={24} color="#10b981" />
                          : <ToggleLeft size={24} color="#cbd5e1" />}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => { setEditCycle(c); setForm({ year: c.year.toString(), phase: c.phase, window_open: c.window_open, window_close: c.window_close, is_active: c.is_active }) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {(showCreate || editCycle) && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
            <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '440px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{editCycle ? 'Edit Cycle' : 'Create Cycle'}</h2>
                <button onClick={() => { setShowCreate(false); setEditCycle(null) }} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <form onSubmit={handleSave} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Year *</label>
                    <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Phase *</label>
                    <select value={form.phase} onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                      {PHASES.map((p) => <option key={p} value={p}>{p.replace('_', ' ').toUpperCase()}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Window Open *</label>
                    <input type="date" value={form.window_open} onChange={(e) => setForm((f) => ({ ...f, window_open: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Window Close *</label>
                    <input type="date" value={form.window_close} onChange={(e) => setForm((f) => ({ ...f, window_close: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" id="active" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                  <label htmlFor="active" style={{ fontSize: '13px', color: '#374151' }}>Set as active cycle</label>
                </div>
                <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                  <button type="button" onClick={() => { setShowCreate(false); setEditCycle(null) }} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Cancel</button>
                  <button type="submit" style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{editCycle ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
