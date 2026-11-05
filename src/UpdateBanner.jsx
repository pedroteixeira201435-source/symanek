import React, { useEffect, useState } from 'react'

// Tells a tab that was opened before the latest deploy to reload. A single-page
// app never reloads by itself, so a phone tab kept open for days keeps running
// the old code while the data (e.g. a new kind of quiz question) is new.
// Checks /version.json (written by vite.config.js) every 2 minutes and whenever
// the tab comes back into view. Never reloads on its own: a student may be in
// the middle of taking photos for a quiz upload.
const CHECK_MS = 2 * 60 * 1000

export default function UpdateBanner() {
  const [stale, setStale] = useState(false)
  useEffect(() => {
    if (!import.meta.env.PROD) return
    let alive = true
    const check = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { id } = await r.json()
        if (alive && id && id !== __BUILD_ID__) setStale(true)
      } catch { /* offline — try again later */ }
    }
    check()
    const t = setInterval(check, CHECK_MS)
    const onShow = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow) }
  }, [])
  if (!stale) return null
  return (
    <div role="status" style={{
      position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 200, margin: '0 auto', maxWidth: 560,
      display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 'var(--radius)',
      background: 'var(--petrol-900, #24333e)', color: '#fff', boxShadow: '0 8px 28px rgba(36, 51, 62, 0.35)',
    }}>
      <div style={{ flex: 1, fontSize: 14 }}>
        <strong>A new version of the Suite is available.</strong>
        <div style={{ opacity: 0.85, fontSize: 13 }}>Reload to get the latest features. Quiz answers are saved automatically.</div>
      </div>
      <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}
