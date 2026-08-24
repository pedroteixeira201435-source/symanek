import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Toast, useToast, Icon } from '../ui.jsx'
import { fmtN } from '../lib/format.js'
import {
  getGlJournal, glPost, listGlAccounts, listAssets, assetAdd, assetDelete, assetDepreciate,
  listVatCalendar, vatPeriodSet, getBusinessSettings,
} from '../api.js'

// Double-entry bookkeeping: everything downstream (Trial Balance, Income
// Statement, Tax Engine) derives from the real general-ledger journal.
export default function Accounting() {
  const [tab, setTab] = useState('Journal')
  const [journal, setJournal] = useState([])
  const [accounts, setAccounts] = useState([])
  const reload = useCallback(() => Promise.all([
    getGlJournal().then(setJournal).catch(() => setJournal([])),
    listGlAccounts().then(setAccounts).catch(() => setAccounts([])),
  ]), [])
  useEffect(() => { reload() }, [reload])

  const typeOf = useMemo(() => Object.fromEntries(accounts.map((a) => [a.name, a.type])), [accounts])
  const balances = useMemo(() => {
    const b = {}
    journal.forEach((l) => { b[l.acc] = (b[l.acc] || 0) + l.dr - l.cr })
    return b
  }, [journal])

  return (
    <>
      <Tabs
        tabs={['Journal', 'Trial Balance', 'Income Statement', 'Tax Engine', 'Asset Register', 'VAT & Compliance']}
        active={tab} onChange={setTab}
      />
      {tab === 'Journal' && <Journal journal={journal} accounts={accounts} reload={reload} />}
      {tab === 'Trial Balance' && <TrialBalance balances={balances} typeOf={typeOf} />}
      {tab === 'Income Statement' && <IncomeStatement balances={balances} typeOf={typeOf} />}
      {tab === 'Tax Engine' && <TaxEngine balances={balances} typeOf={typeOf} />}
      {tab === 'Asset Register' && <AssetRegister />}
      {tab === 'VAT & Compliance' && <VatCompliance />}
    </>
  )
}

function Empty({ children }) { return <div style={{ padding: 36, textAlign: 'center', color: 'var(--ink-faint)' }}>{children}</div> }
const isRevenue = (t) => t === 'Income' || t === 'Revenue'
const CAT_TONE = { Asset: 'blue', Liability: 'orange', Equity: 'purple', Income: 'green', Revenue: 'green', Expense: 'red' }

function Journal({ journal, accounts, reload }) {
  const [toast, showToast] = useToast()
  const [showNew, setShowNew] = useState(false)
  const dr = journal.reduce((s, l) => s + l.dr, 0)
  const cr = journal.reduce((s, l) => s + l.cr, 0)
  const diff = dr - cr

  const postEntry = async (e) => {
    e.preventDefault(); const f = e.target
    const amt = Number(f.amount.value) || 0
    if (amt <= 0 || f.drAcc.value === f.crAcc.value) { showToast('Debit and credit accounts must differ.'); return }
    try {
      const res = await glPost({ desc: f.desc.value || 'Manual journal entry', drAcc: f.drAcc.value, crAcc: f.crAcc.value, amount: amt })
      if (res.ok === false) throw new Error(res.error)
    } catch (err) { showToast('Could not post entry' + (err?.message ? `: ${err.message}` : '')); return }
    setShowNew(false); await reload(); showToast(`Posted — Dr ${f.drAcc.value} / Cr ${f.crAcc.value} · ${fmtN(amt)}`)
  }

  return (
    <>
      <div className="note-banner">
        <Icon name={diff === 0 ? 'check' : 'alert'} size={16} />
        <div><strong>Double-entry check:</strong> debits {fmtN(dr)} − credits {fmtN(cr)} = <strong style={{ color: diff === 0 ? 'var(--green)' : 'var(--red)' }}>{fmtN(diff)}</strong></div>
      </div>
      <Panel
        title="General journal"
        subtitle="Source of truth — Trial Balance, Income Statement and Tax Engine derive from these lines"
        actions={<button className="btn primary sm" onClick={() => setShowNew(true)} disabled={accounts.length === 0}>+ Journal entry</button>}
        flush
      >
        {journal.length === 0 ? <Empty>No journal entries yet.{accounts.length === 0 ? ' (Chart of accounts is empty.)' : ''}</Empty> : (
          <table className="data">
            <thead><tr><th>Date</th><th>Description</th><th>Account</th><th className="num">Debit</th><th className="num">Credit</th><th>VAT</th></tr></thead>
            <tbody>
              {journal.map((l, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: 12 }}>{l.date}</td>
                  <td style={{ fontSize: 12.5 }}>{l.desc}</td>
                  <td style={{ fontWeight: 600, fontSize: 12.5 }}>{l.acc}</td>
                  <td className="num">{l.dr ? fmtN(l.dr) : ''}</td>
                  <td className="num">{l.cr ? fmtN(l.cr) : ''}</td>
                  <td>{l.vat === 'Y' ? <Badge tone="teal">VAT 15%</Badge> : l.vat === 'Exempt' ? <Badge tone="purple">Exempt</Badge> : <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
                </tr>
              ))}
              <tr><td colSpan={3} style={{ fontWeight: 700 }}>TOTALS</td><td className="num" style={{ fontWeight: 700 }}>{fmtN(dr)}</td><td className="num" style={{ fontWeight: 700 }}>{fmtN(cr)}</td><td><Badge tone={diff === 0 ? 'green' : 'red'}>{diff === 0 ? 'Balanced' : 'Off'}</Badge></td></tr>
            </tbody>
          </table>
        )}
      </Panel>

      {showNew && (
        <Modal title="New journal entry — double entry" onClose={() => setShowNew(false)} width={460}>
          <form onSubmit={postEntry}>
            <div className="field"><label>Description</label><input name="desc" placeholder="e.g. Generator fuel — campus" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Debit account</label><select name="drAcc">{accounts.map((a) => <option key={a.name}>{a.name}</option>)}</select></div>
              <div className="field"><label>Credit account</label><select name="crAcc">{accounts.map((a) => <option key={a.name}>{a.name}</option>)}</select></div>
            </div>
            <div className="field"><label>Amount (N$)</label><input name="amount" type="number" min="1" defaultValue="2500" required /></div>
            <button className="btn primary" type="submit">Post entry</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function TrialBalance({ balances, typeOf }) {
  const rows = Object.entries(balances).map(([acc, net]) => ({ acc, cat: typeOf[acc] || '—', dr: net > 0 ? net : 0, cr: net < 0 ? -net : 0 }))
  const tDr = rows.reduce((s, r) => s + r.dr, 0)
  const tCr = rows.reduce((s, r) => s + r.cr, 0)
  return (
    <Panel title="Trial balance" subtitle={`Auto-generated from the journal · difference (must be 0): ${fmtN(tDr - tCr)}`} flush>
      {rows.length === 0 ? <Empty>No postings yet.</Empty> : (
        <table className="data">
          <thead><tr><th>Account</th><th>Category</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.acc}><td style={{ fontWeight: 600 }}>{r.acc}</td><td><Badge tone={CAT_TONE[r.cat] || 'gray'}>{r.cat}</Badge></td><td className="num">{r.dr ? fmtN(r.dr) : ''}</td><td className="num">{r.cr ? fmtN(r.cr) : ''}</td></tr>
            ))}
            <tr><td colSpan={2} style={{ fontWeight: 700 }}>TOTAL</td><td className="num" style={{ fontWeight: 700 }}>{fmtN(tDr)}</td><td className="num" style={{ fontWeight: 700 }}>{fmtN(tCr)}</td></tr>
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function IncomeStatement({ balances, typeOf }) {
  const revenue = Object.entries(balances).filter(([a]) => isRevenue(typeOf[a])).map(([a, v]) => [a, -v])
  const expenses = Object.entries(balances).filter(([a]) => typeOf[a] === 'Expense').map(([a, v]) => [a, v])
  const tRev = revenue.reduce((s, [, v]) => s + v, 0)
  const tExp = expenses.reduce((s, [, v]) => s + v, 0)
  const ebt = tRev - tExp
  const row = (label, v, bold) => (
    <div key={label} className={`cf-row ${bold ? 'total' : ''}`} style={bold ? {} : { padding: '6px 0', borderBottom: '1px solid #e9eef3' }}>
      <span>{label}</span><span className={bold ? 'amt' : 'mono'}>{fmtN(v)}</span>
    </div>
  )
  return (
    <Panel title="Income statement" subtitle="Derived from the general ledger · NAD">
      {revenue.length === 0 && expenses.length === 0 ? <Empty>No revenue or expense postings yet.</Empty> : (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '4px 0' }}>REVENUE</div>
          {revenue.map(([a, v]) => row(a, v))}
          {row('Gross revenue', tRev, true)}
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '14px 0 4px' }}>EXPENSES</div>
          {expenses.map(([a, v]) => row(a, v))}
          {row('Total expenses', tExp, true)}
          {row('NET PROFIT BEFORE TAX (EBT)', ebt, true)}
        </>
      )}
    </Panel>
  )
}

function TaxEngine({ balances, typeOf }) {
  const [toast, showToast] = useToast()
  const [assets, setAssets] = useState([])
  const [rate, setRate] = useState(0.30)
  useEffect(() => {
    listAssets().then(setAssets).catch(() => {})
    getBusinessSettings().then((s) => { if (s?.tax?.corporateRate != null) setRate(Number(s.tax.corporateRate)) }).catch(() => {})
  }, [])
  const tRev = Object.entries(balances).filter(([a]) => isRevenue(typeOf[a])).reduce((s, [, v]) => s - v, 0)
  const tExp = Object.entries(balances).filter(([a]) => typeOf[a] === 'Expense').reduce((s, [, v]) => s + v, 0)
  const ebt = tRev - tExp
  const allowances = assets.reduce((s, a) => s + (a.life_years ? a.cost / a.life_years : 0), 0)
  const taxable = ebt - allowances
  const tax = Math.round(Math.max(0, taxable) * rate)
  const step = (n, label) => <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--petrol-800)', margin: '14px 0 4px' }}>STEP {n} — {label}</div>
  const row = (label, v, bold) => (
    <div className={`cf-row ${bold ? 'total' : ''}`} style={bold ? {} : { padding: '5px 0', fontSize: 12.5 }}><span>{label}</span><span className={bold ? 'amt' : 'mono'}>{fmtN(Math.round(v))}</span></div>
  )
  return (
    <Panel title="NamRA tax engine — Income Tax computation" subtitle={`Corporate rate ${Math.round(rate * 100)}% (editable in Settings → Business rules)`}>
      {step(1, 'ACCOUNTING PROFIT')}
      {row('Earnings before tax (EBT)', ebt)}
      {step(2, 'CAPITAL ALLOWANCES (WEAR & TEAR)')}
      {assets.length === 0 ? <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '4px 0' }}>No assets in the register.</div> : assets.map((a) => row(`${a.name} (${a.life_years}y)`, a.life_years ? a.cost / a.life_years : 0))}
      {step(3, 'TAXABLE INCOME')}
      {row('EBT − allowances', taxable, true)}
      {step(4, 'INCOME TAX LIABILITY')}
      {row(`Taxable income × ${Math.round(rate * 100)}%`, tax, true)}
      <Toast msg={toast} />
    </Panel>
  )
}

function AssetRegister() {
  const [toast, showToast] = useToast()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => listAssets().then(setAssets).catch(() => setAssets([])), [])
  useEffect(() => { reload().finally(() => setLoading(false)) }, [reload])

  const add = async (e) => {
    e.preventDefault(); const f = e.target
    try { await assetAdd({ name: f.name.value.trim(), category: f.category.value.trim(), acquired: f.acquired.value || null, cost: Number(f.cost.value), life: Number(f.life.value) }) }
    catch (err) { showToast('Could not add' + (err?.message ? `: ${err.message}` : '')); return }
    setShowNew(false); await reload(); showToast('Asset added')
  }
  const depreciate = async (a) => { try { await assetDepreciate(a.id); await reload(); showToast(`Depreciation posted for ${a.name}`) } catch (err) { showToast('Could not depreciate' + (err?.message ? `: ${err.message}` : '')) } }
  const remove = async (a) => { try { await assetDelete(a.id); await reload(); showToast(`${a.name} removed`) } catch (err) { showToast('Could not delete' + (err?.message ? `: ${err.message}` : '')) } }

  const tCost = assets.reduce((s, a) => s + Number(a.cost || 0), 0)
  const tBook = assets.reduce((s, a) => s + Number(a.book_value || 0), 0)
  if (loading) return <Panel title="Asset register" flush><Empty>Loading…</Empty></Panel>
  return (
    <>
      <Panel title="Fixed asset register" subtitle="Straight-line depreciation over each asset's useful life"
        actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add asset</button>} flush>
        {assets.length === 0 ? <Empty>No assets yet — add one to start.</Empty> : (
          <table className="data">
            <thead><tr><th>Asset</th><th>Category</th><th>Acquired</th><th className="num">Cost</th><th className="num">Life</th><th className="num">Accumulated</th><th className="num">Book value</th><th></th></tr></thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td><td>{a.category || '—'}</td><td>{a.acquired_on || '—'}</td>
                  <td className="num">{fmtN(a.cost)}</td><td className="num">{a.life_years}y</td>
                  <td className="num">{fmtN(a.accumulated)}</td><td className="num" style={{ fontWeight: 600 }}>{fmtN(a.book_value)}</td>
                  <td><span style={{ display: 'flex', gap: 6 }}><button className="btn ghost sm" onClick={() => depreciate(a)}>Depreciate</button><button className="btn ghost sm" onClick={() => remove(a)}>Delete</button></span></td>
                </tr>
              ))}
              <tr><td colSpan={3} style={{ fontWeight: 700 }}>TOTALS</td><td className="num" style={{ fontWeight: 700 }}>{fmtN(tCost)}</td><td colSpan={2} /><td className="num" style={{ fontWeight: 700 }}>{fmtN(tBook)}</td><td /></tr>
            </tbody>
          </table>
        )}
      </Panel>
      {showNew && (
        <Modal title="Add asset" onClose={() => setShowNew(false)} width={440}>
          <form onSubmit={add}>
            <div className="field"><label>Asset name</label><input name="name" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Category</label><input name="category" placeholder="e.g. Equipment" /></div>
              <div className="field"><label>Acquired</label><input name="acquired" type="date" /></div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Cost (N$)</label><input name="cost" type="number" min="0" required /></div>
              <div className="field"><label>Useful life (years)</label><input name="life" type="number" min="1" defaultValue="5" required /></div>
            </div>
            <button className="btn primary" type="submit">Add</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

const VAT_TONE = { open: 'orange', filed: 'blue', paid: 'green' }
function VatCompliance() {
  const [toast, showToast] = useToast()
  const [periods, setPeriods] = useState([])
  const [showNew, setShowNew] = useState(false)
  const reload = useCallback(() => listVatCalendar().then(setPeriods).catch(() => setPeriods([])), [])
  useEffect(() => { reload() }, [reload])
  const add = async (e) => {
    e.preventDefault(); const f = e.target
    try { await vatPeriodSet({ period: f.period.value.trim(), output: Number(f.output.value), input: Number(f.input.value), status: f.status.value, due: f.due.value || null }) }
    catch (err) { showToast('Could not save' + (err?.message ? `: ${err.message}` : '')); return }
    setShowNew(false); await reload(); showToast('VAT period saved')
  }
  const totOut = periods.reduce((s, p) => s + Number(p.output_vat || 0), 0)
  const totIn = periods.reduce((s, p) => s + Number(p.input_vat || 0), 0)
  return (
    <>
      <div className="stat-row c3">
        <StatCard icon="🧾" label="Output VAT (taxable)" value={fmtN(totOut)} delta="all periods" deltaTone="neutral" />
        <StatCard icon="↩️" label="Input VAT claimable" value={fmtN(totIn)} deltaTone="neutral" />
        <StatCard icon="🏛️" label="Net VAT payable" value={fmtN(totOut - totIn)} deltaTone="down" />
      </div>
      <div className="note-banner">
        <Icon name="scale" size={16} />
        <div><strong>Mixed supplies:</strong> education (tuition) is VAT-<strong>exempt</strong>; canteen & hostel sales are <strong>taxable at 15%</strong> — record only taxable supplies here.</div>
      </div>
      <Panel title="VAT periods" actions={<button className="btn primary sm" onClick={() => setShowNew(true)}>+ Add period</button>} flush>
        {periods.length === 0 ? <Empty>No VAT periods yet.</Empty> : (
          <table className="data">
            <thead><tr><th>Period</th><th className="num">Output</th><th className="num">Input</th><th className="num">Net</th><th>Due</th><th>Status</th></tr></thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}><td style={{ fontWeight: 600 }}>{p.period}</td><td className="num">{fmtN(p.output_vat)}</td><td className="num">{fmtN(p.input_vat)}</td><td className="num" style={{ fontWeight: 600 }}>{fmtN(p.net)}</td><td>{p.due || '—'}</td><td><Badge tone={VAT_TONE[p.status]}>{p.status}</Badge></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {showNew && (
        <Modal title="Add VAT period" onClose={() => setShowNew(false)} width={440}>
          <form onSubmit={add}>
            <div className="field"><label>Period</label><input name="period" placeholder="e.g. 2026-05/06" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Output VAT (N$)</label><input name="output" type="number" min="0" defaultValue="0" /></div>
              <div className="field"><label>Input VAT (N$)</label><input name="input" type="number" min="0" defaultValue="0" /></div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field"><label>Due date</label><input name="due" type="date" /></div>
              <div className="field"><label>Status</label><select name="status"><option value="open">open</option><option value="filed">filed</option><option value="paid">paid</option></select></div>
            </div>
            <button className="btn primary" type="submit">Save</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}
