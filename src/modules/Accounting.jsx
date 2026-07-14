import React, { useMemo, useState } from 'react'
import { StatCard, Tabs, Panel, Badge, Modal, Toast, useToast } from '../ui.jsx'
import { JOURNAL, COA, ASSET_REGISTER, TAX_CALENDAR, TAX_CONST, WORKTAG_OF, fmtN } from '../data.js'

// Bookkeeping mirror of public/assets/Namibia_Financial_Model_v8.xlsx —
// everything downstream (TB, IS, tax) is DERIVED from the journal, like
// the workbook. University twist: tuition is VAT-exempt, canteen taxable.
export default function Accounting({ role }) {
  const [tab, setTab] = useState('Journal')
  const [journal, setJournal] = useState(JOURNAL)

  // net balance per account (Dr positive for debit-normal accounts)
  const balances = useMemo(() => {
    const b = {}
    journal.forEach((l) => {
      b[l.acc] = (b[l.acc] || 0) + l.dr - l.cr
    })
    return b
  }, [journal])

  return (
    <>
      <Tabs
        tabs={['Journal', 'Trial Balance', 'Income Statement', 'Tax Engine', 'Asset Register', 'VAT & Compliance']}
        active={tab}
        onChange={setTab}
      />
      {tab === 'Journal' && <Journal journal={journal} setJournal={setJournal} />}
      {tab === 'Trial Balance' && <TrialBalance balances={balances} />}
      {tab === 'Income Statement' && <IncomeStatement balances={balances} />}
      {tab === 'Tax Engine' && <TaxEngine balances={balances} />}
      {tab === 'Asset Register' && <AssetRegister />}
      {tab === 'VAT & Compliance' && <VatCompliance />}
    </>
  )
}

const isRevenue = (acc) => COA[acc]?.[0] === 'Revenue'
const isExpense = (acc) => COA[acc]?.[0] === 'Expense'

function Journal({ journal, setJournal }) {
  const [toast, showToast] = useToast()
  const [showNew, setShowNew] = useState(false)
  const dr = journal.reduce((s, l) => s + l.dr, 0)
  const cr = journal.reduce((s, l) => s + l.cr, 0)
  const diff = dr - cr

  const postEntry = (e) => {
    e.preventDefault()
    const f = e.target
    const amt = Number(f.amount.value) || 0
    if (amt <= 0 || f.drAcc.value === f.crAcc.value) return
    const desc = f.desc.value || 'Manual journal entry'
    setJournal((j) => [
      ...j,
      { date: '04 Jul', desc, acc: f.drAcc.value, dr: amt, cr: 0, vat: '—' },
      { date: '04 Jul', desc, acc: f.crAcc.value, dr: 0, cr: amt, vat: '—' },
    ])
    setShowNew(false)
    showToast(`Posted — Dr ${f.drAcc.value} / Cr ${f.crAcc.value} · ${fmtN(amt)} (audit-logged)`)
  }

  return (
    <>
      <div className="note-banner">
        <span>{diff === 0 ? '✅' : '⚠️'}</span>
        <div>
          <strong>Double-entry check:</strong> total debits {fmtN(dr)} − total credits {fmtN(cr)} ={' '}
          <strong style={{ color: diff === 0 ? 'var(--green)' : 'var(--red)' }}>{fmtN(diff)}</strong> — every
          transaction posts a debit and a credit, exactly like the Excel model.
        </div>
      </div>
      <Panel
        title="General journal — Semester 1, 2026"
        subtitle="Source of truth: TB, Income Statement and Tax Engine derive from these lines"
        actions={
          <>
            <a className="btn ghost sm" href="/assets/Namibia_Financial_Model_v8.xlsx" download>⬇ Workbook (.xlsx)</a>
            <button className="btn ghost sm" onClick={() => showToast('Journal exported — audit-ready CSV')}>⬇ Export</button>
            <button className="btn primary sm" onClick={() => setShowNew(true)}>+ Journal entry</button>
          </>
        }
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>Date</th><th>Description</th><th>Account</th>
              <th className="num">Debit</th><th className="num">Credit</th><th>VAT</th><th>Worktags</th>
            </tr>
          </thead>
          <tbody>
            {journal.map((l, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 12 }}>{l.date}</td>
                <td style={{ fontSize: 12.5 }}>{l.desc}</td>
                <td style={{ fontWeight: 600, fontSize: 12.5 }}>{l.acc}</td>
                <td className="num">{l.dr ? fmtN(l.dr) : ''}</td>
                <td className="num">{l.cr ? fmtN(l.cr) : ''}</td>
                <td>
                  {l.vat === 'Y' ? <Badge tone="teal">VAT 15%</Badge> : l.vat === 'Exempt' ? <Badge tone="purple">Exempt</Badge> : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                </td>
                <td>
                  {WORKTAG_OF[l.acc] ? <Badge tone="gray">{WORKTAG_OF[l.acc]}</Badge> : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ fontWeight: 700 }}>TOTALS</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmtN(dr)}</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmtN(cr)}</td>
              <td><Badge tone={diff === 0 ? 'green' : 'red'}>{diff === 0 ? 'Balanced' : 'Off'}</Badge></td>
              <td />
            </tr>
          </tbody>
        </table>
      </Panel>

      {showNew && (
        <Modal title="New journal entry — double entry" onClose={() => setShowNew(false)} width={460}>
          <form onSubmit={postEntry}>
            <div className="field"><label>Description</label><input name="desc" placeholder="e.g. Generator fuel — campus" required /></div>
            <div className="grid2" style={{ gap: 12 }}>
              <div className="field">
                <label>Debit account</label>
                <select name="drAcc">{Object.keys(COA).map((a) => <option key={a}>{a}</option>)}</select>
              </div>
              <div className="field">
                <label>Credit account</label>
                <select name="crAcc" defaultValue="Cash & Cash Equivalents">{Object.keys(COA).map((a) => <option key={a}>{a}</option>)}</select>
              </div>
            </div>
            <div className="field"><label>Amount (N$)</label><input name="amount" type="number" min="1" defaultValue="2500" required /></div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 14 }}>
              Posts one debit + one credit line — the TB, Income Statement and Tax Engine update instantly.
            </div>
            <button className="btn primary" type="submit">Post entry</button>
          </form>
        </Modal>
      )}
      <Toast msg={toast} />
    </>
  )
}

function TrialBalance({ balances }) {
  const rows = Object.entries(balances).map(([acc, net]) => ({
    acc, cat: COA[acc]?.[0] || '—',
    dr: net > 0 ? net : 0, cr: net < 0 ? -net : 0,
  }))
  const tDr = rows.reduce((s, r) => s + r.dr, 0)
  const tCr = rows.reduce((s, r) => s + r.cr, 0)

  return (
    <Panel title="Trial balance — auto-generated from the journal" subtitle={`Difference (must be 0): ${fmtN(tDr - tCr)}`} flush>
      <table className="data">
        <thead>
          <tr><th>Account</th><th>Category</th><th className="num">Debit</th><th className="num">Credit</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.acc}>
              <td style={{ fontWeight: 600 }}>{r.acc}</td>
              <td><Badge tone={{ Asset: 'blue', Liability: 'orange', Equity: 'purple', Revenue: 'green', Expense: 'red' }[r.cat] || 'gray'}>{r.cat}</Badge></td>
              <td className="num">{r.dr ? fmtN(r.dr) : ''}</td>
              <td className="num">{r.cr ? fmtN(r.cr) : ''}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} style={{ fontWeight: 700 }}>TOTAL</td>
            <td className="num" style={{ fontWeight: 700 }}>{fmtN(tDr)}</td>
            <td className="num" style={{ fontWeight: 700 }}>{fmtN(tCr)}</td>
          </tr>
        </tbody>
      </table>
    </Panel>
  )
}

function IncomeStatement({ balances }) {
  const revenue = Object.entries(balances).filter(([a]) => isRevenue(a)).map(([a, v]) => [a, -v])
  const expenses = Object.entries(balances).filter(([a]) => isExpense(a)).map(([a, v]) => [a, v])
  const tRev = revenue.reduce((s, [, v]) => s + v, 0)
  const tExp = expenses.reduce((s, [, v]) => s + v, 0)
  const ebt = tRev - tExp

  const row = (label, v, bold) => (
    <div key={label} className={`cf-row ${bold ? 'total' : ''}`} style={bold ? {} : { padding: '6px 0', borderBottom: '1px solid #e9eef3' }}>
      <span>{label}</span>
      <span className={bold ? 'amt' : 'mono'}>{fmtN(v)}</span>
    </div>
  )

  return (
    <div className="grid2">
      <Panel title="Income statement — Semester 1, 2026" subtitle="Symanek Specialized College (Pty) Ltd · NAD">
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '4px 0' }}>REVENUE</div>
        {revenue.map(([a, v]) => row(a, v))}
        {row('Gross revenue', tRev, true)}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', margin: '14px 0 4px' }}>EXPENSES</div>
        {expenses.map(([a, v]) => row(a, v))}
        {row('Total expenses', tExp, true)}
        {row('NET PROFIT BEFORE TAX (EBT)', ebt, true)}
      </Panel>
      <Panel title="Where the money goes" subtitle="Expense mix — Semester 1">
        {expenses.map(([a, v]) => (
          <div key={a} className="hbar-row">
            <span className="hlabel" style={{ fontSize: 11.5 }}>{a.replace(/ \(.*\)/, '')}</span>
            <div className="progress"><div className="fill amber" style={{ width: `${(v / tExp) * 100}%` }} /></div>
            <span className="hval">{Math.round((v / tExp) * 100)}%</span>
          </div>
        ))}
        <div className="note-banner" style={{ marginTop: 16 }}>
          <span>🎓</span>
          <div>
            Tuition of {fmtN(1540000)} is a <strong>VAT-exempt educational supply</strong> — it never
            appears in the VAT ledger, only in the income statement.
          </div>
        </div>
      </Panel>
    </div>
  )
}

function TaxEngine({ balances }) {
  const [toast, showToast] = useToast()
  const tRev = Object.entries(balances).filter(([a]) => isRevenue(a)).reduce((s, [, v]) => s - v, 0)
  const tExp = Object.entries(balances).filter(([a]) => isExpense(a)).reduce((s, [, v]) => s + v, 0)
  const ebt = tRev - tExp
  const fines = balances['Fines & Penalties (non-deductible)'] || 0
  const ent50 = (balances['Entertainment (50% non-deductible)'] || 0) * 0.5
  const addBacks = fines + ent50
  const allowances = ASSET_REGISTER.reduce((s, a) => s + a.cost * a.rate, 0)
  const taxable = ebt + addBacks - allowances
  const tax = Math.round(taxable * TAX_CONST.corporateRate)
  const p1 = Math.round(tax * 0.4)

  const step = (n, label) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--petrol-800)', margin: '14px 0 4px' }}>
      STEP {n} — {label}
    </div>
  )
  const row = (label, v, note, bold) => (
    <div className={`cf-row ${bold ? 'total' : ''}`} style={bold ? {} : { padding: '5px 0', fontSize: 12.5 }}>
      <span>{label} {note && <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>· {note}</span>}</span>
      <span className={bold ? 'amt' : 'mono'}>{fmtN(Math.round(v))}</span>
    </div>
  )

  return (
    <div className="grid2">
      <Panel title="NamRA tax engine — Income Tax Act computation" subtitle="Private college · non-mining corporate rate 30%">
        {step(1, 'ACCOUNTING PROFIT')}
        {row('Earnings before tax (EBT)', ebt, 'from Income Statement')}
        {step(2, 'ADD-BACKS (NON-DEDUCTIBLE — s17 ITA)')}
        {row('Fines & penalties', fines, 's17(1)')}
        {row('50% of entertainment', ent50, 's17(1)(f)')}
        {step(3, 'CAPITAL ALLOWANCES (WEAR & TEAR — s17B)')}
        {ASSET_REGISTER.map((a) => row(`${a.cat} (${Math.round(a.rate * 100)}%)`, a.cost * a.rate, a.id))}
        {step(4, 'TAXABLE INCOME')}
        {row('EBT + add-backs − allowances', taxable, null, true)}
        {step(5, 'INCOME TAX LIABILITY')}
        {row(`Taxable income × ${TAX_CONST.corporateRate * 100}%`, tax, null, true)}
      </Panel>

      <div>
        <Panel title="Provisional tax tracker" subtitle="NamRA two-payment system">
          <div className="cf-row" style={{ padding: '7px 0', borderBottom: '1px solid #e9eef3' }}>
            <span>P1 — due 31 Aug 2026 <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>· ≥40% of estimate</span></span>
            <span className="mono" style={{ fontWeight: 700 }}>{fmtN(p1)}</span>
          </div>
          <div className="cf-row" style={{ padding: '7px 0', borderBottom: '1px solid #e9eef3' }}>
            <span>P2 — due 28 Feb 2027 <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>· balancing payment</span></span>
            <span className="mono" style={{ fontWeight: 700 }}>{fmtN(tax - p1)}</span>
          </div>
          <button className="btn primary sm" style={{ marginTop: 12 }} onClick={() => showToast(`P1 of ${fmtN(p1)} scheduled for payment via NamRA ITAS portal`)}>
            Schedule P1 payment
          </button>
        </Panel>
        <Panel title="Institution status" subtitle="Why this college pays income tax">
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
            <strong style={{ color: 'var(--ink)' }}>Private (Pty) Ltd college</strong> → taxed at the standard
            non-mining rate of 30%. A State or registered <em>public benefit</em> educational institution would be
            <strong> exempt under s16 of the Income Tax Act</strong> — worth revisiting if Symanek converts to a
            not-for-profit. Assessed losses carry forward indefinitely.
          </div>
        </Panel>
      </div>
      <Toast msg={toast} />
    </div>
  )
}

function AssetRegister() {
  const [toast, showToast] = useToast()
  const tCost = ASSET_REGISTER.reduce((s, a) => s + a.cost, 0)
  const tDep = ASSET_REGISTER.reduce((s, a) => s + a.cost * a.rate, 0)
  return (
    <>
      <Panel
        title="Fixed asset register & wear-and-tear schedule"
        subtitle="NamRA s17B rates: computers 33.33% · vehicles 20% · plant 10% · buildings 4%"
        actions={<button className="btn primary sm" onClick={() => showToast('Asset added to register — depreciation schedule updated')}>+ Add asset</button>}
        flush
      >
        <table className="data">
          <thead>
            <tr>
              <th>ID</th><th>Asset</th><th>Category</th><th>Acquired</th>
              <th className="num">Cost</th><th className="num">NamRA rate</th><th className="num">Annual allowance</th>
            </tr>
          </thead>
          <tbody>
            {ASSET_REGISTER.map((a) => (
              <tr key={a.id}>
                <td className="mono" style={{ fontSize: 12.5 }}>{a.id}</td>
                <td style={{ fontWeight: 600 }}>{a.desc}</td>
                <td>{a.cat}</td>
                <td>{a.acquired}</td>
                <td className="num">{fmtN(a.cost)}</td>
                <td className="num">{(a.rate * 100).toFixed(a.rate === 0.3333 ? 2 : 0)}%</td>
                <td className="num" style={{ fontWeight: 600 }}>{fmtN(Math.round(a.cost * a.rate))}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} style={{ fontWeight: 700 }}>TOTALS — feeds the Tax Engine (Step 3)</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmtN(tCost)}</td>
              <td />
              <td className="num" style={{ fontWeight: 700 }}>{fmtN(Math.round(tDep))}</td>
            </tr>
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}

const CAL_TONE = { 'Up to date': 'green', 'Due soon': 'orange', Upcoming: 'gray' }

function VatCompliance() {
  const [toast, showToast] = useToast()
  const output = 15450, input = 7200
  return (
    <>
      <div className="stat-row c4">
        <StatCard icon="🧾" label="Output VAT (canteen)" value={fmtN(output)} delta="Taxable supplies only" deltaTone="neutral" />
        <StatCard icon="↩️" label="Input VAT claimable" value={fmtN(input)} delta="Apportioned to taxable use" deltaTone="neutral" />
        <StatCard icon="🏛️" label="VAT payable to NamRA" value={fmtN(output - input)} delta="Period May–Jun · due 25 Jul" deltaTone="down" />
        <StatCard icon="🎓" label="Tuition VAT" value="Exempt" delta="VAT Act 10 of 2000" deltaTone="neutral" />
      </div>

      <div className="note-banner">
        <span>⚖️</span>
        <div>
          <strong>Mixed supplies:</strong> education (tuition, registration) is VAT-<strong>exempt</strong>, so no
          output VAT is charged and input VAT on education-related costs cannot be claimed. Canteen & hostel sales are
          <strong> taxable at 15%</strong> — input VAT is apportioned to the taxable side only.
        </div>
      </div>

      <Panel title="NamRA compliance calendar" subtitle="Employer + VAT vendor obligations for a private college" flush>
        <table className="data">
          <thead>
            <tr><th>Obligation</th><th>Frequency</th><th>Statutory deadline</th><th>Next due</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {TAX_CALENDAR.map((t) => (
              <tr key={t.obligation}>
                <td style={{ fontWeight: 600 }}>{t.obligation}</td>
                <td>{t.freq}</td>
                <td style={{ fontSize: 12.5 }}>{t.due}</td>
                <td className="mono" style={{ fontSize: 12.5 }}>{t.next}</td>
                <td><Badge tone={CAL_TONE[t.status]}>{t.status}</Badge></td>
                <td>
                  {t.status === 'Due soon' && (
                    <button className="btn primary sm" onClick={() => showToast('VAT return prepared — VAT payable N$ 8,250 · file via ITAS by 25 Jul')}>
                      Prepare return
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Toast msg={toast} />
    </>
  )
}
