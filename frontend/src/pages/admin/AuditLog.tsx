import { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { Shield, Search } from 'lucide-react'

function fmtDate(iso: string | null | undefined): string {
  try {
    if (!iso) return '—'
    const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return iso ? iso.slice(0, 16).replace('T', ' ') : '—'
  }
}

interface AuditEntry {
  id: number
  entity_type: string
  entity_id: number
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  note: string | null
  changed_at: string
  changed_by_user?: { name: string }
}

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  created:   { bg: '#dcfce7', text: '#15803d' },
  updated:   { bg: '#dbeafe', text: '#1d4ed8' },
  deleted:   { bg: '#fee2e2', text: '#dc2626' },
  submitted: { bg: '#fef3c7', text: '#b45309' },
  approved:  { bg: '#dcfce7', text: '#15803d' },
  returned:  { bg: '#fee2e2', text: '#dc2626' },
  locked:    { bg: '#f1f5f9', text: '#475569' },
  unlocked:  { bg: '#f5f3ff', text: '#6d28d9' },
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  useEffect(() => {
    setLoading(true)
    api.get('/admin/audit-logs?limit=300')
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : []
        setLogs(data)
      })
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [])

  const searchLower = search.toLowerCase()
  const filtered = logs.filter((l) => {
    const matchSearch = !search ||
      (l.entity_type || '').toLowerCase().includes(searchLower) ||
      (l.action || '').toLowerCase().includes(searchLower) ||
      (l.note || '').toLowerCase().includes(searchLower)
    const matchAction = !filterAction || l.action === filterAction
    return matchSearch && matchAction
  })

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const actions = [...new Set(logs.map((l) => l.action).filter(Boolean))]

  return (
    <div style={{ minHeight: '100%', background: '#f8fafc', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={22} color="#475569" />
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Audit Log</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginTop: '3px', marginBottom: 0 }}>
              Every post-approval change tracked
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 40px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
            <Search
              size={15}
              color="#94a3b8"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Search…"
              style={{
                paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px',
                border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px',
                width: '100%', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(0) }}
            style={{
              padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: '10px',
              fontSize: '13px', background: 'white', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>{filtered.length} entries</p>
        </div>

        {/* Table */}
        <div style={{
          background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                {['Time', 'Entity', 'Action', 'Field', 'Change', 'Note'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px', fontSize: '11px', fontWeight: 700,
                      color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    Loading…
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    No audit entries found
                  </td>
                </tr>
              ) : paginated.map((log) => {
                const ac = ACTION_COLORS[log.action] ?? { bg: '#f1f5f9', text: '#475569' }
                const entityLabel = (log.entity_type || '').replace(/_/g, ' ')
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {fmtDate(log.changed_at)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: '#475569', textTransform: 'capitalize' }}>{entityLabel}</span>
                      <span style={{ color: '#94a3b8', marginLeft: '4px' }}>#{log.entity_id}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
                        fontWeight: 700, textTransform: 'capitalize',
                        background: ac.bg, color: ac.text,
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#64748b', fontSize: '12px' }}>
                      {log.field_name || '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '12px' }}>
                      {log.old_value != null ? (
                        <span>
                          <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{log.old_value}</span>
                          <span style={{ margin: '0 4px', color: '#cbd5e1' }}>→</span>
                          <span style={{ color: '#16a34a' }}>{log.new_value ?? ''}</span>
                        </span>
                      ) : null}
                    </td>
                    <td style={{
                      padding: '10px 16px', color: '#94a3b8', fontSize: '12px',
                      maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {log.note || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '8px',
                fontSize: '13px', cursor: page === 0 ? 'not-allowed' : 'pointer',
                opacity: page === 0 ? 0.4 : 1, background: 'white',
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              style={{
                padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '8px',
                fontSize: '13px', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: page === totalPages - 1 ? 0.4 : 1, background: 'white',
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
