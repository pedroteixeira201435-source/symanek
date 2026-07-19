import React, { useState } from 'react'

export function StatCard({ icon, label, value, delta, deltaTone = 'up', onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="label">
        <span className="chip"><span className="gs">{icon}</span></span> {label}
      </div>
      <div className="value">{value}</div>
      {delta && <div className={`delta ${deltaTone}`}>{delta}</div>}
    </div>
  )
}

// donut via conic-gradient; segs = [[label, value, cssColor], ...]
export function Donut({ segs, center }) {
  const total = segs.reduce((s, [, v]) => s + v, 0)
  let acc = 0
  const stops = segs
    .map(([, v, c]) => {
      const from = (acc / total) * 360
      acc += v
      return `${c} ${from}deg ${(acc / total) * 360}deg`
    })
    .join(', ')
  return (
    <div className="donut-wrap">
      <div className="donut" data-center={center} style={{ background: `conic-gradient(${stops})` }} />
      <div>
        {segs.map(([l, v, c]) => (
          <div key={l} className="cf-row" style={{ padding: '4px 0', gap: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: 'inline-block' }} />
              {l}
            </span>
            <span className="mono" style={{ fontWeight: 600 }}>{Math.round((v / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t} className={`tab ${active === t ? 'active' : ''}`} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  )
}

export function Panel({ title, subtitle, actions, children, flush }) {
  return (
    <div className="panel">
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <div className="phsub">{subtitle}</div>}
          </div>
          <div className="spacer" />
          {actions}
        </div>
      )}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </div>
  )
}

export function Badge({ tone, children, title }) {
  return <span className={`badge ${tone}`} title={title}>{children}</span>
}

export function Progress({ pct, tone = '' }) {
  return (
    <div className="progress">
      <div className={`fill ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  )
}

export function Avatar({ name, size }) {
  const initials = name
    .split(' ')
    .filter((w) => /^[A-Za-z!]/.test(w))
    .slice(0, 2)
    .map((w) => w.replace(/^!/, '')[0])
    .join('')
    .toUpperCase()
  const style = size ? { width: size, height: size, fontSize: size * 0.38 } : {}
  return (
    <div className="avatar" style={style}>
      {initials}
    </div>
  )
}

export function Modal({ title, onClose, children, width = 480 }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="toast">
      <span>✅</span> {msg}
    </div>
  )
}

// hook: transient toast message
export function useToast() {
  const [msg, setMsg] = useState(null)
  const show = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2600)
  }
  return [msg, show]
}
