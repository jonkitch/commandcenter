import { useState, useEffect } from 'react'
import CommandCenter from './CommandCenter.jsx'

// ── Password Gate ─────────────────────────────────────────────────────────────
// Your password is stored as a SHA-256 hash in VITE_APP_PASS_HASH (Netlify env var).
// The plaintext password never lives in code or on the server.
//
// To generate your hash, open your browser console and run:
//   const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
//   console.log([...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''))
//
// Then add VITE_APP_PASS_HASH=<that hash> in Netlify → Site settings → Environment variables

const PASS_HASH = import.meta.env.VITE_APP_PASS_HASH
const SESSION_KEY = 'cc_auth'
const SESSION_HOURS = 12 // auto-logout after 12 hours

async function hashPassword(password) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
  )
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function isSessionValid() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')
    if (!s) return false
    const age = (Date.now() - s.ts) / 1000 / 60 / 60
    return age < SESSION_HOURS
  } catch {
    return false
  }
}

function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError('')

    // If no hash is configured, allow any password in dev mode
    if (!PASS_HASH) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }))
      onSuccess()
      return
    }

    const hash = await hashPassword(password)
    if (hash === PASS_HASH) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }))
      onSuccess()
    } else {
      setError('Incorrect password. Try again.')
      setPassword('')
    }
    setLoading(false)
  }

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', 'Outfit', sans-serif",
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F8F7F4 0%, #EEF2FF 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: inherit; }
        button { font-family: inherit; }
      `}</style>

      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 8px 40px rgba(0,0,0,.1)',
        border: '1px solid #E5E7EB',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #1E1B4B, #4338CA)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
            boxShadow: '0 4px 16px rgba(67,56,202,.3)',
          }}>⬡</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>Command Center</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Jonathan Kitchens — Private</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
              textTransform: 'uppercase', color: '#374151',
              display: 'block', marginBottom: 8,
            }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoFocus
                style={{
                  width: '100%', padding: '12px 44px 12px 14px',
                  border: `1.5px solid ${error ? '#FECACA' : '#E5E7EB'}`,
                  borderRadius: 10, fontSize: 15, color: '#111827',
                  background: error ? '#FEF2F2' : '#FAFAFA',
                  outline: 'none', transition: 'border .15s',
                }}
                onFocus={e => e.target.style.borderColor = '#4338CA'}
                onBlur={e => e.target.style.borderColor = error ? '#FECACA' : '#E5E7EB'}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: 12, top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', fontSize: 16, color: '#9CA3AF',
                }}
              >{showPass ? '🙈' : '👁'}</button>
            </div>
            {error && (
              <div style={{
                marginTop: 8, fontSize: 12, color: '#DC2626',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>⚠ {error}</div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              width: '100%', padding: '12px',
              background: loading || !password.trim() ? '#E5E7EB' : 'linear-gradient(135deg, #1E1B4B, #4338CA)',
              color: loading || !password.trim() ? '#9CA3AF' : '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: loading || !password.trim() ? 'not-allowed' : 'pointer',
              transition: 'all .15s', letterSpacing: '.02em',
            }}
          >
            {loading ? 'Checking…' : '→ Unlock'}
          </button>
        </form>

        <div style={{
          marginTop: 24, padding: '12px 14px',
          background: '#F8F7F4', borderRadius: 8,
          fontSize: 11, color: '#9CA3AF', lineHeight: 1.5, textAlign: 'center',
        }}>
          Session expires after {SESSION_HOURS} hours
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    if (isSessionValid()) setAuthed(true)
  }, [])

  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />
  return <CommandCenter />
}
