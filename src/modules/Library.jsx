import React, { useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Toast, useToast, Modal } from '../ui.jsx'
import { LIBRARY_STATS, CATALOGUE, LOANS, FINES, RESERVATIONS, fmtN } from '../data.js'

const CAT_TONE = { Textbook: 'teal', Literature: 'purple', Reference: 'blue', Biography: 'amber' }
const LOAN_TONE = { 'On Loan': 'blue', 'Due Soon': 'orange', Overdue: 'red' }

export default function Library() {
  const [tab, setTab] = useState('Catalogue')
  // shared so returning a loan replenishes catalogue availability
  const [books, setBooks] = useState(CATALOGUE)
  const [loans, setLoans] = useState(LOANS)
  const [fines, setFines] = useState(FINES)
  const [showIssue, setShowIssue] = useState(false)
  const [toast, showToast] = useToast()

  const TODAY = new Date('2026-07-04')
  const fmtDate = (d) => d.toLocaleDateString('en-NA', { day: '2-digit', month: 'short', year: 'numeric' })

  const bumpAvail = (title, d) =>
    setBooks((bs) => bs.map((b) => (b.title === title ? { ...b, avail: Math.max(0, Math.min(b.total, b.avail + d)) } : b)))

  const issueBook = (e) => {
    e.preventDefault()
    const f = e.target
    const title = f.book.value
    const loan = {
      id: Date.now(),
      book: title,
      borrower: f.borrower.value || 'New borrower',
      grade: f.grade.value,
      issued: '04 Jul 2026',
      due: '18 Jul 2026',
      status: 'On Loan',
    }
    setLoans((ls) => [loan, ...ls])
    bumpAvail(title, -1)
    setShowIssue(false)
    setTab('Active Loans')
    showToast(`"${title}" issued to ${loan.borrower} — due 18 Jul`)
  }

  const returnBook = (id) => {
    const l = loans.find((l) => l.id === id)
    setLoans((ls) => ls.filter((l) => l.id !== id))
    bumpAvail(l.book, +1)
    // overdue return → fine auto-created at N$2/day
    const days = Math.ceil((TODAY - new Date(l.due)) / 86400000)
    if (days > 0) {
      setFines((fs) => [{ id: Date.now(), borrower: l.borrower, book: l.book, days }, ...fs])
      showToast(`"${l.book}" returned ${days}d late — fine of ${fmtN(days * 2)} created`)
    } else {
      showToast(`"${l.book}" returned by ${l.borrower} — back in catalogue`)
    }
  }

  const renewLoan = (id) => {
    const l = loans.find((l) => l.id === id)
    const newDue = new Date(new Date(l.due).getTime() + 14 * 86400000)
    setLoans((ls) => ls.map((x) => (x.id === id ? { ...x, due: fmtDate(newDue), status: 'On Loan' } : x)))
    showToast(`"${l.book}" renewed — now due ${fmtDate(newDue)}`)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
        <button className="btn primary sm" onClick={() => setShowIssue(true)}>+ Issue book</button>
      </div>
      <Tabs tabs={['Catalogue', 'Active Loans', 'Reservations', 'Fines']} active={tab} onChange={setTab} />
      {tab === 'Catalogue' && <Catalogue books={books} loans={loans} showToast={showToast} />}
      {tab === 'Active Loans' && <Loans loans={loans} onReturn={returnBook} onRenew={renewLoan} showToast={showToast} />}
      {tab === 'Reservations' && <Reservations books={books} showToast={showToast} />}
      {tab === 'Fines' && <Fines fines={fines} setFines={setFines} showToast={showToast} />}

      {showIssue && (
        <Modal title="Issue book" onClose={() => setShowIssue(false)}>
          <form onSubmit={issueBook}>
            <div className="field">
              <label>Book (available copies)</label>
              <select name="book">
                {books.filter((b) => b.avail > 0).map((b) => (
                  <option key={b.isbn} value={b.title}>{b.title} — {b.avail} left</option>
                ))}
              </select>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Borrower</label><input name="borrower" placeholder="Student or staff name" required /></div>
              <div className="field">
                <label>Programme</label>
                <select name="grade">
                  <option>8A</option><option>9C</option><option>10B</option><option>11A</option>
                  <option>12A</option><option>Voc</option><option value="—">Staff</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Loan period: 14 days · due 18 Jul 2026 · fine N$ 2 per overdue day
            </div>
            <button className="btn primary" type="submit">Issue</button>
          </form>
        </Modal>
      )}

      <Toast msg={toast} />
    </>
  )
}

// hold queue for sold-out titles — a return notifies position 1
function Reservations({ books, showToast }) {
  const [holds, setHolds] = useState(RESERVATIONS)

  const notify = (id) => {
    const h = holds.find((h) => h.id === id)
    setHolds((hs) => hs.filter((x) => x.id !== id).map((x) =>
      x.title === h.title ? { ...x, pos: x.pos - 1 } : x
    ))
    showToast(`${h.requester} notified — "${h.title}" held at the desk for 48h`)
  }

  return (
    <Panel title="Reservation queue" subtitle="Holds on titles with no available copies · first come, first served" flush>
      {holds.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>No reservations</div>
      ) : (
        <table className="data">
          <thead>
            <tr><th>Title</th><th>Requested by</th><th>Programme</th><th>Placed</th><th className="num">Queue pos.</th><th>Availability</th><th>Action</th></tr>
          </thead>
          <tbody>
            {holds.map((h) => {
              const book = books.find((b) => b.title === h.title)
              const canNotify = book && book.avail > 0 && h.pos === 1
              return (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600 }}>{h.title}</td>
                  <td>{h.requester}</td>
                  <td>{h.grade}</td>
                  <td>{h.placed}</td>
                  <td className="num">#{h.pos}</td>
                  <td>
                    <Badge tone={book && book.avail > 0 ? 'green' : 'red'}>
                      {book && book.avail > 0 ? `${book.avail} available` : 'Waiting for return'}
                    </Badge>
                  </td>
                  <td>
                    {canNotify ? (
                      <button className="btn primary sm" onClick={() => notify(h.id)}>Notify & hold</button>
                    ) : (
                      <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function Catalogue({ books, loans, showToast }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null) // book detail modal
  const rows = books.filter(
    (b) => b.title.toLowerCase().includes(q.toLowerCase()) || b.author.toLowerCase().includes(q.toLowerCase())
  )
  const borrowers = sel ? loans.filter((l) => l.book === sel.title) : []

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="📚" label="Total Titles" value={LIBRARY_STATS.titles} />
        <StatCard icon="✅" label="Copies Available" value={LIBRARY_STATS.available} />
        <StatCard icon="📤" label="On Loan" value={LIBRARY_STATS.onLoan} deltaTone="neutral" />
        <StatCard icon="⏰" label="Overdue" value={LIBRARY_STATS.overdue} delta="N$ 2 / day fine" deltaTone="down" />
      </div>

      <Panel
        title="Catalogue"
        actions={
          <input
            className="inline"
            style={{ width: 260 }}
            placeholder="Search title or author…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
        flush
      >
        <table className="data">
          <thead>
            <tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th className="num">Available</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const status = b.avail === 0 ? 'Out' : b.avail <= 4 ? 'Low' : 'Available'
              return (
                <tr key={b.isbn} style={{ cursor: 'pointer' }} onClick={() => setSel(b)}>
                  <td style={{ fontWeight: 600 }}>{b.title}</td>
                  <td>{b.author}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{b.isbn}</td>
                  <td><Badge tone={CAT_TONE[b.cat]}>{b.cat}</Badge></td>
                  <td className="num">{b.avail} / {b.total}</td>
                  <td><Badge tone={status === 'Available' ? 'green' : status === 'Low' ? 'orange' : 'red'}>{status}</Badge></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>

      {sel && (
        <Modal title={sel.title} onClose={() => setSel(null)} width={440}>
          {[
            ['Author', sel.author],
            ['ISBN', sel.isbn],
            ['Category', sel.cat],
            ['Copies', `${sel.avail} available of ${sel.total}`],
          ].map(([l, v]) => (
            <div key={l} className="cf-row" style={{ padding: '7px 0', borderBottom: '1px solid #e9eef3' }}>
              <span style={{ color: 'var(--ink-soft)' }}>{l}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <button
            className="btn ghost sm"
            style={{ marginTop: 12 }}
            onClick={() => { setSel(null); showToast(`Purchase order raised — 10 copies of "${sel.title}" from Namibia Book Market`) }}
          >
            🛒 Order more copies
          </button>
          <div style={{ margin: '14px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            CURRENTLY WITH ({borrowers.length})
          </div>
          {borrowers.length === 0 ? (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No copies on loan from this list</div>
          ) : (
            borrowers.map((l) => (
              <div key={l.id} className="cf-row" style={{ padding: '6px 0' }}>
                <span>{l.borrower} ({l.grade})</span>
                <Badge tone={LOAN_TONE[l.status]}>{l.status === 'Overdue' ? `Overdue — due ${l.due}` : `due ${l.due}`}</Badge>
              </div>
            ))
          )}
        </Modal>
      )}
    </>
  )
}

function Loans({ loans, onReturn, onRenew, showToast }) {
  const overdue = loans.filter((l) => l.status === 'Overdue').length
  return (
    <Panel
      title="Active loans"
      subtitle={`${loans.length} books out · ${overdue} overdue`}
      actions={
        <button
          className="btn ghost sm"
          disabled={overdue === 0}
          onClick={() => showToast(`Overdue reminders sent — ${overdue} SMS to guardians/staff`)}
        >
          📣 Send overdue reminders
        </button>
      }
      flush
    >
      <table className="data">
        <thead>
          <tr><th>Book</th><th>Borrower</th><th>Programme</th><th>Issued</th><th>Due</th><th>Status</th><th>Action</th></tr>
        </thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id}>
              <td style={{ fontWeight: 600 }}>{l.book}</td>
              <td>{l.borrower}</td>
              <td>{l.grade}</td>
              <td>{l.issued}</td>
              <td>{l.due}</td>
              <td><Badge tone={LOAN_TONE[l.status]}>{l.status}</Badge></td>
              <td>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button className="btn ghost sm" onClick={() => onReturn(l.id)}>↩ Return</button>
                  <button className="btn ghost sm" onClick={() => onRenew(l.id)}>⟳ Renew</button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function Fines({ fines, setFines, showToast }) {
  const RATE = 2 // N$ per overdue day

  const markPaid = (id) => {
    const f = fines.find((f) => f.id === id)
    setFines((fs) => fs.filter((f) => f.id !== id))
    showToast(`Fine of ${fmtN(f.days * RATE)} collected from ${f.borrower}`)
  }

  return (
    <Panel title="Outstanding fines" subtitle="N$ 2 per overdue day" flush>
      {fines.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>
          No outstanding fines
        </div>
      ) : (
        <table className="data">
          <thead>
            <tr><th>Borrower</th><th>Book</th><th className="num">Days overdue</th><th className="num">Fine</th><th>Action</th></tr>
          </thead>
          <tbody>
            {fines.map((f) => (
              <tr key={f.id}>
                <td style={{ fontWeight: 600 }}>{f.borrower}</td>
                <td>{f.book}</td>
                <td className="num">{f.days}</td>
                <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>{fmtN(f.days * RATE)}</td>
                <td><button className="btn green sm" onClick={() => markPaid(f.id)}>✓ Mark paid</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
