import React, { useCallback, useEffect, useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  getFinanceStats, listExpenseBreakdown, listCollectionByProgramme, listInvoices, listFeeStructures,
  listPendingProofs, confirmInvoicePayment, listDebtors, listBudgets, listExpenses,
  invoiceCreate, feeStructureSet, budgetSet, expenseRecord, listStudents, listProgrammes,
} from '../api.js'

export default function Finance() {
  const [tab, setTab] = useState('Overview')
  return (
    <>
      <Tabs tabs={['Overview', 'Invoices', 'Payments', 'Fees', 'Budgets', 'Expenses']} active={tab} onChange={setTab} />
      {tab === 'Overview' && <Overview />}
      {tab === 'Invoices' && <Invoices />}
      {tab === 'Payments' && <Payments />}
      {tab === 'Fees' && <Fees />}
      {tab === 'Budgets' && <Budgets />}
      {tab === 'Expenses' && <Expenses />}
    </>
  )
}

function Overview() {
  const [stats, setStats] = useState(null)
  const [debtors, setDebtors] = useState([])
  const [collections, setCollections] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { Promise.all([
    getFinanceStats().then(setStats).catch(() => setStats(null)),
    listDebtors().then(setDebtors).catch(() => setDebtors([])),
    listCollectionByProgramme().then(setCollections).catch(() => setCollections([])),
    listExpenseBreakdown().then(setExpenses).catch(() => setExpenses([])),
  ]).finally(() => setLoading(false)) }, [])
  if (loading) return <Panel title="Finance overview" flush><Empty>Loading...</Empty></Panel>
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="💰" label="Collected" value={fmtN(stats?.collected || 0)} delta="backend aggregate" />
        <StatCard icon="🧾" label="Outstanding" value={fmtN(stats?.outstanding || 0)} delta={`${debtors.length} debtors`} deltaTone="down" />
        <StatCard icon="📊" label="Programmes" value={String(collections.length)} delta="collection bands" />
        <StatCard icon="📉" label="Expense lines" value={String(expenses.length)} delta="breakdown rows" />
      </div>
      <Panel title="Collection by programme" flush>{collections.length === 0 ? <Empty>No collection data yet.</Empty> : <SimpleTable rows={collections} />}</Panel>
      <Panel title="Debtors" flush>{debtors.length === 0 ? <Empty>No debtors yet.</Empty> : <SimpleTable rows={debtors} />}</Panel>
    </>
  )
}

function Invoices() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [students, setStudents] = useState([])
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => Promise.all([
    listInvoices().then(setRows).catch(() => setRows([])),
    listStudents().then(setStudents).catch(() => setStudents([])),
  ]), [])
  useEffect(() => { reload() }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await invoiceCreate({ studentId: f.student.value, amount: Number(f.amount.value), due: f.due.value || null }); setShowNew(false); await reload(); showToast('Invoice created') }
    catch (err) { showToast('Could not create invoice: ' + (err?.message || err)) }
  }
  return (
    <>
      <Panel title="Invoices" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ New invoice</button>} flush>{rows.length === 0 ? <Empty>No invoices yet.</Empty> : <SimpleTable rows={rows} />}</Panel>
      {showNew && <Modal title="New invoice" onClose={() => setShowNew(false)}><form onSubmit={save}><div className="field"><label>Student</label><select name="student" required>{students.map((s) => <option key={s._uuid || s.id} value={s._uuid || s.id}>{s.name}</option>)}</select></div><div className="field"><label>Amount</label><input name="amount" type="number" min="0" required /></div><div className="field"><label>Due date</label><input name="due" type="date" /></div><button className="btn primary">Create</button></form></Modal>}
      <Toast msg={toast} />
    </>
  )
}

function Payments() {
  const [toast, showToast] = useToast()
  const [proofs, setProofs] = useState([])
  const reload = useCallback(() => listPendingProofs().then(setProofs).catch(() => setProofs([])), [])
  useEffect(() => { reload() }, [reload])
  const confirm = async (p) => {
    try { await confirmInvoicePayment(p.paymentId); await reload(); showToast('Payment confirmed') }
    catch (err) { showToast('Could not confirm: ' + (err?.message || err)) }
  }
  return (
    <>
      <Panel title="Pending EFT proofs" flush>{proofs.length === 0 ? <Empty>No pending payment proofs.</Empty> : <table className="data"><thead><tr><th>Student</th><th>Invoice</th><th className="num">Amount</th><th>Submitted</th><th></th></tr></thead><tbody>{proofs.map((p) => <tr key={p.paymentId}><td>{p.student}</td><td>{p.invoiceId}</td><td className="num">{fmtN(p.amount)}</td><td>{p.submittedAt || '-'}</td><td><button className="btn green sm" onClick={() => confirm(p)}>Confirm</button></td></tr>)}</tbody></table>}</Panel>
      <Toast msg={toast} />
    </>
  )
}

function Fees() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [programmes, setProgrammes] = useState([])
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => Promise.all([listFeeStructures().then(setRows).catch(() => setRows([])), listProgrammes().then(setProgrammes).catch(() => setProgrammes([]))]), [])
  useEffect(() => { reload() }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await feeStructureSet({ programmeId: f.programme.value, year: Number(f.year.value), tuition: Number(f.tuition.value), other: Number(f.other.value) || 0 }); setShowNew(false); await reload(); showToast('Fee structure saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  return <><Panel title="Fee structures" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Set fee</button>} flush>{rows.length === 0 ? <Empty>No fee structures yet.</Empty> : <SimpleTable rows={rows} />}</Panel>{showNew && <Modal title="Set fee" onClose={() => setShowNew(false)}><form onSubmit={save}><div className="field"><label>Programme</label><select name="programme">{programmes.map((p) => <option key={p.id || p.code} value={p.id}>{p.name}</option>)}</select></div><div className="field"><label>Year</label><input name="year" type="number" defaultValue="2026" /></div><div className="field"><label>Tuition</label><input name="tuition" type="number" required /></div><div className="field"><label>Other fees</label><input name="other" type="number" defaultValue="0" /></div><button className="btn primary">Save</button></form></Modal>}<Toast msg={toast} /></>
}

function Budgets() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => listBudgets().then(setRows).catch(() => setRows([])), [])
  useEffect(() => { reload() }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await budgetSet({ category: f.category.value, allocated: Number(f.allocated.value), spent: Number(f.spent.value) || 0 }); setShowNew(false); await reload(); showToast('Budget saved') }
    catch (err) { showToast('Could not save: ' + (err?.message || err)) }
  }
  return <><Panel title="Budgets" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Set budget</button>} flush>{rows.length === 0 ? <Empty>No budgets yet.</Empty> : <SimpleTable rows={rows} />}</Panel>{showNew && <Modal title="Set budget" onClose={() => setShowNew(false)}><form onSubmit={save}><div className="field"><label>Category</label><input name="category" required /></div><div className="field"><label>Allocated</label><input name="allocated" type="number" required /></div><div className="field"><label>Spent</label><input name="spent" type="number" defaultValue="0" /></div><button className="btn primary">Save</button></form></Modal>}<Toast msg={toast} /></>
}

function Expenses() {
  const [toast, showToast] = useToast()
  const [rows, setRows] = useState([])
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => listExpenses().then(setRows).catch(() => setRows([])), [])
  useEffect(() => { reload() }, [reload])
  const save = async (e) => {
    e.preventDefault(); const f = e.target
    try { await expenseRecord({ date: f.date.value || null, category: f.category.value, description: f.description.value, amount: Number(f.amount.value) }); setShowNew(false); await reload(); showToast('Expense recorded') }
    catch (err) { showToast('Could not record expense: ' + (err?.message || err)) }
  }
  return <><Panel title="Expenses" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Record expense</button>} flush>{rows.length === 0 ? <Empty>No expenses yet.</Empty> : <SimpleTable rows={rows} />}</Panel>{showNew && <Modal title="Record expense" onClose={() => setShowNew(false)}><form onSubmit={save}><div className="field"><label>Date</label><input name="date" type="date" /></div><div className="field"><label>Category</label><input name="category" required /></div><div className="field"><label>Description</label><input name="description" /></div><div className="field"><label>Amount</label><input name="amount" type="number" required /></div><button className="btn primary">Save</button></form></Modal>}<Toast msg={toast} /></>
}

function SimpleTable({ rows }) {
  const keys = rows[0] ? Object.keys(rows[0]).slice(0, 8) : []
  return <table className="data"><thead><tr>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id || i}>{keys.map((k) => <td key={k}>{typeof r[k] === 'number' ? fmtN(r[k]) : String(r[k] ?? '-')}</td>)}</tr>)}</tbody></table>
}

function Empty({ children }) {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div>
}
