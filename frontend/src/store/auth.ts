import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../lib/api'

export interface User {
  id: number
  name: string
  email: string
  role: 'employee' | 'manager' | 'admin'
  department: string | null
  manager_id: number | null
  is_active: boolean
}

interface AuthState {
  token: string | null
  user: User | null
  login: (email: string, password: string) => Promise<void>
  loginWithAzure: (idToken: string) => Promise<void>
  demoSwitch: (role: 'employee' | 'manager' | 'admin') => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('token', data.access_token)
        // Use the user object bundled in the login response — no extra /auth/me round-trip
        set({ token: data.access_token, user: data.user })
      },

      loginWithAzure: async (idToken: string) => {
        const { data } = await api.post('/auth/azure', { id_token: idToken })
        localStorage.setItem('token', data.access_token)
        set({ token: data.access_token, user: data.user })
      },

      demoSwitch: async (role) => {
        const { data } = await api.post('/auth/demo-switch', { role })
        localStorage.setItem('token', data.access_token)
        set({ token: data.access_token })
        const me = await api.get('/auth/me')
        set({ user: me.data })
        // Redirect to the right dashboard
        window.location.href = `/${role}`
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ token: null, user: null })
        window.location.href = '/login'
      },

      fetchMe: async () => {
        const { data } = await api.get('/auth/me')
        set({ user: data })
      },
    }),
    {
      name: 'atomquest-auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
)
