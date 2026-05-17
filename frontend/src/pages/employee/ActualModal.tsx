import { useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { X, TrendingUp, CheckCircle } from 'lucide-react'

interface Cycle { id: number; year: number; phase: string; window_open: string; window_close: string }
interface Goal { id: number; title: string; uom_type: string; target_numeric: number | null; target_date: string | null; weightage: number }

interface Props { goal: Goal; cycles: Cycle[]; defaultCycleId?: number; onClose: () => void }

const STATUSES = [
  { value: 'on_track',  label: 'On Track',  color: '#10b981', bg: '#ecfdf5' },
  { value: 'at_risk',   label: 'At Risk',   color: '#f59e0b', bg: '#fffbeb' },
  { value: 'behind',    label: 'Behind',    color: '#ef4444', bg: '#fef2f2' },
  { value: 'completed', label: 'Completed', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'exceeded',  label: 'Exceeded',  color: '#8b5cf6', bg: '#f5f3ff' },
]

const UOM_LABELS: Record<string, string> = {
  min: 'Higher is better',
  max: 'Lower is better',
  timeline: 'Date-based',
  zero: 'Zero = success',
}

export default function ActualModal({ goal, cycles, defaultCycleId, onClose }: Props) {
  const [cycleId, setCycleId] = useState(
    defaultCycleId ? defaultCycleId.toString() : (cycles[0]?.id?.toString() || '')
  )
  const [actualNumeric, setActualNumeric] = useState('')
  const [actualDate, setActualDate] = useState('')
  const [status, setStatus] = useState('on_track')
  const [saving, setSaving] = useState(false)

  const needsNumeric = ['min', 'max', 'zero'].includes(goal.uom_type)
  const needsDate = goal.uom_type === 'timeline'
  const noCycles = cycles.length === 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put(`/goals/goals/${goal.id}/actuals?cycle_id=${cycleId}`, {
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

  const selectedStatus = STATUSES.find((s) => s.value === status)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px', backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden',
        fontFamily: 'system-ui,-apple-system,sans-serif',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TrendingUp size={18} color="#16a34a" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Log Actual</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0, marginTop: '1px' }}>Record your quarterly progress</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
              borderRadius: '8px', color: '#94a3b8', display: 'flex', alignItems: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; (e.currentTarget as HTMLElement).style.color = '#475569' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Goal info card */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{
            background: '#f8fafc', borderRadius: '12px', padding: '14px 16px',
            border: '1px solid #e2e8f0',
          }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>{goal.title}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '100px',
                background: '#dbeafe', color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{goal.uom_type}</span>
              <span style={{ fontSize: '11px', color: '#64748b', padding: '3px 0' }}>
                {UOM_LABELS[goal.uom_type]}
              </span>
              {goal.target_numeric != null && (
                <span style={{ fontSize: '11px', color: '#64748b', padding: '3px 0' }}>
                  · Target: <strong style={{ color: '#374151' }}>{goal.target_numeric}</strong>
                </span>
              )}
              {goal.target_date && (
                <span style={{ fontSize: '11px', color: '#64748b', padding: '3px 0' }}>
                  · Deadline: <strong style={{ color: '#374151' }}>{goal.target_date}</strong>
                </span>
              )}
              <span style={{ fontSize: '11px', color: '#64748b', padding: '3px 0' }}>
                · Weight: <strong style={{ color: '#374151' }}>{goal.weightage}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 24px 24px' }}>

          {noCycles && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>
              No active check-in quarters (Q1–Q4) found. Ask your admin to create and activate a quarterly cycle before logging actuals.
            </div>
          )}

          {/* Quarter selector */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Check-in Quarter <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: '10px',
                border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#0f172a',
                background: 'white', outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
              onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.phase.toUpperCase()} ({c.window_open} – {c.window_close})
                </option>
              ))}
            </select>
          </div>

          {/* Actual numeric */}
          {needsNumeric && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Actual Value <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                step="any"
                value={actualNumeric}
                onChange={(e) => setActualNumeric(e.target.value)}
                placeholder="Enter your actual achievement"
                required
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#0f172a',
                  background: 'white', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>
          )}

          {/* Actual date */}
          {needsDate && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Actual Completion Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="date"
                value={actualDate}
                onChange={(e) => setActualDate(e.target.value)}
                required
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  border: '1.5px solid #e2e8f0', fontSize: '13px', color: '#0f172a',
                  background: 'white', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
                onBlur={(e) => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>
          )}

          {/* Status */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              Status <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  style={{
                    padding: '8px 4px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                    border: `2px solid ${status === s.value ? s.color : '#e2e8f0'}`,
                    background: status === s.value ? s.bg : 'white',
                    color: status === s.value ? s.color : '#64748b',
                    cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  }}
                >
                  {status === s.value && <CheckCircle size={14} color={s.color} />}
                  {s.label}
                </button>
              ))}
            </div>
            {selectedStatus && (
              <p style={{ fontSize: '12px', color: selectedStatus.color, marginTop: '8px', fontWeight: 500 }}>
                Selected: {selectedStatus.label}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px' }}>
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
              disabled={saving || noCycles}
              style={{
                flex: 1, padding: '11px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
                border: 'none', background: (saving || noCycles) ? '#86efac' : '#16a34a', color: 'white',
                cursor: (saving || noCycles) ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                boxShadow: '0 4px 12px rgba(22,163,74,0.30)',
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
                <>
                  <TrendingUp size={15} />
                  Log Actual
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
