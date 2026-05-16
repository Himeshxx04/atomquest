import { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { Shield, Search } from 'lucide-react'
import { format } from 'date-fns'

interface AuditEntry {
  id: number; entity_type: string; entity_id: number; action: string;
  field_name: string | null; old_value: string | null; new_value: string | null;
  note: string | null; created_at: string;
  changed_by_user?: { name: string }
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  returned: 'bg-red-100 text-red-700',
  locked: 'bg-slate-100 text-slate-700',
  unlocked: 'bg-purple-100 text-purple-700',
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
    api.get('/admin/audit-logs?limit=300').then((r) => setLogs(r.data))
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = logs.filter((l) => {
    const matchSearch = !search ||
      l.entity_type.includes(search.toLowerCase()) ||
      l.action.includes(search.toLowerCase()) ||
      (l.note || '').toLowerCase().includes(search.toLowerCase())
    const matchAction = !filterAction || l.action === filterAction
    return matchSearch && matchAction
  })

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const actions = [...new Set(logs.map((l) => l.action))]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={22} className="text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-slate-500 text-sm">Every post-approval change tracked</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search…"
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(0) }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="self-center text-sm text-slate-400">{filtered.length} entries</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Time</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Entity</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Field</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Change</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-400">No audit entries found</td></tr>
            ) : paginated.map((log) => (
              <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-4 text-slate-400 text-xs whitespace-nowrap">
                  {format(new Date(log.created_at), 'MMM d, HH:mm')}
                </td>
                <td className="py-2.5 px-4">
                  <span className="text-slate-600 capitalize">{log.entity_type.replace('_', ' ')}</span>
                  <span className="text-slate-400 ml-1">#{log.entity_id}</span>
                </td>
                <td className="py-2.5 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-slate-500 text-xs">{log.field_name || '—'}</td>
                <td className="py-2.5 px-4 text-xs">
                  {log.old_value != null && (
                    <span>
                      <span className="text-red-500 line-through">{log.old_value}</span>
                      <span className="mx-1 text-slate-300">→</span>
                      <span className="text-green-600">{log.new_value}</span>
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-slate-400 text-xs max-w-xs truncate">{log.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors">Previous</button>
          <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="px-4 py-2 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-50 transition-colors">Next</button>
        </div>
      )}
    </div>
  )
}
