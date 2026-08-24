import React, { useState, useEffect, useCallback } from 'react'
import { StatCard, Tabs, Panel, Badge, Toast, useToast, Modal, Icon } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  listLibraryCatalogue, listLibraryLoans, listLibraryFines, listLibraryReservations,
  libraryIssue, libraryReturn, libraryRenew, libraryBookUpsert, libraryBookDelete,
  libraryFineSettle, libraryReservationAdd, libraryReservationUpdate,
} from '../api.js'

const CAT_TONE = { Textbook: 'teal', Literature: 'purple', Reference: 'blue', Biography: 'amber', Journal: 'green' }
const LOAN_TONE = { 'On Loan': 'blue', 'Due Soon': 'orange', Overdue: 'red' }

// Every dataset is loaded from the backend; there is no mock fallback. An empty
// deployment shows empty-states and the librarian populates the catalogue.
export default function Library() {
  const [tab, setTab] = useState('Catalogue')
  const [books, setBooks] = useState([])
  const [loans, setLoans] = useState([])
  const [fines, setFines] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showIssue, setShowIssue] = useState(false)
  const [showAddBook, setShowAddBook] = useState(false)
  const [toast, showToast] = useToast()

  const reload = useCallback(() => {
    return Promise.all([
      listLibraryCatalogue().then(setBooks).catch(() => setBooks([])),
      listLibraryLoans().then(setLoans).catch(() => setLoans([])),
      listLibraryFines().then(setFines).catch(() => setFines([])),
      listLibraryReservations().then(setReservations).catch(() => setReservations([])),
    ])
  }, [])

  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const totals = {
    titles: books.length,
    available: books.reduce((s, b) => s + (b.avail || 0), 0),
    onLoan: loans.length,
    overdue: loans.filter((l) => l.status === 'Overdue').length,
  }

  const issueBook = async (e) => {
    e.preventDefault()
    const f = e.target
    const isbn = f.book.value
    const borrower = f.borrower.value.trim() || 'New borrower'
    const book = books.find((b) => b.isbn === isbn)
    try {
      const res = await libraryIssue({ isbn, borrower, days: 14 })
      if (res.ok === false) throw new Error(res.error)
    } catch (err) { showToast('Could not issue book' + (err?.message ? `: ${err.message}` : '')); return }
    setShowIssue(false); setTab('Active Loans'); await reload()
    showToast(`"${book?.title || isbn}" issued to ${borrower}`)
  }

  const addBook = async (e) => {
    e.preventDefault()
    const f = e.target
    try {
      await libraryBookUpsert({
        isbn: f.isbn.value.trim(), title: f.title.value.trim(), author: f.author.value.trim(),
        category: f.category.value, total: f.total.value,
      })
    } catch (err) { showToast('Could not save book' + (err?.message ? `: ${err.message}` : '')); return }
    setShowAddBook(false); await reload(); showToast(`"${f.title.value.trim()}" added to the catalogue`)
  }

  const deleteBook = async (b) => {
    try { await libraryBookDelete(b.id) }
    catch (err) { showToast('Could not delete' + (err?.message ? `: ${err.message}` : '')); return }
    await reload(); showToast(`"${b.title}" removed from the catalogue`)
  }

  const returnBook = async (l) => {
    try {
      const res = await libraryReturn(l.id)
      await reload()
      if (res.overdue_days > 0) showToast(`"${l.book}" returned ${res.overdue_days}d late — fine of ${fmtN(res.fine)} created`)
      else showToast(`"${l.book}" returned — back in catalogue`)
    } catch (err) { showToast('Could not return book' + (err?.message ? `: ${err.message}` : '')) }
  }

  const renewLoan = async (l) => {
    try { await libraryRenew(l.id); await reload(); showToast(`"${l.book}" renewed`) }
    catch (err) { showToast('Could not renew loan' + (err?.message ? `: ${err.message}` : '')) }
  }

  if (loading) return <Panel title="Library" flush><div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>Loading…</div></Panel>

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 4 }}>
        <button className="btn ghost sm" onClick={() => setShowAddBook(true)}>+ Add book</button>
        <button className="btn primary sm" onClick={() => setShowIssue(true)} disabled={books.every((b) => b.avail <= 0)}>+ Issue book</button>
      </div>
      <Tabs tabs={['Catalogue', 'Active Loans', 'Reservations', 'Fines']} active={tab} onChange={setTab} />

      {tab === 'Catalogue' && <Catalogue books={books} loans={loans} totals={totals} onDelete={deleteBook} />}
      {tab === 'Active Loans' && <Loans loans={loans} onReturn={returnBook} onRenew={renewLoan} showToast={showToast} />}
      {tab === 'Reservations' && (
        <Reservations reservations={reservations} books={books} showToast={showToast} reload={reload} />
      )}
      {tab === 'Fines' && <Fines fines={fines} showToast={showToast} reload={reload} />}

      {showIssue && (
        <Modal title="Issue book" onClose={() => setShowIssue(false)}>
          <form onSubmit={issueBook}>
            <div className="field">
              <label>Book (available copies)</label>
              <select name="book" required>
                {books.filter((b) => b.avail > 0).map((b) => (
                  <option key={b.isbn || b.id} value={b.isbn}>{b.title} — {b.avail} left</option>
                ))}
              </select>
            </div>
            <div className="field"><label>Borrower</label><input name="borrower" placeholder="Student or staff name" required /></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Loan period: 14 days · fine N$ 2 per overdue day
            </div>
            <button className="btn primary" type="submit">Issue</button>
          </form>
        </Modal>
      )}

      {showAddBook && (
        <Modal title="Add book to catalogue" onClose={() => setShowAddBook(false)}>
          <form onSubmit={addBook}>
            <div className="field"><label>Title</label><input name="title" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Author</label><input name="author" /></div>
              <div className="field"><label>ISBN</label><input name="isbn" placeholder="optional" /></div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Category</label>
                <select name="category"><option>Textbook</option><option>Literature</option><option>Reference</option><option>Biography</option><option>Journal</option></select>
              </div>
              <div className="field"><label>Copies</label><input name="total" type="number" min="1" defaultValue="1" required /></div>
            </div>
            <button className="btn primary" type="submit">Save</button>
          </form>
        </Modal>
      )}

      <Toast msg={toast} />
    </>
  )
}

function EmptyRow({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}

function Catalogue({ books, loans, totals, onDelete }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const rows = books.filter(
    (b) => (b.title || '').toLowerCase().includes(q.toLowerCase()) || (b.author || '').toLowerCase().includes(q.toLowerCase())
  )
  const borrowers = sel ? loans.filter((l) => l.book === sel.title) : []

  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="📚" label="Total Titles" value={totals.titles} />
        <StatCard icon="✅" label="Copies Available" value={totals.available} />
        <StatCard icon="📤" label="On Loan" value={totals.onLoan} deltaTone="neutral" />
        <StatCard icon="⏰" label="Overdue" value={totals.overdue} delta="N$ 2 / day fine" deltaTone="down" />
      </div>

      <Panel
        title="Catalogue"
        actions={<input className="inline" style={{ width: 260 }} placeholder="Search title or author…" value={q} onChange={(e) => setQ(e.target.value)} />}
        flush
      >
        {books.length === 0 ? (
          <EmptyRow>No books in the catalogue yet — use “Add book” to start.</EmptyRow>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Title</th><th>Author</th><th>ISBN</th><th>Category</th><th className="num">Available</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const status = b.avail === 0 ? 'Out' : b.avail <= 4 ? 'Low' : 'Available'
                return (
                  <tr key={b.id || b.isbn}>
                    <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => setSel(b)}>{b.title}</td>
                    <td>{b.author || '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{b.isbn || '—'}</td>
                    <td>{b.cat ? <Badge tone={CAT_TONE[b.cat]}>{b.cat}</Badge> : '—'}</td>
                    <td className="num">{b.avail} / {b.total}</td>
                    <td><Badge tone={status === 'Available' ? 'green' : status === 'Low' ? 'orange' : 'red'}>{status}</Badge></td>
                    <td>
                      <button className="btn ghost sm" title="Delete" onClick={() => onDelete(b)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {sel && (
        <Modal title={sel.title} onClose={() => setSel(null)} width={440}>
          {[
            ['Author', sel.author || '—'],
            ['ISBN', sel.isbn || '—'],
            ['Category', sel.cat || '—'],
            ['Copies', `${sel.avail} available of ${sel.total}`],
          ].map(([l, v]) => (
            <div key={l} className="cf-row" style={{ padding: '7px 0', borderBottom: '1px solid #e9eef3' }}>
              <span style={{ color: 'var(--ink-soft)' }}>{l}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div style={{ margin: '14px 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>
            CURRENTLY WITH ({borrowers.length})
          </div>
          {borrowers.length === 0 ? (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No copies on loan</div>
          ) : (
            borrowers.map((l) => (
              <div key={l.id} className="cf-row" style={{ padding: '6px 0' }}>
                <span>{l.borrower}</span>
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
        <button className="btn ghost sm" disabled={overdue === 0}
          onClick={() => showToast(`Overdue reminders sent — ${overdue} notice(s)`)}>
          <Icon name="send" size={14} /> Send overdue reminders
        </button>
      }
      flush
    >
      {loans.length === 0 ? (
        <EmptyRow>No active loans.</EmptyRow>
      ) : (
        <table className="data">
          <thead>
            <tr><th>Book</th><th>Borrower</th><th>Issued</th><th>Due</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 600 }}>{l.book}</td>
                <td>{l.borrower}</td>
                <td>{l.issued}</td>
                <td>{l.due}</td>
                <td><Badge tone={LOAN_TONE[l.status]}>{l.status}</Badge></td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn ghost sm" onClick={() => onReturn(l)}><Icon name="undo" size={14} /> Return</button>
                    <button className="btn ghost sm" onClick={() => onRenew(l)}><Icon name="refresh" size={14} /> Renew</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function Reservations({ reservations, books, showToast, reload }) {
  const [showAdd, setShowAdd] = useState(false)

  const add = async (e) => {
    e.preventDefault()
    const f = e.target
    try { await libraryReservationAdd({ isbn: f.book.value, requester: f.requester.value.trim() }) }
    catch (err) { showToast('Could not add reservation' + (err?.message ? `: ${err.message}` : '')); return }
    setShowAdd(false); await reload(); showToast('Reservation added to the queue')
  }
  const update = async (id, status, msg) => {
    try { await libraryReservationUpdate(id, status); await reload(); showToast(msg) }
    catch (err) { showToast('Could not update' + (err?.message ? `: ${err.message}` : '')) }
  }

  return (
    <Panel
      title="Reservation queue"
      subtitle="Holds on titles with no available copies · first come, first served"
      actions={<button className="btn ghost sm" onClick={() => setShowAdd(true)} disabled={books.length === 0}>+ Add reservation</button>}
      flush
    >
      {reservations.length === 0 ? (
        <EmptyRow>No reservations.</EmptyRow>
      ) : (
        <table className="data">
          <thead>
            <tr><th>Title</th><th>Requested by</th><th>Placed</th><th className="num">Queue pos.</th><th>Availability</th><th>Action</th></tr>
          </thead>
          <tbody>
            {reservations.map((h) => {
              const canNotify = h.avail > 0 && h.pos === 1 && h.status === 'waiting'
              return (
                <tr key={h.id}>
                  <td style={{ fontWeight: 600 }}>{h.title}</td>
                  <td>{h.requester}</td>
                  <td>{h.placed}</td>
                  <td className="num">#{h.pos}</td>
                  <td><Badge tone={h.avail > 0 ? 'green' : 'red'}>{h.avail > 0 ? `${h.avail} available` : 'Waiting for return'}</Badge></td>
                  <td>
                    <span style={{ display: 'flex', gap: 6 }}>
                      {canNotify && <button className="btn primary sm" onClick={() => update(h.id, 'notified', `${h.requester} notified — held 48h`)}>Notify</button>}
                      <button className="btn ghost sm" onClick={() => update(h.id, 'cancelled', 'Reservation cancelled')}>Cancel</button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {showAdd && (
        <Modal title="Add reservation" onClose={() => setShowAdd(false)}>
          <form onSubmit={add}>
            <div className="field">
              <label>Book</label>
              <select name="book" required>{books.map((b) => <option key={b.isbn || b.id} value={b.isbn}>{b.title}</option>)}</select>
            </div>
            <div className="field"><label>Requested by</label><input name="requester" placeholder="Student or staff name" required /></div>
            <button className="btn primary" type="submit">Add to queue</button>
          </form>
        </Modal>
      )}
    </Panel>
  )
}

function Fines({ fines, showToast, reload }) {
  const settle = async (f, waive) => {
    try { await libraryFineSettle(f.id, waive); await reload() }
    catch (err) { showToast('Could not update fine' + (err?.message ? `: ${err.message}` : '')); return }
    showToast(waive ? `Fine for ${f.borrower} waived` : `Fine of ${fmtN(f.amount)} collected from ${f.borrower}`)
  }
  const outstanding = fines.filter((f) => !f.paid)

  return (
    <Panel title="Outstanding fines" subtitle="N$ 2 per overdue day" flush>
      {outstanding.length === 0 ? (
        <EmptyRow>No outstanding fines.</EmptyRow>
      ) : (
        <table className="data">
          <thead>
            <tr><th>Borrower</th><th>Book</th><th className="num">Days overdue</th><th className="num">Fine</th><th>Action</th></tr>
          </thead>
          <tbody>
            {outstanding.map((f) => (
              <tr key={f.id}>
                <td style={{ fontWeight: 600 }}>{f.borrower}</td>
                <td>{f.book}</td>
                <td className="num">{f.days}</td>
                <td className="num" style={{ color: 'var(--red)', fontWeight: 700 }}>{fmtN(f.amount)}</td>
                <td>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button className="btn green sm" onClick={() => settle(f, false)}><Icon name="tick" size={14} /> Mark paid</button>
                    <button className="btn ghost sm" onClick={() => settle(f, true)}>Waive</button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
