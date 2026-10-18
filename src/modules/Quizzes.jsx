import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import * as api from '../api.js'

// Live online quizzes. The lecturer writes questions on an assessment, opens it
// live, and watches who has started / submitted. Students answer in the portal
// against a countdown; answers autosave and the server marks them, so the score
// goes straight into the gradebook / CA. Backed by quiz_* RPCs (20261018120000).
export const QUIZ_STATUS = { draft: ['gray', 'Draft'], open: ['green', 'LIVE'], closed: ['blue', 'Closed'] }
const QTYPES = { mcq: 'Multiple choice', tf: 'True / false', short: 'Short answer' }

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }
const blankQ = () => ({ kind: 'mcq', prompt: '', options: ['', '', '', ''], correct: '', marks: 1 })
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

// ---- lecturer: write questions ----------------------------------------------
export function QuizBuilder({ assessment, onClose, onDone, showToast }) {
  const [quiz, setQuiz] = useState(null)
  const [qs, setQs] = useState([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api.quizGet(assessment.id).then((d) => {
      setQuiz(d || { status: 'draft' })
      setQs(d?.questions?.length ? d.questions.map((q) => ({ ...q, options: q.kind === 'mcq' ? [...q.options, '', ''].slice(0, Math.max(4, q.options.length)) : ['', '', '', ''] })) : [blankQ()])
    }).catch((e) => { showToast('Could not load the quiz: ' + (e?.message || e)); onClose() })
  }, [assessment.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const locked = quiz && quiz.status !== 'draft'
  const upd = (i, patch) => setQs((xs) => xs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const move = (i, d) => setQs((xs) => { const n = [...xs]; const j = i + d; if (j < 0 || j >= n.length) return xs; [n[i], n[j]] = [n[j], n[i]]; return n })
  const total = qs.reduce((s, q) => s + (Number(q.marks) || 0), 0)

  const save = async () => {
    const clean = qs.map((q) => ({ ...q, options: q.options.map((o) => o.trim()).filter(Boolean) }))
    for (const [i, q] of clean.entries()) {
      if (!q.prompt.trim()) { showToast(`Question ${i + 1} has no text`); return }
      if (q.kind === 'mcq' && q.options.length < 2) { showToast(`Question ${i + 1} needs at least 2 options`); return }
      if (q.correct === '' || q.correct == null) { showToast(`Question ${i + 1}: mark the correct answer`); return }
    }
    setBusy(true)
    try { await api.quizSaveQuestions(assessment.id, clean); onDone(`${assessment.title}: ${clean.length} question${clean.length === 1 ? '' : 's'} saved (out of ${total})`) }
    catch (e) { showToast('Could not save: ' + (e?.message || e)); setBusy(false) }
  }

  return (
    <Modal title={`Questions — ${assessment.title}`} onClose={onClose} width={720}>
      {!quiz ? <Empty>Loading…</Empty> : <>
        {locked && <div className="note-banner"><Icon name="lock" size={16} /><div>This quiz has been opened, so the questions are locked. Students' answers were marked against these.</div></div>}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {qs.map((q, i) => (
            <div key={i} className="panel" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong>Q{i + 1}</strong>
                <select value={q.kind} disabled={locked} onChange={(e) => upd(i, { kind: e.target.value, correct: '' })}>{Object.entries(QTYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <label className="di-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Marks <input type="number" min="0.5" step="0.5" value={q.marks} disabled={locked} onChange={(e) => upd(i, { marks: e.target.value })} style={{ width: 64 }} /></label>
                <span style={{ flex: 1 }} />
                {!locked && <>
                  <button className="btn ghost sm" onClick={() => move(i, -1)} title="Move up">↑</button>
                  <button className="btn ghost sm" onClick={() => move(i, 1)} title="Move down">↓</button>
                  <button className="btn ghost sm" onClick={() => setQs((xs) => xs.filter((_, j) => j !== i))} disabled={qs.length === 1}>Remove</button>
                </>}
              </div>
              <textarea rows={2} value={q.prompt} disabled={locked} onChange={(e) => upd(i, { prompt: e.target.value })} placeholder="Question text" style={{ width: '100%' }} />
              {q.kind === 'mcq' && <div style={{ marginTop: 6 }}>
                {q.options.map((o, k) => (
                  <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <input type="radio" name={`c${i}`} checked={q.correct === String(k)} disabled={locked || !o.trim()} onChange={() => upd(i, { correct: String(k) })} title="Correct answer" />
                    <input value={o} disabled={locked} onChange={(e) => upd(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Option ${String.fromCharCode(65 + k)}`} style={{ flex: 1 }} />
                  </div>
                ))}
                {!locked && q.options.length < 8 && <button className="btn ghost sm" onClick={() => upd(i, { options: [...q.options, ''] })}>+ Option</button>}
                <div className="di-sub">Tick the circle next to the correct option.</div>
              </div>}
              {q.kind === 'tf' && <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                {['true', 'false'].map((v) => <label key={v} style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="radio" name={`c${i}`} checked={q.correct === v} disabled={locked} onChange={() => upd(i, { correct: v })} /> {v === 'true' ? 'True' : 'False'} is correct</label>)}
              </div>}
              {q.kind === 'short' && <div style={{ marginTop: 6 }}>
                <input value={q.correct} disabled={locked} onChange={(e) => upd(i, { correct: e.target.value })} placeholder="Accepted answer(s), separated by |  e.g. green|light green" style={{ width: '100%' }} />
                <div className="di-sub">Marked correct if the student's answer matches one of these (not case-sensitive). You can adjust marks later in “Enter marks”.</div>
              </div>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          {!locked && <button className="btn ghost" onClick={() => setQs((xs) => [...xs, blankQ()])}>+ Add question</button>}
          <span className="di-sub" style={{ flex: 1 }}>{qs.length} question{qs.length === 1 ? '' : 's'} · out of {total}</span>
          {!locked && <button className="btn primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save questions'}</button>}
        </div>
      </>}
    </Modal>
  )
}

// ---- lecturer: open live + monitor ------------------------------------------
export function QuizGoLive({ assessment, onClose, onDone, showToast }) {
  const [f, setF] = useState({ timeLimit: 20, closesIn: 60, showResults: true })
  const [busy, setBusy] = useState(false)
  const open = async (e) => {
    e.preventDefault(); setBusy(true)
    try { await api.quizSetStatus(assessment.id, 'open', f); onDone(`${assessment.title} is live — students can start it now`) }
    catch (err) { showToast('Could not open: ' + (err?.message || err)); setBusy(false) }
  }
  return (
    <Modal title={`Go live — ${assessment.title}`} onClose={onClose} width={460}>
      <form onSubmit={open}>
        <div className="grid2">
          <div className="field"><label>Time per student (minutes)</label><input type="number" min="0" value={f.timeLimit} onChange={(e) => setF({ ...f, timeLimit: e.target.value })} /></div>
          <div className="field"><label>Closes after (minutes)</label><input type="number" min="0" value={f.closesIn} onChange={(e) => setF({ ...f, closesIn: e.target.value })} /></div>
        </div>
        <div className="di-sub" style={{ marginBottom: 8 }}>Each student gets the time limit from the moment they start. After “closes after”, nobody can start or continue, and unfinished attempts are submitted with what they answered. 0 = no limit (you close it yourself).</div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}><input type="checkbox" checked={f.showResults} onChange={(e) => setF({ ...f, showResults: e.target.checked })} /> Show students their score as soon as they submit</label>
        <button className="btn primary" disabled={busy}>{busy ? 'Opening…' : 'Open quiz now'}</button>
      </form>
    </Modal>
  )
}

export function QuizMonitor({ assessment, onClose, onChanged, showToast }) {
  const [d, setD] = useState(null)
  const load = useCallback(() => api.quizMonitor(assessment.id).then(setD).catch(() => {}), [assessment.id])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  const close = async () => {
    if (!window.confirm('Close the quiz now? Anyone still writing is submitted with what they have answered.')) return
    try { await api.quizSetStatus(assessment.id, 'closed'); showToast('Quiz closed — marks are in the gradebook'); load(); onChanged() }
    catch (e) { showToast('Could not close: ' + (e?.message || e)) }
  }
  const st = d?.students || []
  const n = (k) => st.filter((s) => s.state === k).length
  const left = d?.closes_at ? new Date(d.closes_at) - new Date(d.now) : null
  return (
    <Modal title={`Live monitor — ${assessment.title}`} onClose={onClose} width={640}>
      {!d ? <Empty>Loading…</Empty> : <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <Badge tone={QUIZ_STATUS[d.status]?.[0]}>{QUIZ_STATUS[d.status]?.[1]}</Badge>
          <span className="di-sub">{n('submitted')} submitted · {n('in_progress')} writing · {n('not_started')} not started{left != null && d.status === 'open' ? ` · closes in ${mmss(left)}` : ''}</span>
          <span style={{ flex: 1 }} />
          {d.status === 'open' && <button className="btn primary sm" onClick={close}>Close quiz</button>}
        </div>
        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          <table className="data">
            <thead><tr><th>Student</th><th>Status</th><th className="num">Answered</th><th className="num">Score /{d.max}</th></tr></thead>
            <tbody>{st.map((s) => (
              <tr key={s.student_id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.state === 'submitted' ? <Badge tone="green">Submitted</Badge> : s.state === 'in_progress' ? <Badge tone="amber">Writing</Badge> : <Badge tone="gray">Not started</Badge>}</td>
                <td className="num">{s.state === 'not_started' ? '—' : `${s.answered}/${d.questions}`}</td>
                <td className="num" style={{ fontWeight: 700 }}>{s.score ?? '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="di-sub" style={{ marginTop: 8 }}>Refreshes every 5 seconds.</div>
      </>}
    </Modal>
  )
}

// ---- student ----------------------------------------------------------------
export function StudentQuizzes() {
  const [items, setItems] = useState(null)
  const [taking, setTaking] = useState(null)
  const load = useCallback(() => api.listMyQuizzes().then(setItems).catch(() => setItems([])), [])
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [load])
  const live = (items || []).filter((q) => q.status === 'open' && q.state !== 'submitted')
  const rest = (items || []).filter((q) => !(q.status === 'open' && q.state !== 'submitted'))
  return (
    <>
      {live.map((q) => (
        <div key={q.id} className="note-banner" style={{ borderColor: 'var(--green)' }}>
          <Icon name="clipboard" size={16} />
          <div style={{ flex: 1 }}><Badge tone="green">LIVE QUIZ</Badge> <strong>{q.code}</strong> — {q.title}
            <div className="di-sub">{q.questions} question{q.questions === 1 ? '' : 's'} · out of {q.max}{q.time_limit_min ? ` · ${q.time_limit_min} min once you start` : ''}</div></div>
          <button className="btn primary" onClick={() => setTaking(q)}>{q.state === 'in_progress' ? 'Continue' : 'Start quiz'}</button>
        </div>
      ))}
      <Panel title="My online quizzes" subtitle="Quizzes your lecturers open live appear here" flush>
        {items === null ? <Empty>Loading…</Empty> : items.length === 0 ? <Empty>No online quizzes yet. When a lecturer opens one, it shows up here.</Empty>
          : rest.length === 0 ? <Empty>Nothing finished yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Module</th><th>Quiz</th><th>Status</th><th className="num">Score</th></tr></thead>
            <tbody>{rest.map((q) => (
              <tr key={q.id}>
                <td><span className="mono">{q.code}</span> <span className="di-sub">{q.course_title}</span></td>
                <td style={{ fontWeight: 600 }}>{q.title}</td>
                <td>{q.state === 'submitted' ? <Badge tone="green">Submitted</Badge> : <Badge tone="gray">Missed</Badge>}</td>
                <td className="num" style={{ fontWeight: 700 }}>{q.score != null ? `${q.score}/${q.max}` : q.state === 'submitted' ? 'After closing' : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      {taking && <QuizTaker quiz={taking} onClose={() => { setTaking(null); load() }} />}
    </>
  )
}

function QuizTaker({ quiz, onClose }) {
  const [toast, showToast] = useToast()
  const [d, setD] = useState(null)
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [left, setLeft] = useState(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef({})
  const skew = useRef(0)           // server clock minus ours
  const submitted = useRef(false)

  useEffect(() => {
    api.quizStart(quiz.id).then((x) => {
      if (!x) return
      skew.current = new Date(x.now) - Date.now()
      setD(x); setAnswers(x.answers || {})
      if (x.submitted) { submitted.current = true; setResult({ score: x.score, max: x.max }) }
    }).catch((e) => { showToast('Could not start: ' + (e?.message || e)) })
  }, [quiz.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    const batch = pending.current; if (!Object.keys(batch).length) return
    pending.current = {}
    try { await api.quizSaveAnswers(quiz.id, batch) } catch { pending.current = { ...batch, ...pending.current } }
  }, [quiz.id])
  useEffect(() => { const t = setInterval(flush, 3000); return () => clearInterval(t) }, [flush])

  const submit = useCallback(async (auto = false) => {
    if (submitted.current) return
    submitted.current = true; setBusy(true)
    try { const r = await api.quizSubmit(quiz.id, { ...answers, ...pending.current }); pending.current = {}; setResult({ score: r?.score, max: r?.max, auto }) }
    catch (e) { submitted.current = false; showToast('Could not submit: ' + (e?.message || e) + ' — try again'); setBusy(false) }
  }, [quiz.id, answers]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!d?.deadline || result) return
    const tick = () => {
      const ms = new Date(d.deadline) - (Date.now() + skew.current)
      setLeft(ms)
      if (ms <= 0) submit(true)
    }
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [d, result, submit])

  const answer = (qid, v) => { setAnswers((a) => ({ ...a, [qid]: v })); pending.current[qid] = v }
  const tryClose = () => {
    if (result || window.confirm('Leave the quiz? Your answers are saved and the timer keeps running — you can come back and continue.')) { flush(); onClose() }
  }
  const qs = d?.questions || []
  const done = qs.filter((q) => (answers[q.id] ?? '') !== '').length

  return (
    <Modal title={quiz.title} onClose={tryClose} width={680}>
      {!d ? <Empty>Loading…</Empty> : result ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Icon name="check" size={32} />
          <h3 style={{ margin: '10px 0 4px' }}>{result.auto ? 'Time is up — your quiz was submitted' : 'Quiz submitted'}</h3>
          {result.score != null ? <div style={{ fontSize: 28, fontWeight: 800 }}>{result.score} / {result.max}</div>
            : <div className="di-sub">Your lecturer will release the score when the quiz closes.</div>}
          <button className="btn primary" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
        </div>
      ) : <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, position: 'sticky', top: 0 }}>
          <span className="di-sub" style={{ flex: 1 }}>{done}/{qs.length} answered · answers save automatically</span>
          {left != null && <Badge tone={left < 60000 ? 'red' : 'gray'}><Icon name="clock" size={12} /> {mmss(left)}</Badge>}
        </div>
        <div style={{ maxHeight: '58vh', overflowY: 'auto', paddingRight: 4 }}>
          {qs.map((q, i) => (
            <div key={q.id} className="panel" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{i + 1}. {q.prompt} <span className="di-sub">({q.marks} mark{Number(q.marks) === 1 ? '' : 's'})</span></div>
              {q.kind === 'mcq' && q.options.map((o, k) => (
                <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', cursor: 'pointer' }}>
                  <input type="radio" name={q.id} checked={answers[q.id] === String(k)} onChange={() => answer(q.id, String(k))} /> <span><strong>{String.fromCharCode(65 + k)}.</strong> {o}</span>
                </label>
              ))}
              {q.kind === 'tf' && ['true', 'false'].map((v) => (
                <label key={v} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', cursor: 'pointer' }}>
                  <input type="radio" name={q.id} checked={answers[q.id] === v} onChange={() => answer(q.id, v)} /> {v === 'true' ? 'True' : 'False'}
                </label>
              ))}
              {q.kind === 'short' && <input value={answers[q.id] || ''} onChange={(e) => answer(q.id, e.target.value)} placeholder="Your answer" maxLength={200} style={{ width: '100%' }} />}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <span style={{ flex: 1 }} />
          <button className="btn primary" disabled={busy} onClick={() => {
            const missing = qs.length - done
            if (missing && !window.confirm(`${missing} question${missing === 1 ? ' is' : 's are'} not answered. Submit anyway?`)) return
            submit(false)
          }}>{busy ? 'Submitting…' : 'Submit quiz'}</button>
        </div>
      </>}
      <Toast msg={toast} />
    </Modal>
  )
}
