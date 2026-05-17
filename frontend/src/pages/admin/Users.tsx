import { useEffect, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { Plus, Search, UserCheck, UserX, Edit2, X } from 'lucide-react'

interface User {
  id: number; name: string; email: string; role: string;
  department: string | null; is_active: boolean; manager_id: number | null
}

const ROLES = ['employee', 'manager', 'admin']
// Departments are derived from loaded users so any existing dept always appears

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' })

  const load = () => {
    setLoading(true)
    api.get('/admin/users').then((r) => setUsers(r.data)).catch(() => toast.error('Failed to load users')).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = !filterRole || u.role === filterRole
    return matchSearch && matchRole
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/admin/users', {
        name: form.name, email: form.email, password: form.password,
        role: form.role, department: form.department || null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      })
      toast.success('User created')
      setShowCreate(false)
      setForm({ name: '', email: '', password: '', role: 'employee', department: '', manager_id: '' })
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Create failed')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    try {
      await api.patch(`/admin/users/${editUser.id}`, {
        name: form.name, role: form.role, department: form.department || null,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      })
      toast.success('User updated')
      setEditUser(null)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Update failed')
    }
  }

  const toggleActive = async (u: User) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active })
      toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`)
      load()
    } catch { toast.error('Action failed') }
  }

  const managers = users.filter((u) => u.role === 'manager')
  // Derive unique departments from loaded users + common defaults so any existing dept shows
  const DEPTS = [...new Set([
    'Engineering', 'Sales', 'Operations', 'Finance', 'HR', 'Marketing',
    ...users.map((u) => u.department).filter(Boolean) as string[]
  ])].sort()

  return (
    <div style={{ minHeight: '100%', background: '#f8fafc', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '28px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: 0 }}>User Management</h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#2563eb', color: 'white', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      <div style={{ padding: '28px 40px' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={{ paddingLeft: '36px', paddingRight: '16px', paddingTop: '9px', paddingBottom: '9px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', background: 'white', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              {['Name', 'Email', 'Role', 'Department', 'Status', 'Actions'].map((h, i) => (
                <th key={h} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i >= 4 ? 'center' : 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading…</td></tr>
            ) : filtered.map((u) => {
              const roleColors = u.role === 'admin'
                ? { bg: '#f5f3ff', text: '#6d28d9' }
                : u.role === 'manager'
                ? { bg: '#eff6ff', text: '#1d4ed8' }
                : { bg: '#ecfdf5', text: '#065f46' }
              return (
              <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>{u.name}</td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', fontWeight: 700, textTransform: 'capitalize', background: roleColors.bg, color: roleColors.text }}>{u.role}</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.department || '—'}</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', fontWeight: 600, background: u.is_active ? '#dcfce7' : '#f1f5f9', color: u.is_active ? '#15803d' : '#64748b' }}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      onClick={() => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '', role: u.role, department: u.department || '', manager_id: u.manager_id?.toString() || '' }) }}
                      style={{ padding: '4px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => toggleActive(u)} style={{ padding: '4px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            )
            })}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      {(showCreate || editUser) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{editUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => { setShowCreate(false); setEditUser(null) }} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={editUser ? handleUpdate : handleCreate} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Full Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} required />
              </div>
              {!editUser && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Email *</label>
                    <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Password *</label>
                    <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Role *</label>
                  <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                    {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Department</label>
                  <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                    <option value="">— None —</option>
                    {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {form.role === 'employee' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Manager</label>
                  <select value={form.manager_id} onChange={(e) => setForm((f) => ({ ...f, manager_id: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', boxSizing: 'border-box' }}>
                    <option value="">— None —</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                <button type="button" onClick={() => { setShowCreate(false); setEditUser(null) }} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', background: 'white' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{editUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
