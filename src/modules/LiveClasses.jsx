import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import * as api from '../api.js'

// Online classes. Lecturer: schedule a class (meeting link is a Google Meet (or Zoom/Teams)
// link the lecturer pastes), start/end it, and record it — either in the
// browser (screen + microphone, uploaded in ~8 minute parts) or by pasting the
// link of a recording made elsewhere. Student: join live classes, replay recordings.

const PART_MS = 8 * 60 * 1000   // each part stays well under the 25 MB bucket limit
const STATUS = { scheduled: ['blue', 'Scheduled'], live: ['green', 'LIVE'], ended: ['gray', 'Ended'], cancelled: ['red', 'Cancelled'] }

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }
const fmtWhen = (iso) => { try { return new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return iso } }
const toLocalInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16) }

// ---------------------------------------------------------------- lecturer
export function LiveClassesTab({ course }) {
  const [toast, showToast] = useToast()
  const [items, setItems] = useState(null)
  const [edit, setEdit] = useState(null)
  const [recFor, setRecFor] = useState(null)
  const load = useCallback(() => api.listClassSessions(course.id).then(setItems).catch(() => setItems([])), [course.id])
  useEffect(() => { setItems(null); load() }, [load])

  const setStatus = async (s, status) => {
    try { await api.classSessionSetStatus(s.id, status); if (status === 'live' && s.meetingUrl) window.open(s.meetingUrl, '_blank', 'noopener'); load() }
    catch (e) { showToast('Could not update: ' + (e?.message || e)) }
  }
  const remove = async (s) => {
    if (!window.confirm(`Delete the class "${s.title}"?`)) return
    try { await api.classSessionDelete(s.id); load() } catch (e) { showToast('Could not delete: ' + (e?.message || e)) }
  }

  return (
    <>
      <div className="note-banner">
        <Icon name="info" size={16} />
        <div><strong>1.</strong> Create a Google Meet at meet.google.com/new, then schedule the class here with that link — students see it straight away. <strong>2.</strong> Press <strong>Start class</strong>: your Meet opens in a new tab and students get a Join button. <strong>3.</strong> Use <strong>Record</strong> to capture it (share the class tab with audio) — recordings appear for the students when the class ends.</div>
      </div>
      <Panel title={`Live classes — ${course.code}`} actions={<button className="btn primary sm" onClick={() => setEdit({})}>+ Schedule class</button>} flush>
        {items === null ? <Empty>Loading…</Empty> : items.length === 0 ? <Empty>No classes scheduled yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Class</th><th>When</th><th>Status</th><th>Recording</th><th style={{ width: 330 }}>Action</th></tr></thead>
            <tbody>{items.map((s) => {
              const [tone, label] = STATUS[s.status] || STATUS.scheduled
              const hasRec = !!s.recordingUrl || s.recordingPaths.length > 0
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.title}{s.notes && <div className="di-sub">{s.notes}</div>}</td>
                  <td className="mono">{fmtWhen(s.startsAt)}<div className="di-sub">{s.durationMin} min</div></td>
                  <td><Badge tone={tone}>{label}</Badge></td>
                  <td>{hasRec ? <Badge tone="green">{s.recordingPaths.length ? `${s.recordingPaths.length} part${s.recordingPaths.length > 1 ? 's' : ''}` : ''}{s.recordingUrl && s.recordingPaths.length ? ' + link' : s.recordingUrl ? 'Link' : ''}</Badge> : <span className="di-sub">—</span>}</td>
                  <td><span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {s.status === 'scheduled' && <button className="btn primary sm" onClick={() => setStatus(s, 'live')}>Start class</button>}
                    {s.status === 'live' && <>
                      <button className="btn ghost sm" onClick={() => window.open(s.meetingUrl, '_blank', 'noopener')}>Open room</button>
                      <button className="btn primary sm" onClick={() => setRecFor(s)}>Record</button>
                      <button className="btn ghost sm" onClick={() => setStatus(s, 'ended')}>End class</button>
                    </>}
                    {s.status === 'ended' && <button className="btn ghost sm" onClick={() => setRecFor(s)}>Recording</button>}
                    {s.status !== 'live' && <button className="btn ghost sm" onClick={() => setEdit(s)}>Edit</button>}
                    <button className="btn ghost sm" onClick={() => remove(s)}>Delete</button>
                  </span></td>
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </Panel>
      {edit && <SessionModal course={course} item={edit} onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); showToast(m); load() }} showToast={showToast} />}
      {recFor && <RecordModal session={recFor} onClose={() => { setRecFor(null); load() }} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

function SessionModal({ course, item, onClose, onDone, showToast }) {
  const [f, setF] = useState({
    title: item.title || '', startsAt: toLocalInput(item.startsAt || Date.now()), durationMin: item.durationMin || 60,
    meetingUrl: item.id ? item.meetingUrl || '' : '', notes: item.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    if (!f.title.trim()) { showToast('Give the class a title'); return }
    if (!/^https?:\/\//i.test(f.meetingUrl.trim())) { showToast('Paste the Google Meet link (create it at meet.google.com/new)'); return }
    setBusy(true)
    try { await api.classSessionUpsert({ id: item.id || null, courseId: course.id, ...f }); onDone(item.id ? 'Class updated' : 'Class scheduled') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)); setBusy(false) }
  }
  return (
    <Modal title={item.id ? 'Edit class' : 'Schedule a class'} onClose={onClose} width={500}>
      <form onSubmit={save}>
        <div className="field"><label>Title</label><input value={f.title} onChange={set('title')} placeholder="e.g. Lecture 3 — Fire safety" maxLength={120} autoFocus /></div>
        <div className="grid2">
          <div className="field"><label>Starts</label><input type="datetime-local" value={f.startsAt} onChange={set('startsAt')} /></div>
          <div className="field"><label>Duration (min)</label><input type="number" min="15" step="5" value={f.durationMin} onChange={set('durationMin')} /></div>
        </div>
        <div className="field"><label>Meeting link <span className="di-sub">(Google Meet — open meet.google.com/new, copy the link and paste it here)</span></label><input value={f.meetingUrl} onChange={set('meetingUrl')} placeholder="https://meet.google.com/abc-defg-hij" /></div>
        <div className="field"><label>Notes for students <span className="di-sub">(optional)</span></label><textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Topics, what to bring…" /></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </Modal>
  )
}

// In-browser recorder: screen/tab (with its audio) + microphone → webm parts.
function RecordModal({ session, onClose, showToast }) {
  const [state, setState] = useState('idle')          // idle | recording | finishing
  const [parts, setParts] = useState(0)
  const [secs, setSecs] = useState(0)
  const [link, setLink] = useState(session.recordingUrl || '')
  const [err, setErr] = useState('')
  const ref = useRef({ streams: [], ctx: null, rec: null, timer: null, cut: null, stopping: false, n: 0, pending: [] })
  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined'

  const cleanup = () => {
    const r = ref.current
    clearInterval(r.timer); clearTimeout(r.cut)
    r.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
    try { r.ctx?.close() } catch { /* ignore */ }
    r.streams = []; r.ctx = null
  }
  useEffect(() => () => cleanup(), [])
  useEffect(() => {
    if (state !== 'recording') return undefined
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [state])

  const pickMime = () => ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported?.(m)) || ''

  const startSegment = (stream) => {
    const r = ref.current
    const mimeType = pickMime()
    const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 250000, audioBitsPerSecond: 32000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' })
      const no = ++r.n
      if (blob.size > 0) {
        const p = api.uploadClassRecordingPart(session, blob, no).then(() => setParts((x) => x + 1)).catch((e) => { setErr('A part failed to upload: ' + (e?.message || e)); showToast('A recording part failed to upload') })
        r.pending.push(p)
      }
      if (!r.stopping) startSegment(stream)
    }
    rec.start(10000)
    r.rec = rec
    r.cut = setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, PART_MS)
  }

  const start = async () => {
    setErr('')
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10, width: { max: 1280 } }, audio: true })
      let mic = null
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { /* mic optional */ }
      const r = ref.current
      r.streams = [display, ...(mic ? [mic] : [])]
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const dest = ctx.createMediaStreamDestination()
      let audioSources = 0
      ;[display, mic].filter(Boolean).forEach((s) => { if (s.getAudioTracks().length) { ctx.createMediaStreamSource(s).connect(dest); audioSources++ } })
      r.ctx = ctx
      const stream = new MediaStream([...display.getVideoTracks(), ...(audioSources ? dest.stream.getAudioTracks() : [])])
      display.getVideoTracks()[0].addEventListener('ended', () => stop())
      r.stopping = false; r.n = parts; r.pending = []
      startSegment(stream)
      setSecs(0); r.timer = setInterval(() => setSecs((x) => x + 1), 1000)
      setState('recording')
      if (!display.getAudioTracks().length) setErr('The shared screen has no audio — tick “Share tab audio” when choosing the class tab, or students will only hear your microphone.')
    } catch (e) { cleanup(); setErr(e?.name === 'NotAllowedError' ? 'Recording was cancelled — nothing was shared.' : 'Could not start recording: ' + (e?.message || e)) }
  }

  const stop = async () => {
    const r = ref.current
    if (r.stopping) return
    r.stopping = true; setState('finishing')
    clearTimeout(r.cut); clearInterval(r.timer)
    if (r.rec && r.rec.state !== 'inactive') r.rec.stop()
    await new Promise((res) => setTimeout(res, 400))
    await Promise.allSettled(r.pending)
    cleanup(); setState('idle'); showToast('Recording saved')
  }

  const saveLink = async () => {
    try { await api.classSessionSetRecording(session.id, link, null); showToast('Recording link saved') } catch (e) { showToast('Could not save: ' + (e?.message || e)) }
  }
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'); const ss = String(secs % 60).padStart(2, '0')

  return (
    <Modal title={`Recording — ${session.title}`} onClose={() => { if (state === 'idle') onClose(); else showToast('Stop the recording first') }} width={560}>
      {supported ? (
        <div className="note-banner" style={{ display: 'block' }}>
          <strong>Record in the portal.</strong> Press Start, choose the browser <em>tab</em> with the class, tick <em>Share tab audio</em>. Your microphone is mixed in. Keep this window open until you press Stop; it uploads in 8-minute parts.
          <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
            {state === 'idle' && <button className="btn primary" onClick={start}>● Start recording</button>}
            {state === 'recording' && <><button className="btn primary" onClick={stop}>■ Stop &amp; save</button><Badge tone="red">REC {mm}:{ss}</Badge></>}
            {state === 'finishing' && <span className="di-sub">Uploading the last part… do not close this window.</span>}
            <span className="di-sub">{parts + session.recordingPaths.length} part(s) saved</span>
          </div>
          {err && <div style={{ marginTop: 8, color: 'var(--red)' }}>{err}</div>}
        </div>
      ) : <div className="note-banner"><Icon name="info" size={16} /><div>This browser can't record the screen. Use Chrome or Edge on a computer, or paste a recording link below.</div></div>}
      <div className="field" style={{ marginTop: 14 }}>
        <label>Or paste a recording link <span className="di-sub">(Zoom cloud recording, YouTube unlisted, Google Drive…)</span></label>
        <div style={{ display: 'flex', gap: 8 }}><input style={{ flex: 1 }} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /><button className="btn ghost" onClick={saveLink}>Save link</button></div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- student
export function StudentClasses() {
  const [toast, showToast] = useToast()
  const [items, setItems] = useState(null)
  const [watch, setWatch] = useState(null)
  const load = useCallback(() => api.listClassSessions(null).then(setItems).catch(() => setItems([])), [])
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])
  const live = (items || []).filter((s) => s.status === 'live')
  const upcoming = (items || []).filter((s) => s.status === 'scheduled').sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  const past = (items || []).filter((s) => s.status === 'ended')
  return (
    <>
      {live.map((s) => (
        <div key={s.id} className="note-banner" style={{ borderColor: 'var(--green)' }}>
          <Icon name="send" size={16} />
          <div style={{ flex: 1 }}><Badge tone="green">LIVE NOW</Badge> <strong>{s.code}</strong> — {s.title}<div className="di-sub">{s.courseTitle}</div></div>
          <button className="btn primary" onClick={() => window.open(s.meetingUrl, '_blank', 'noopener')}>Join class</button>
        </div>
      ))}
      <div className="grid2">
        <Panel title="Upcoming classes" flush>
          {items === null ? <Empty>Loading…</Empty> : upcoming.length === 0 ? <Empty>No classes scheduled.</Empty> : (
            <table className="data"><thead><tr><th>Class</th><th>When</th><th /></tr></thead>
              <tbody>{upcoming.map((s) => (
                <tr key={s.id}><td style={{ fontWeight: 600 }}><span className="mono">{s.code}</span> {s.title}{s.notes && <div className="di-sub">{s.notes}</div>}</td><td className="mono">{fmtWhen(s.startsAt)}</td>
                  <td><button className="btn ghost sm" onClick={() => window.open(s.meetingUrl, '_blank', 'noopener')}>Open link</button></td></tr>
              ))}</tbody></table>
          )}
        </Panel>
        <Panel title="Recorded classes" subtitle="Replay any class you missed" flush>
          {items === null ? <Empty>Loading…</Empty> : past.length === 0 ? <Empty>No past classes yet.</Empty> : (
            <table className="data"><thead><tr><th>Class</th><th>Date</th><th /></tr></thead>
              <tbody>{past.map((s) => {
                const has = !!s.recordingUrl || s.recordingPaths.length > 0
                return (
                  <tr key={s.id}><td style={{ fontWeight: 600 }}><span className="mono">{s.code}</span> {s.title}</td><td className="mono">{fmtWhen(s.startsAt)}</td>
                    <td>{has ? <button className="btn primary sm" onClick={() => setWatch(s)}>Watch</button> : <span className="di-sub">No recording</span>}</td></tr>
                )
              })}</tbody></table>
          )}
        </Panel>
      </div>
      {watch && <WatchModal session={watch} onClose={() => setWatch(null)} showToast={showToast} />}
      <Toast msg={toast} />
    </>
  )
}

function WatchModal({ session, onClose, showToast }) {
  const [urls, setUrls] = useState([])
  const [i, setI] = useState(0)
  useEffect(() => {
    let alive = true
    Promise.all(session.recordingPaths.map((p) => api.courseFileUrl(p, 3600))).then((u) => { if (alive) setUrls(u.filter(Boolean)) }).catch((e) => showToast('Could not open the recording: ' + (e?.message || e)))
    return () => { alive = false }
  }, [session, showToast])
  return (
    <Modal title={`${session.code} — ${session.title}`} onClose={onClose} width={760}>
      {urls.length > 0 && (
        <>
          <video key={urls[i]} src={urls[i]} controls autoPlay style={{ width: '100%', background: '#000', borderRadius: 8 }} onEnded={() => setI((x) => (x + 1 < urls.length ? x + 1 : x))} />
          {urls.length > 1 && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}><span className="di-sub">Parts:</span>{urls.map((_, n) => <button key={n} className={`btn ${n === i ? 'primary' : 'ghost'} sm`} onClick={() => setI(n)}>{n + 1}</button>)}<span className="di-sub">(plays on automatically)</span></div>}
        </>
      )}
      {session.recordingPaths.length > 0 && urls.length === 0 && <Empty>Loading the recording…</Empty>}
      {session.recordingUrl && <div style={{ marginTop: 12 }}><a className="btn ghost" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">Open recording link ↗</a></div>}
    </Modal>
  )
}
