import { useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { X, Target, AlertTriangle } from 'lucide-react'

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
  { value: 'min', label: 'MIN — Higher is better', desc: 'Revenue, Units, Score', color: '#10b981', bg: '#ecfdf5' },
  { value: 'max', label: 'MAX — Lower is better', desc: 'TAT, Cost, Errors', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'timeline', label: 'TIMELINE — Date-based', desc: 'Project completion', color: '#8b5cf6', bg: '#f5f3ff' },
  { value: 'zero', label: 'ZERO — Zero incidents', desc: 'Safety, Defects', color: '#f59e0b', bg: '#fffbeb' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '10px',
  border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#0f172a',
  background: 'white', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px',
}

export default function GoalFormModal({ sheetId, goal, thrustAreas, onSaved, onClose }: Props) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    thrust_area_id: goal?.thrust_area_id?.toString() || (thrustAreas[0]?.id?.toString() || ''),
    uom_type: goal?.uom_type || 'min',
    target_numeric: goal?.target_numeric?.toString() || '',
    target_date: goal?.target_date || '',
    weightage: goal?.weightage?.toString() || '10',
  })
  const [saving, setSaving] = useState(false)

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (!form.thrust_area_id) {
        toast.error('Select a thrust area before saving')
        setSaving(false)
        return
      }
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
        toast.success('Goal updated!')
      } else {
        await api.post(`/goals/sheets/${sheetId}/goals`, payload)
        toast.success('Goal added!')
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
  const selectedUOM = UOM_TYPES.find((u) => u.value === form.uom_type)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '540px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Target size={18} color="#2563eb" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {goal ? 'Edit Goal' : 'Add New Goal'}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0, marginTop: '1px' }}>
                {goal ? 'Update your goal details' : 'Define your goal for this cycle'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
              borderRadius: '8px', color: '#94a3b8', display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLElement).style.color = '#475569' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px' }}>

          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Goal Title <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g. Increase quarterly revenue by 15%"
              required
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Measurement criteria, context, or key milestones…"
              rows={3}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
              onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {/* Thrust Area + Weightage */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Thrust Area <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                value={form.thrust_area_id}
                onChange={(e) => setField('thrust_area_id', e.target.value)}
                required
                style={{ ...inputStyle, cursor: 'pointer' }}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              >
                {thrustAreas.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>
                Weightage % <span style={{ color: '#94a3b8', fontWeight: 400 }}>(min 10)</span>
              </label>
              <input
                type="number"
                min="10"
                max="100"
                step="5"
                value={form.weightage}
                onChange={(e) => setField('weightage', e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>
          </div>

          {/* UoM Type */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>UoM Type <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {UOM_TYPES.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setField('uom_type', u.value)}
                  style={{
                    padding: '10px 12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                    border: `2px solid ${form.uom_type === u.value ? u.color : '#e2e8f0'}`,
                    background: form.uom_type === u.value ? u.bg : 'white',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 700, color: form.uom_type === u.value ? u.color : '#374151' }}>
                    {u.label.split(' — ')[0]}
                  </div>
                  <div style={{ fontSize: '11px', color: form.uom_type === u.value ? u.color : '#94a3b8', marginTop: '2px' }}>
                    {u.label.split(' — ')[1]} · {u.desc}
                  </div>
                </button>
              ))}
            </div>
            {selectedUOM && (
              <p style={{ fontSize: '12px', color: selectedUOM.color, marginTop: '8px', fontWeight: 500 }}>
                ✓ {selectedUOM.label} — {selectedUOM.desc}
              </p>
            )}
          </div>

          {/* Target Value (numeric UoMs) */}
          {needsNumeric && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Target Value <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="number"
                step="any"
                value={form.target_numeric}
                onChange={(e) => setField('target_numeric', e.target.value)}
                placeholder="e.g. 1000000"
                required
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>
          )}

          {/* Target Date (timeline UoM) */}
          {needsDate && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Target Date <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="date"
                value={form.target_date}
                onChange={(e) => setField('target_date', e.target.value)}
                required
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>
          )}

          {/* ZERO notice */}
          {form.uom_type === 'zero' && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
              padding: '12px 14px', marginBottom: '16px',
            }}>
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                <strong>ZERO UoM:</strong> This goal is achieved when the actual value equals zero — ideal for safety incidents, defects, or escalations.
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
                border: '1.5px solid #e2e8f0', background: 'white', color: '#475569',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
              onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = 'white'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1, padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                border: 'none', background: saving ? '#93c5fd' : '#2563eb', color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                boxShadow: '0 4px 12px rgba(37,99,235,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
            >
              {saving ? (
                <>
                  <span style={{
                    width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: 'white', borderRadius: '50%', display: 'inline-block',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Saving…
                </>
              ) : (
                goal ? 'Update Goal' : '+ Add Goal'
              )}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
