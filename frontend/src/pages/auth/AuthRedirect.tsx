import { useEffect, useState } from 'react'
import { PublicClientApplication } from '@azure/msal-browser'
import { useAuthStore } from '../../store/auth'
import toast from 'react-hot-toast'

const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || ''
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || ''

/**
 * Lightweight OAuth callback handler for MSAL popup flow.
 * This page is the redirectUri target — MSAL in the popup calls
 * handleRedirectPromise(), which reads the auth code from the URL,
 * exchanges it for tokens, and posts the result back to the parent
 * window via postMessage. The parent's loginPopup() promise resolves
 * and the popup closes automatically.
 *
 * Uses the already-bundled MSAL — no CDN required.
 */
export default function AuthRedirect() {
  const [status, setStatus] = useState('Signing in with Microsoft…')

  useEffect(() => {
    if (!AZURE_CLIENT_ID) {
      setStatus('SSO not configured.')
      return
    }

    const pca = new PublicClientApplication({
      auth: {
        clientId: AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        redirectUri: `${window.location.origin}/auth-redirect`,
      },
      cache: { cacheLocation: 'localStorage' },
    })

    pca.initialize()
      .then(() => pca.handleRedirectPromise())
      .then((result) => {
        if (result) {
          // We got a result directly (e.g. redirect flow rather than popup)
          // Hand it off to the auth store and navigate
          return useAuthStore.getState().loginWithAzure(result.idToken, result.accessToken ?? undefined)
            .then(() => {
              const role = useAuthStore.getState().user?.role
              window.location.href = role ? `/${role}` : '/login'
            })
        }
        // Popup flow: handleRedirectPromise() posts the result to the
        // parent window and the popup closes — nothing more needed here.
        setStatus('Done! Closing…')
      })
      .catch((err) => {
        console.error('[AuthRedirect]', err)
        setStatus('Sign-in error. Please close this window and try again.')
        toast.error(err?.message || 'Microsoft sign-in failed')
      })
  }, [])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#f8fafc', color: '#64748b', gap: '16px',
    }}>
      <div style={{
        width: '36px', height: '36px', border: '3px solid #e2e8f0',
        borderTopColor: '#3b82f6', borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <p style={{ fontSize: '14px', margin: 0 }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
