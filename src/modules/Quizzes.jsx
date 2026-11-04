import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import * as api from '../api.js'

// Live online quizzes. The lecturer writes questions on an assessment, opens it
// live, and watches who has started / submitted. Students answer in the portal
// against a countdown; answers autosave and the server marks them, so the score
// goes straight into the gradebook / CA. Backed by quiz_* RPCs (20261018120000).
// Matching, paragraph and answer-sheet upload questions + PDF question papers:
// 20261104120000. Paragraph and upload questions are marked by the lecturer.
export const QUIZ_STATUS = { draft: ['gray', 'Draft'], open: ['green', 'LIVE'], closed: ['blue', 'Closed'] }
const QTYPES = { mcq: 'Multiple choice', tf: 'True / false', match: 'Matching', short: 'Short answer', essay: 'Paragraph (long answer)', upload: 'Upload answer sheet' }
const MANUAL = ['essay', 'upload']

function Empty({ children }) { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }
const blankPairs = () => [{ l: '', r: '' }, { l: '', r: '' }, { l: '', r: '' }]
const blankQ = (kind = 'mcq') => ({ kind, prompt: '', options: ['', '', '', ''], pairs: blankPairs(), correct: '', marks: 1 })
const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const pj = (s, d) => { try { return JSON.parse(s) ?? d } catch { return d } }
const answered = (q, v) => (q.kind === 'match' ? pj(v, []).some(Boolean) : q.kind === 'upload' ? pj(v, []).length > 0 : (v ?? '') !== '')
const fileName = (path) => (path || '').split('/').pop().replace(/^\d+-/, '')
async function openFile(path, showToast) {
  try { const url = await api.courseFileUrl(path); if (url) window.open(url, '_blank', 'noopener') }
  catch (err) { showToast('Could not open file' + (err?.message ? `: ${err.message}` : '')) }
}

// ---- lecturer: write questions ----------------------------------------------
export function QuizBuilder({ assessment, onClose, onDone, showToast }) {
  const [quiz, setQuiz] = useState(null)
  const [qs, setQs] = useState([])
  const [busy, setBusy] = useState(false)
  const [paperBusy, setPaperBusy] = useState(false)
  useEffect(() => {
    api.quizGet(assessment.id).then((d) => {
      setQuiz(d || { status: 'draft' })
      setQs(d?.questions?.length ? d.questions.map((q) => ({
        ...q,
        options: q.kind === 'mcq' ? [...q.options, '', ''].slice(0, Math.max(4, q.options.length)) : ['', '', '', ''],
        pairs: q.kind === 'match' ? q.options.map((l, i) => ({ l, r: pj(q.correct, [])[i] || '' })) : blankPairs(),
      })) : [blankQ()])
    }).catch((e) => { showToast('Could not load the quiz: ' + (e?.message || e)); onClose() })
  }, [assessment.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const locked = quiz && quiz.status !== 'draft'
  const upd = (i, patch) => setQs((xs) => xs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
  const move = (i, d) => setQs((xs) => { const n = [...xs]; const j = i + d; if (j < 0 || j >= n.length) return xs; [n[i], n[j]] = [n[j], n[i]]; return n })
  const total = qs.reduce((s, q) => s + (Number(q.marks) || 0), 0)

  const setPaper = async (file) => {
    if (file && file.type && file.type !== 'application/pdf') { showToast('The question paper must be a PDF'); return }
    setPaperBusy(true)
    try {
      await api.quizSetPaper(assessment.id, file)
      const d = await api.quizGet(assessment.id)
      setQuiz((x) => ({ ...x, paper_path: d?.paper_path ?? null }))
      showToast(file ? 'Question paper uploaded' : 'Question paper removed')
    } catch (e) { showToast('Could not save the paper: ' + (e?.message || e)) }
    setPaperBusy(false)
  }

  const save = async () => {
    const clean = qs.map((q) => {
      if (q.kind !== 'match') return { ...q, options: q.options.map((o) => o.trim()).filter(Boolean) }
      const pairs = q.pairs.map((p) => ({ l: p.l.trim(), r: p.r.trim() })).filter((p) => p.l || p.r)
      return { ...q, pairs, options: pairs.map((p) => p.l), correct: JSON.stringify(pairs.map((p) => p.r)) }
    })
    for (const [i, q] of clean.entries()) {
      if (!q.prompt.trim()) { showToast(`Question ${i + 1} has no text`); return }
      if (q.kind === 'mcq' && q.options.length < 2) { showToast(`Question ${i + 1} needs at least 2 options`); return }
      if (q.kind === 'match') {
        if (q.pairs.some((p) => !p.l || !p.r)) { showToast(`Question ${i + 1}: every pair needs an item on both sides`); return }
        if (q.pairs.length < 2) { showToast(`Question ${i + 1}: add at least 2 pairs`); return }
      } else if (!MANUAL.includes(q.kind) && (q.correct === '' || q.correct == null)) { showToast(`Question ${i + 1}: mark the correct answer`); return }
    }
    setBusy(true)
    try { await api.quizSaveQuestions(assessment.id, clean); onDone(`${assessment.title}: ${clean.length} question${clean.length === 1 ? '' : 's'} saved (out of ${total})`) }
    catch (e) { showToast('Could not save: ' + (e?.message || e)); setBusy(false) }
  }

  return (
    <Modal title={`Questions — ${assessment.title}`} onClose={onClose} width={760}>
      {!quiz ? <Empty>Loading…</Empty> : <>
        {locked && <div className="note-banner"><Icon name="lock" size={16} /><div>This quiz has been opened, so the questions are locked. Students' answers were marked against these.</div></div>}
        <div className="panel" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong>Question paper (PDF, optional)</strong>
            {quiz.paper_path && <button className="btn ghost sm" onClick={() => openFile(quiz.paper_path, showToast)}>Open {fileName(quiz.paper_path)}</button>}
            {quiz.paper_path && <button className="btn ghost sm" disabled={paperBusy} onClick={() => window.confirm('Remove the question paper?') && setPaper(null)}>Remove</button>}
            <span style={{ flex: 1 }} />
            <input type="file" accept="application/pdf" disabled={paperBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setPaper(f) }} />
          </div>
          <div className="di-sub" style={{ marginTop: 4 }}>
            {paperBusy ? 'Uploading…' : 'Students can download it once the quiz is live — useful for maths, where they show their working on paper. Add an “Upload answer sheet” question so they can upload their scanned answers for you to mark.'}
          </div>
          {quiz.paper_path && !locked && !qs.some((q) => q.kind === 'upload') && (
            <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setQs((xs) => [...xs.filter((q) => q.prompt.trim()), { ...blankQ('upload'), prompt: 'Upload your answer sheet (photos or PDF of every page)', marks: 10 }])}>+ Add “Upload answer sheet” question</button>
          )}
        </div>
        <div style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: 4 }}>
          {qs.map((q, i) => (
            <div key={i} className="panel" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong>Q{i + 1}</strong>
                <select value={q.kind} disabled={locked} onChange={(e) => upd(i, { kind: e.target.value, correct: '' })}>{Object.entries(QTYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <label className="di-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Marks <input type="number" min="0.5" step="0.5" value={q.marks} disabled={locked} onChange={(e) => upd(i, { marks: e.target.value })} style={{ width: 64 }} /></label>
                {MANUAL.includes(q.kind) && <Badge tone="amber">You mark this</Badge>}
                <span style={{ flex: 1 }} />
                {!locked && <>
                  <button className="btn ghost sm" onClick={() => move(i, -1)} title="Move up">↑</button>
                  <button className="btn ghost sm" onClick={() => move(i, 1)} title="Move down">↓</button>
                  <button className="btn ghost sm" onClick={() => setQs((xs) => xs.filter((_, j) => j !== i))} disabled={qs.length === 1}>Remove</button>
                </>}
              </div>
              <textarea rows={q.kind === 'essay' ? 3 : 2} value={q.prompt} disabled={locked} onChange={(e) => upd(i, { prompt: e.target.value })} placeholder={q.kind === 'match' ? 'Instruction, e.g. Match each hazard to its control measure' : q.kind === 'upload' ? 'e.g. Answer questions 1–5 of the question paper and upload your answer sheets' : 'Question text'} style={{ width: '100%' }} />
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
              {q.kind === 'match' && <div style={{ marginTop: 6 }}>
                {q.pairs.map((p, k) => (
                  <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span className="di-sub" style={{ width: 18 }}>{k + 1}.</span>
                    <input value={p.l} disabled={locked} onChange={(e) => upd(i, { pairs: q.pairs.map((x, j) => (j === k ? { ...x, l: e.target.value } : x)) })} placeholder="Item" style={{ flex: 1 }} />
                    <span>→</span>
                    <input value={p.r} disabled={locked} onChange={(e) => upd(i, { pairs: q.pairs.map((x, j) => (j === k ? { ...x, r: e.target.value } : x)) })} placeholder="Its correct match" style={{ flex: 1 }} />
                    {!locked && <button className="btn ghost sm" onClick={() => upd(i, { pairs: q.pairs.filter((_, j) => j !== k) })} disabled={q.pairs.length <= 2}>×</button>}
                  </div>
                ))}
                {!locked && q.pairs.length < 12 && <button className="btn ghost sm" onClick={() => upd(i, { pairs: [...q.pairs, { l: '', r: '' }] })}>+ Pair</button>}
                <div className="di-sub">Students see the matches in a mixed-up order and pick one for each item. The marks are shared out per correct pair.</div>
              </div>}
              {q.kind === 'short' && <div style={{ marginTop: 6 }}>
                <input value={q.correct} disabled={locked} onChange={(e) => upd(i, { correct: e.target.value })} placeholder="Accepted answer(s), separated by |  e.g. green|light green" style={{ width: '100%' }} />
                <div className="di-sub">Marked correct if the student's answer matches one of these (not case-sensitive). You can adjust the mark when you review the attempt.</div>
              </div>}
              {MANUAL.includes(q.kind) && <div style={{ marginTop: 6 }}>
                <textarea rows={2} value={q.correct} disabled={locked} onChange={(e) => upd(i, { correct: e.target.value })} placeholder="Marking guide / model answer (optional — only you see this)" style={{ width: '100%' }} />
                <div className="di-sub">{q.kind === 'essay' ? 'Students type a long answer.' : 'Students upload photos or a PDF of their written answers.'} You mark it from the live monitor (“Mark”) once they submit; the rest of the quiz is marked automatically.</div>
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
        <div className="di-sub" style={{ marginBottom: 8 }}>Each student gets the time limit from the moment they start. After “closes after”, nobody can start or continue, and unfinished attempts are submitted with what they answered. 0 = no limit (you close it yourself). For a question paper, allow time to scan and upload the answer sheets.</div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}><input type="checkbox" checked={f.showResults} onChange={(e) => setF({ ...f, showResults: e.target.checked })} /> Show students their score as soon as they submit</label>
        <button className="btn primary" disabled={busy}>{busy ? 'Opening…' : 'Open quiz now'}</button>
      </form>
    </Modal>
  )
}

export function QuizMonitor({ assessment, onClose, onChanged, showToast }) {
  const [d, setD] = useState(null)
  const [marking, setMarking] = useState(null)   // student_id
  const load = useCallback(() => api.quizMonitor(assessment.id).then(setD).catch(() => {}), [assessment.id])
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t) }, [load])
  const close = async () => {
    if (!window.confirm('Close the quiz now? Anyone still writing is submitted with what they have answered.')) return
    try { await api.quizSetStatus(assessment.id, 'closed'); showToast('Quiz closed — marks are in the gradebook'); load(); onChanged() }
    catch (e) { showToast('Could not close: ' + (e?.message || e)) }
  }
  const st = d?.students || []
  const n = (k) => st.filter((s) => s.state === k).length
  const toMark = st.filter((s) => s.to_mark > 0).length
  const left = d?.closes_at ? new Date(d.closes_at) - new Date(d.now) : null
  const submitted = st.filter((s) => s.state === 'submitted')
  return (<>
    <Modal title={`Live monitor — ${assessment.title}`} onClose={onClose} width={680}>
      {!d ? <Empty>Loading…</Empty> : <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
          <Badge tone={QUIZ_STATUS[d.status]?.[0]}>{QUIZ_STATUS[d.status]?.[1]}</Badge>
          <span className="di-sub">{n('submitted')} submitted · {n('in_progress')} writing · {n('not_started')} not started{left != null && d.status === 'open' ? ` · closes in ${mmss(left)}` : ''}{toMark ? ` · ${toMark} to mark` : ''}</span>
          <span style={{ flex: 1 }} />
          {d.status === 'open' && <button className="btn primary sm" onClick={close}>Close quiz</button>}
        </div>
        {d.manual > 0 && <div className="di-sub" style={{ marginBottom: 8 }}>This quiz has {d.manual} question{d.manual === 1 ? '' : 's'} you mark yourself (paragraph / answer sheet). Click “Mark” next to a submitted student — the score updates the gradebook when you save.</div>}
        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          <table className="data">
            <thead><tr><th>Student</th><th>Status</th><th className="num">Answered</th><th className="num">Score /{d.max}</th><th /></tr></thead>
            <tbody>{st.map((s) => (
              <tr key={s.student_id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.state === 'submitted' ? (s.to_mark > 0 ? <Badge tone="amber">{s.to_mark} to mark</Badge> : <Badge tone="green">Submitted</Badge>) : s.state === 'in_progress' ? <Badge tone="amber">Writing</Badge> : <Badge tone="gray">Not started</Badge>}</td>
                <td className="num">{s.state === 'not_started' ? '—' : `${s.answered}/${d.questions}`}</td>
                <td className="num" style={{ fontWeight: 700 }}>{s.score ?? '—'}</td>
                <td>{s.state === 'submitted' && <button className={s.to_mark > 0 ? 'btn primary sm' : 'btn ghost sm'} onClick={() => setMarking(s.student_id)}>{s.to_mark > 0 ? 'Mark' : 'Review'}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="di-sub" style={{ marginTop: 8 }}>Refreshes every 5 seconds.</div>
      </>}
    </Modal>
      {marking && <QuizMarker assessment={assessment} studentId={marking} order={submitted.map((s) => s.student_id)}
        onNavigate={setMarking} onClose={() => setMarking(null)} onSaved={() => { load(); onChanged() }} showToast={showToast} />}
  </>)
}

// Lecturer: review one student's attempt; type marks for paragraph / upload
// answers and, if needed, override an automatic mark.
function QuizMarker({ assessment, studentId, order, onNavigate, onClose, onSaved, showToast }) {
  const [d, setD] = useState(null)
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setD(null)
    api.quizAttemptReview(assessment.id, studentId).then((x) => {
      setD(x); setVals(Object.fromEntries((x?.questions || []).map((q) => [q.id, q.manual ?? ''])))
    }).catch((e) => { showToast('Could not load the attempt: ' + (e?.message || e)); onClose() })
  }, [assessment.id, studentId]) // eslint-disable-line react-hooks/exhaustive-deps
  const qs = d?.questions || []
  const markOf = (q) => (vals[q.id] !== '' ? Number(vals[q.id]) : MANUAL.includes(q.kind) ? 0 : Number(q.auto))
  const total = qs.reduce((s, q) => s + (markOf(q) || 0), 0)
  const idx = order.indexOf(studentId)
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null

  const save = async (goNext) => {
    for (const [i, q] of qs.entries()) {
      const v = vals[q.id]
      if (v !== '' && (Number(v) < 0 || Number(v) > Number(q.marks))) { showToast(`Question ${i + 1}: mark must be between 0 and ${q.marks}`); return }
    }
    setBusy(true)
    try {
      const r = await api.quizMarkAttempt(assessment.id, studentId, Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])))
      showToast(`${d.name}: ${r?.score ?? total}/${d.max} saved${r?.pending ? ` · ${r.pending} still to mark` : ''}`)
      onSaved()
      if (goNext && next) onNavigate(next); else onClose()
    } catch (e) { showToast('Could not save: ' + (e?.message || e)) }
    setBusy(false)
  }

  return (
    <Modal title={d ? `Mark — ${d.name}` : 'Mark'} onClose={onClose} width={760}>
      {!d ? <Empty>Loading…</Empty> : <>
        <div className="di-sub" style={{ marginBottom: 8 }}>Leave a mark blank to keep the automatic mark. Paragraph and answer-sheet questions count 0 until you mark them.</div>
        <div style={{ maxHeight: '58vh', overflowY: 'auto', paddingRight: 4 }}>
          {qs.map((q, i) => (
            <div key={q.id} className="panel" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, fontWeight: 600, whiteSpace: 'pre-wrap' }}>{i + 1}. {q.prompt} <span className="di-sub">({QTYPES[q.kind]})</span></div>
                <label className="di-sub" style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  <input className="mark" type="number" min="0" max={q.marks} step="any" value={vals[q.id]} placeholder={MANUAL.includes(q.kind) ? '' : String(q.auto)}
                    onChange={(e) => setVals((v) => ({ ...v, [q.id]: e.target.value }))} style={{ width: 70 }} /> / {q.marks}
                </label>
              </div>
              <div style={{ marginTop: 6 }}><AnswerView q={q} showToast={showToast} /></div>
              {!MANUAL.includes(q.kind) && <div className="di-sub" style={{ marginTop: 4 }}>Automatic mark: {q.auto}/{q.marks}</div>}
              {MANUAL.includes(q.kind) && q.correct && <div className="di-sub" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>Marking guide: {q.correct}</div>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <span style={{ flex: 1, fontWeight: 700 }}>Total: {Math.round(total * 100) / 100} / {d.max}</span>
          {next && <button className="btn ghost" disabled={busy} onClick={() => save(true)}>Save &amp; next student</button>}
          <button className="btn primary" disabled={busy} onClick={() => save(false)}>{busy ? 'Saving…' : 'Save marks'}</button>
        </div>
      </>}
    </Modal>
  )
}

function AnswerView({ q, showToast }) {
  const a = q.answer
  const none = <span className="di-sub">No answer</span>
  if (q.kind === 'mcq') {
    const pick = a !== undefined && a !== null && a !== '' ? Number(a) : null
    return <div>{pick == null ? none : <span>{String.fromCharCode(65 + pick)}. {q.options[pick]}</span>}
      <div className="di-sub">Correct: {String.fromCharCode(65 + Number(q.correct))}. {q.options[Number(q.correct)]}</div></div>
  }
  if (q.kind === 'tf') return <div>{a ? (a === 'true' ? 'True' : 'False') : none}<div className="di-sub">Correct: {q.correct === 'true' ? 'True' : 'False'}</div></div>
  if (q.kind === 'short') return <div>{a ? <span>“{a}”</span> : none}<div className="di-sub">Accepted: {q.correct.split('|').join(' / ')}</div></div>
  if (q.kind === 'match') {
    const key = pj(q.correct, []); const mine = pj(a, [])
    return (
      <table className="data"><thead><tr><th>Item</th><th>Student's match</th><th>Correct match</th></tr></thead>
        <tbody>{q.options.map((l, k) => {
          const ok = (mine[k] || '').trim().toLowerCase() === (key[k] || '').trim().toLowerCase()
          return <tr key={k}><td>{l}</td><td>{mine[k] ? <>{ok ? '✓' : '✗'} {mine[k]}</> : '—'}</td><td className="di-sub">{key[k]}</td></tr>
        })}</tbody>
      </table>
    )
  }
  if (q.kind === 'essay') return a ? <div style={{ whiteSpace: 'pre-wrap', background: 'var(--surface-2, rgba(0,0,0,.03))', padding: 10, borderRadius: 6 }}>{a}</div> : none
  if (q.kind === 'upload') {
    const files = pj(a, [])
    return files.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{files.map((p) => <button key={p} className="btn ghost sm" onClick={() => openFile(p, showToast)}><Icon name="folder" size={12} /> {fileName(p)}</button>)}</div> : none
  }
  return a || none
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
            <div className="di-sub">{q.questions} question{q.questions === 1 ? '' : 's'} · out of {q.max}{q.time_limit_min ? ` · ${q.time_limit_min} min once you start` : ''}{q.has_paper ? ' · includes a question paper to download' : ''}</div></div>
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
                <td>{q.state === 'submitted' ? (q.pending > 0 ? <Badge tone="amber">Being marked</Badge> : <Badge tone="green">Submitted</Badge>) : <Badge tone="gray">Missed</Badge>}</td>
                <td className="num" style={{ fontWeight: 700 }}>{q.score != null ? `${q.score}/${q.max}${q.pending > 0 ? ' so far' : ''}` : q.state === 'submitted' ? 'After closing' : '—'}</td>
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
  const [uploading, setUploading] = useState(null)   // question id
  const pending = useRef({})
  const skew = useRef(0)           // server clock minus ours
  const submitted = useRef(false)

  useEffect(() => {
    api.quizStart(quiz.id).then((x) => {
      if (!x) return
      skew.current = new Date(x.now) - Date.now()
      setD(x); setAnswers(x.answers || {})
      if (x.submitted) { submitted.current = true; setResult({ score: x.score, max: x.max, pending: x.pending }) }
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
    try { const r = await api.quizSubmit(quiz.id, { ...answers, ...pending.current }); pending.current = {}; setResult({ score: r?.score, max: r?.max, pending: r?.pending, auto }) }
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
  const matchPick = (q, k, v) => {
    const cur = pj(answers[q.id], []); const n = q.options.map((_, j) => cur[j] || '')
    n[k] = v; answer(q.id, JSON.stringify(n))
  }
  const addSheets = async (q, files) => {
    if (!files.length) return
    setUploading(q.id)
    const paths = [...pj(answers[q.id], [])]
    try {
      for (const f of files) paths.push(await api.uploadCourseFile(`answers/${quiz.id}/${d.student_id}`, f))
      answer(q.id, JSON.stringify(paths)); await flush()
      showToast(`${files.length} file${files.length === 1 ? '' : 's'} uploaded`)
    } catch (e) {
      if (paths.length) answer(q.id, JSON.stringify(paths))
      showToast('Upload failed: ' + (e?.message || e))
    }
    setUploading(null)
  }
  const removeSheet = (q, p) => answer(q.id, JSON.stringify(pj(answers[q.id], []).filter((x) => x !== p)))
  const tryClose = () => {
    if (result || window.confirm('Leave the quiz? Your answers are saved and the timer keeps running — you can come back and continue.')) { flush(); onClose() }
  }
  const qs = d?.questions || []
  const done = qs.filter((q) => answered(q, answers[q.id])).length

  return (
    <Modal title={quiz.title} onClose={tryClose} width={720}>
      {!d ? <Empty>Loading…</Empty> : result ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Icon name="check" size={32} />
          <h3 style={{ margin: '10px 0 4px' }}>{result.auto ? 'Time is up — your quiz was submitted' : 'Quiz submitted'}</h3>
          {result.score != null ? <div style={{ fontSize: 28, fontWeight: 800 }}>{result.score} / {result.max}</div>
            : <div className="di-sub">Your lecturer will release the score when the quiz closes.</div>}
          {result.pending > 0 && <div className="di-sub" style={{ marginTop: 6 }}>Your lecturer still has to mark {result.pending} written answer{result.pending === 1 ? '' : 's'}{result.score != null ? ' — this is your score so far' : ''}.</div>}
          <button className="btn primary" style={{ marginTop: 16 }} onClick={onClose}>Done</button>
        </div>
      ) : <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, position: 'sticky', top: 0 }}>
          <span className="di-sub" style={{ flex: 1 }}>{done}/{qs.length} answered · answers save automatically</span>
          {left != null && <Badge tone={left < 60000 ? 'red' : 'gray'}><Icon name="clock" size={12} /> {mmss(left)}</Badge>}
        </div>
        {d.paper_path && <div className="note-banner">
          <Icon name="download" size={16} />
          <div style={{ flex: 1 }}><strong>Question paper</strong><div className="di-sub">Download it, write your answers on paper, then photograph or scan every page and upload them below before the time runs out.</div></div>
          <button className="btn primary sm" onClick={() => openFile(d.paper_path, showToast)}>Download paper</button>
        </div>}
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
              {q.kind === 'match' && q.options.map((l, k) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 200px' }}>{l}</span>
                  <select value={pj(answers[q.id], [])[k] || ''} onChange={(e) => matchPick(q, k, e.target.value)} style={{ flex: '1 1 200px' }}>
                    <option value="">— choose —</option>
                    {(q.choices || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
              {q.kind === 'short' && <input value={answers[q.id] || ''} onChange={(e) => answer(q.id, e.target.value)} placeholder="Your answer" maxLength={200} style={{ width: '100%' }} />}
              {q.kind === 'essay' && <>
                <textarea rows={8} value={answers[q.id] || ''} onChange={(e) => answer(q.id, e.target.value)} placeholder="Write your answer" maxLength={20000} style={{ width: '100%' }} />
                <div className="di-sub">{(answers[q.id] || '').trim().split(/\s+/).filter(Boolean).length} words · marked by your lecturer</div>
              </>}
              {q.kind === 'upload' && <>
                {pj(answers[q.id], []).map((p) => (
                  <div key={p} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <Icon name="folder" size={14} /><span style={{ flex: 1 }}>{fileName(p)}</span>
                    <button className="btn ghost sm" onClick={() => openFile(p, showToast)}>View</button>
                    <button className="btn ghost sm" onClick={() => removeSheet(q, p)}>Remove</button>
                  </div>
                ))}
                <input type="file" multiple accept="image/*,application/pdf" disabled={uploading === q.id}
                  onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; addSheets(q, fs) }} />
                <div className="di-sub">{uploading === q.id ? 'Uploading…' : 'Photos (one per page) or a PDF, up to 25 MB each · marked by your lecturer'}</div>
              </>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <span style={{ flex: 1 }} />
          <button className="btn primary" disabled={busy || !!uploading} onClick={() => {
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
