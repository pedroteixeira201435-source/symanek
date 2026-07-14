import React, { useState, useEffect } from 'react'
import { ROLES, SCHOOL } from './data.js'
import { authEnabled, currentRole, signIn, signOut } from './auth.js'
import Shell from './Shell.jsx'
import POS from './modules/POS.jsx'

export default function App() {
  // deep-link support (mock/demo only): #admin or #admin/accounting jumps to role
  const [roleId, modId] = window.location.hash.slice(1).split('/')
  const initial = authEnabled() ? null : (ROLES.find((r) => r.id === roleId) || null)
  const [role, setRole] = useState(initial)
  const [booting, setBooting] = useState(authEnabled())

  // http mode: restore a persisted Supabase session on load
  useEffect(() => {
    if (!authEnabled()) return
    let alive = true
    currentRole().then((r) => { if (alive) { setRole(r); setBooting(false) } })
    return () => { alive = false }
  }, [])

  const logout = async () => { await signOut(); setRole(null) }

  if (booting) return <div className="login-wrap"><div className="login-card" style={{ placeItems: 'center', minHeight: 320 }}>Loading…</div></div>
  if (!role) return authEnabled() ? <EmailLogin onLogin={setRole} /> : <Login onPick={setRole} />

  // Canteen seller is LOCKED to the POS — full screen, no sidebar,
  // no admin code paths. Everyone else gets the shell.
  if (role.id === 'seller') return <POS attendant={role.user} onLogout={logout} />

  return <Shell role={role} onLogout={logout} initialMod={authEnabled() ? undefined : modId} />
}

// Real credentials (http mode). Resolves the signed-in user's Suite role via RLS.
function EmailLogin({ onLogin }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setPending(true); setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await signIn(String(fd.get('email')), String(fd.get('password')))
    setPending(false)
    if (res.ok) onLogin(res.role); else setError(res.error || 'Sign-in failed')
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-photo">
          <div className="lp-brand"><div className="lp-mark">S</div><span>SYMANEK&nbsp;SUITE</span></div>
          <div className="lp-overlay">
            <div className="lp-name">{SCHOOL.name}</div>
            <div className="lp-tag">One integrated platform — academics, admissions, finance, HR, canteen and library.</div>
          </div>
        </div>
        <div className="login-form">
          <div className="login-eyebrow">{SCHOOL.term} · Windhoek, Namibia</div>
          <h1>Sign in</h1>
          <div className="sub">Use your Symanek account. Access is limited to your role.</div>
          <form onSubmit={submit} className="role-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field"><label>Email</label><input name="email" type="email" required autoComplete="username" placeholder="you@symanek.local" /></div>
            <div className="field"><label>Password</label><input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" /></div>
            {error && <div className="di-sub" style={{ color: 'var(--red)' }}>{error}</div>}
            <button className="btn primary" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="login-foot">
            <span>Role-based access control</span><span className="dot" /><span>Server-enforced (RLS)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// professional line icons (stroke, monochrome) — no emojis on first touch
const I = (d, extra) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
    {extra}
  </svg>
)
const ROLE_ICONS = {
  admin: I(['M3 21h18', 'M5 21V9m4.5 12V9m5 12V9M19 21V9', 'M2.5 9L12 3l9.5 6']),
  bursar: I(['M6 12h.01M18 12h.01'], <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /></>),
  hr: I(['M15.5 21v-2a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4v2', 'M21.5 21v-2a4 4 0 0 0-3-3.87', 'M15.5 3.13a4 4 0 0 1 0 7.75'], <circle cx="9" cy="7" r="3.6" />),
  teacher: I(['M2 4.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z', 'M22 4.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z']),
  seller: I(['M4 2.5v19l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5 2-1.5 2 1.5v-19l-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z', 'M8.5 8.5h7M8.5 12h7M8.5 15.5h4']),
  librarian: I(['M5 20V4.5m5 15.5V4.5m5 15.5V4.5', 'M18.5 5.5L21 20']),
  student: I(['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5', 'M22 10v6']),
  registrar: I(['M8 2h8a1 1 0 0 1 1 1v18l-5-3-5 3V3a1 1 0 0 1 1-1z', 'M9 7h6M9 11h6']),
  applicant: I(['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z']),
}

function Login({ onPick }) {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-photo">
          <div className="lp-brand">
            <div className="lp-mark">S</div>
            <span>SYMANEK&nbsp;SUITE</span>
          </div>
          <div className="lp-overlay">
            <div className="lp-name">{SCHOOL.name}</div>
            <div className="lp-tag">
              One integrated platform — academics, admissions, finance, HR, canteen and library.
            </div>
            <div className="lp-stats">
              <div><b>{SCHOOL.learners}</b><span>Students</span></div>
              <div><b>{SCHOOL.staff}</b><span>Staff</span></div>
              <div><b>5</b><span>NQF programmes</span></div>
            </div>
          </div>
        </div>
        <div className="login-form">
          <div className="login-eyebrow">{SCHOOL.term} · Windhoek, Namibia</div>
          <h1>Welcome back</h1>
          <div className="sub">Select your workspace to sign in — access is limited to your role.</div>
          <div className="role-grid">
            {ROLES.map((r) => (
              <button key={r.id} className="role-btn" onClick={() => onPick(r)}>
                <div className="ricon">{ROLE_ICONS[r.id]}</div>
                <div style={{ flex: 1 }}>
                  <div className="rname">{r.name}</div>
                  <div className="rdesc">{r.desc}</div>
                </div>
                <svg className="rgo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            ))}
          </div>
          <div className="login-foot">
            <span>Role-based access control</span>
            <span className="dot" />
            <span>NamRA &amp; Labour Act compliant</span>
            <span className="dot" />
            <span>Namibian Dollar (N$)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
