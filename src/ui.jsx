import React, { useState } from 'react'

// ---------------------------------------------------------------------------
// Icon system — stroke SVG line icons (no emojis in the UI chrome). Each icon
// is a set of SVG children keyed by a semantic name. `Icon` renders them at a
// consistent 1em size inheriting the current text colour.
// ---------------------------------------------------------------------------
const ICON_PATHS = {
  cap: <><path d="M2 8l10-4 10 4-10 4z" /><path d="M6 10v5c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-5" /><path d="M22 8v5" /></>,
  dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>,
  card: <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
  check: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
  building: <><polygon points="12 3 21 8 3 8 12 3" /><line x1="5" y1="8" x2="5" y2="21" /><line x1="9" y1="8" x2="9" y2="21" /><line x1="15" y1="8" x2="15" y2="21" /><line x1="19" y1="8" x2="19" y2="21" /><line x1="3" y1="21" x2="21" y2="21" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  bed: <><path d="M2 4v16" /><path d="M2 9h16a4 4 0 0 1 4 4v7" /><path d="M2 15h20" /><circle cx="7" cy="11" r="1.6" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  chart: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
  trendUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  trendDown: <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  ban: <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
  search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  package: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22" x2="12" y2="12" /></>,
  send: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  printer: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
  folder: <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></>,
  clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>,
  receipt: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></>,
  scroll: <><path d="M4 4h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" /><path d="M18 6h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2" /><line x1="8" y1="9" x2="14" y2="9" /><line x1="8" y1="13" x2="14" y2="13" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  mail: <><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  scale: <><line x1="12" y1="3" x2="12" y2="21" /><line x1="5" y1="7" x2="19" y2="7" /><path d="M5 7l-3 6a3 3 0 0 0 6 0z" /><path d="M19 7l3 6a3 3 0 0 1-6 0z" /><line x1="7" y1="21" x2="17" y2="21" /></>,
  flask: <><path d="M9 3h6" /><path d="M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" /></>,
  laptop: <><rect x="3" y="4" width="18" height="12" rx="1" /><line x1="2" y1="20" x2="22" y2="20" /></>,
  pin: <><path d="M12 21s-6-5.69-6-10a6 6 0 1 1 12 0c0 4.31-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  utensils: <><path d="M7 2v20" /><path d="M5 2v6a2 2 0 0 0 4 0V2" /><path d="M17 2c-1.5 0-2.5 2-2.5 5S16 12 17 12v10" /></>,
  star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></>,
  x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  undo: <><polyline points="9 14 4 9 9 4" /><path d="M20 20v-7a4 4 0 0 0-4-4H4" /></>,
  tick: <><polyline points="20 6 9 17 4 12" /></>,
  refresh: <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  dot: <><circle cx="12" cy="12" r="3.5" /></>,
}

// Emoji → semantic icon name. Anything not mapped falls back to a neutral dot;
// POS food emojis are intentionally left as-is (rendered directly, not here).
const GLYPH = {
  '🎓': 'cap', '💰': 'dollar', '💵': 'cash', '💳': 'card', '✅': 'check', '✓': 'check',
  '🏛': 'building', '🏛️': 'building', '🏫': 'building', '📚': 'book', '📕': 'book', '📗': 'book',
  '📒': 'book', '📜': 'scroll', '📝': 'edit', '✍': 'edit', '✍️': 'edit', '🏠': 'home', '🛏': 'bed', '🛏️': 'bed',
  '👤': 'user', '🧑': 'user', '🤝': 'users', '📊': 'chart', '📈': 'trendUp', '📉': 'trendDown',
  '📅': 'calendar', '🗓': 'calendar', '🗓️': 'calendar', '⚠': 'alert', '⚠️': 'alert', '🚫': 'ban', '⛔': 'ban',
  '🔒': 'lock', '🔔': 'bell', '🔍': 'search', '📦': 'package', '📤': 'send', '📨': 'send',
  '📣': 'send', '📢': 'send', '🖨': 'printer', '🖨️': 'printer', '🛒': 'cart', '🗂': 'folder', '🗂️': 'folder',
  '📋': 'clipboard', '🧾': 'receipt', '🎯': 'target', '⚙': 'settings', '⚙️': 'settings',
  '✉': 'mail', '✉️': 'mail', '⚖': 'scale', '⚖️': 'scale', '🧪': 'flask', '💻': 'laptop', '📌': 'pin',
  '⬇': 'download', '💧': 'dot', '📐': 'edit', '🍽': 'utensils', '🍽️': 'utensils', '★': 'star',
  '✕': 'x', '✗': 'x', '↩': 'undo', '⟳': 'refresh', 'ℹ️': 'info', 'ℹ': 'info',
  '🧑‍🏫': 'user', '🪑': 'home', '🌴': 'home', '⎋': 'x', '⬅': 'undo', '←': 'undo',
  '⏰': 'clock', '⌛': 'clock',
}

export function Icon({ name, glyph, size = 16, style, className }) {
  const key = name || GLYPH[glyph]
  const paths = ICON_PATHS[key]
  if (!paths) return glyph ? <span className="gs">{glyph}</span> : null
  return (
    <svg
      className={className}
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-hidden="true"
    >
      {paths}
    </svg>
  )
}

export function StatCard({ icon, label, value, delta, deltaTone = 'up', onClick }) {
  // `icon` is historically an emoji string; render it as a line icon.
  const rendered = typeof icon === 'string' ? <Icon glyph={icon} /> : icon
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="label">
        <span className="chip">{rendered}</span> {label}
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
          <button className="modal-x" onClick={onClose}><Icon name="x" size={16} /></button>
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
      <Icon name="check" size={15} /> {msg}
    </div>
  )
}

// Shown (in http/backend mode) on modules that still read demo data, so a real
// deployment never presents mock content as if it were live. `show` is passed by
// the module (typically isHttpMode()) to keep ui.jsx decoupled from the data layer.
export function MockDataNotice({ show }) {
  if (!show) return null
  return (
    <div className="banner" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' }}>
      <Icon name="alert" size={16} />
      <div><strong>Demo data</strong> — this module isn’t connected to live records yet; the figures below are sample data.</div>
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
