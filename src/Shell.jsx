import React, { useState } from 'react'
import { SCHOOL, ACTIVITY_FEED, STAFF, INVOICES, CATALOGUE, LEARNERS, APPLICANTS, PROGRAMMES, COURSES, INSTITUTION_HIDE, getInstType } from './data.js'
import { Avatar, Badge } from './ui.jsx'
import Dashboard from './modules/Dashboard.jsx'
import Students from './modules/Students.jsx'
import Academics from './modules/Academics.jsx'
import Scheduling from './modules/Scheduling.jsx'
import Finance from './modules/Finance.jsx'
import HR from './modules/HR.jsx'
import TeacherPortal from './modules/TeacherPortal.jsx'
import CanteenAdmin from './modules/CanteenAdmin.jsx'
import Library from './modules/Library.jsx'
import Settings from './modules/Settings.jsx'
import POS from './modules/POS.jsx'
import Admissions from './modules/Admissions.jsx'
import Programmes from './modules/Programmes.jsx'
import Accounting from './modules/Accounting.jsx'
import StudentPortal from './modules/StudentPortal.jsx'
import Courseware from './modules/Courseware.jsx'
import Exams from './modules/Exams.jsx'
import Graduation from './modules/Graduation.jsx'
import Accommodation from './modules/Accommodation.jsx'
import Compliance from './modules/Compliance.jsx'
import ApplyOnline from './modules/ApplyOnline.jsx'

// module registry: id -> { label, icon, group, component, subtitle }
const MODULES = {
  dashboard: { label: 'Dashboard', icon: '📊', group: 'Overview', comp: Dashboard, subtitle: 'Whole-institution health at a glance' },
  students: { label: 'Students', icon: '🎓', group: 'Overview', comp: Students, subtitle: 'Student register & 360° files' },
  academics: { label: 'Academics', icon: '📝', group: 'Overview', comp: Academics, subtitle: 'Mark moderation, exam board & students at risk', count: 3 },
  admissions: { label: 'Admissions', icon: '📨', group: 'Academic Lifecycle', comp: Admissions, subtitle: 'Application pipeline & 2027 intake', count: 7 },
  programmes: { label: 'Programmes', icon: '🏛️', group: 'Academic Lifecycle', comp: Programmes, subtitle: 'NQF programmes, courses & enrolments' },
  scheduling: { label: 'Scheduling', icon: '🗓️', group: 'Operations', comp: Scheduling, subtitle: 'Relief board, timetables & duty rosters', count: 4 },
  finance: { label: 'Finance', icon: '💰', group: 'Operations', comp: Finance, subtitle: 'Fees, invoices, payments & expenses' },
  accounting: { label: 'Accounting', icon: '📒', group: 'Operations', comp: Accounting, subtitle: 'Journal, NamRA tax engine & compliance' },
  hr: { label: 'HR & Payroll', icon: '🗂️', group: 'Operations', comp: HR, subtitle: 'Staff records, leave & Labour-Act payroll', count: 3 },
  teacher: { label: 'Lecturer Portal', icon: '📗', group: 'Overview', comp: TeacherPortal, subtitle: 'My timetable, gradebook & leave' },
  canteen: { label: 'Canteen', icon: '🍽️', group: 'Facilities', comp: CanteenAdmin, subtitle: 'Sales, inventory & till sessions' },
  library: { label: 'Library', icon: '📚', group: 'Facilities', comp: Library, subtitle: 'Catalogue, lending & fines', count: 9 },
  settings: { label: 'Settings', icon: '⚙️', group: 'System', comp: Settings, subtitle: 'Institution profile, terms & role permissions' },
  portal: { label: 'Student Portal', icon: '🎓', group: 'My Space', comp: StudentPortal, subtitle: 'My registration, grades, timetable & fees' },
  lms: { label: 'Courseware', icon: '💻', group: 'My Space', comp: Courseware, subtitle: 'Materials, assignments & submissions' },
  exams: { label: 'Examinations', icon: '🧪', group: 'Academic Lifecycle', comp: Exams, subtitle: 'Exam timetable, venues, seating & invigilation' },
  graduation: { label: 'Graduation', icon: '🎓', group: 'Academic Lifecycle', comp: Graduation, subtitle: 'Clearance & certificate issue' },
  accommodation: { label: 'Accommodation', icon: '🏠', group: 'Facilities', comp: Accommodation, subtitle: 'Residences, allocation & waitlist' },
  compliance: { label: 'Compliance', icon: '🏛️', group: 'System', comp: Compliance, subtitle: 'NCHE returns, accreditation & institution profile' },
  apply: { label: 'Apply Online', icon: '✍️', group: 'My Space', comp: ApplyOnline, subtitle: 'Submit & track your application' },
}

// which modules each role can see (order = nav order)
const ROLE_NAV = {
  admin: ['dashboard', 'students', 'academics', 'admissions', 'programmes', 'exams', 'graduation', 'scheduling', 'finance', 'accounting', 'hr', 'accommodation', 'canteen', 'library', 'compliance', 'settings'],
  bursar: ['finance', 'accounting', 'canteen', 'hr'],
  hr: ['hr'],
  teacher: ['teacher', 'lms', 'library'],
  librarian: ['library'],
  student: ['portal', 'lms'],
  registrar: ['dashboard', 'students', 'admissions', 'programmes', 'academics', 'exams', 'graduation', 'compliance'],
  applicant: ['apply'],
}

// read-only hints per role/module (prototype-level access control)
const READ_ONLY = {
  bursar: { hr: 'Payroll (read-only)', canteen: 'Sales reports (read-only)' },
}

const TODAY = new Date('2026-07-03').toLocaleDateString('en-NA', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
})

// global search index: [label, sublabel, type, badge tone, target module]
const SEARCH_INDEX = [
  ...LEARNERS.map((l) => [l.name, `${l.id} · ${l.grade}`, 'Student', 'green', 'students']),
  ...STAFF.map((s) => [s.name, s.role, 'Staff', 'purple', 'hr']),
  ...INVOICES.map((i) => [`${i.id} — ${i.learner}`, `${i.grade} · ${i.status}`, 'Invoice', 'teal', 'finance']),
  ...CATALOGUE.map((b) => [b.title, b.author, 'Book', 'blue', 'library']),
  ...APPLICANTS.map((a) => [a.name, `${a.id} · ${a.prog} · ${a.stage}`, 'Applicant', 'orange', 'admissions']),
  ...PROGRAMMES.map((p) => [p.name, `${p.code} · NQF ${p.nqf}`, 'Programme', 'blue', 'programmes']),
  ...COURSES.map((c) => [`${c.code} — ${c.title}`, `${c.prog} · ${c.credits} credits`, 'Course', 'teal', 'programmes']),
]

export default function Shell({ role, onLogout, initialMod }) {
  // institution type (multi-tenant) hides modules the tenant doesn't use
  const hidden = INSTITUTION_HIDE[getInstType()] || []
  const nav = (ROLE_NAV[role.id] || []).filter((m) => !hidden.includes(m))
  const isStudent = role.id === 'student' || role.id === 'applicant'
  // deep-link: #admin/accounting opens that module (if the role may see it)
  const [active, setActive] = useState(nav.includes(initialMod) ? initialMod : nav[0])
  const [showUser, setShowUser] = useState(false)
  const [showPOS, setShowPOS] = useState(false)
  const [q, setQ] = useState('')
  const [showNotif, setShowNotif] = useState(false)
  const [showMsg, setShowMsg] = useState(false)
  // deep-link payload for the target module (e.g. learner name -> opens Student 360)
  const [focus, setFocus] = useState(null)

  // search only within modules this role can open
  const results =
    q.trim().length >= 2
      ? SEARCH_INDEX.filter(
          ([label, sub, , , mod]) =>
            nav.includes(mod) && (label + ' ' + sub).toLowerCase().includes(q.trim().toLowerCase())
        ).slice(0, 8)
      : []

  const goTo = (mod, payload = null) => {
    if (!nav.includes(mod)) { setShowNotif(false); setShowMsg(false); return }
    setActive(mod); setFocus(payload); setQ(''); setShowNotif(false); setShowMsg(false)
  }

  if (showPOS) return <POS attendant={role.user} onLogout={() => setShowPOS(false)} adminPeek />

  const mod = MODULES[active]
  const Comp = mod.comp
  const groups = [...new Set(nav.map((id) => MODULES[id].group))]
  const roNote = READ_ONLY[role.id]?.[active]

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sb-brand">
          <div className="logo">S</div>
          <div>
            <div className="bname">Symanek Suite</div>
            <div className="bschool">{SCHOOL.name}</div>
          </div>
        </div>
        <div className="sb-profile">
          <Avatar name={role.user} />
          <div className="pname">{role.user}</div>
          <div className="prole">{role.name}</div>
        </div>
        <nav className="sb-nav">
          {groups.map((g) => (
            <React.Fragment key={g}>
              <div className="sb-group">{g}</div>
              {nav
                .filter((id) => MODULES[id].group === g)
                .map((id) => (
                  <button
                    key={id}
                    className={`sb-item ${active === id ? 'active' : ''}`}
                    onClick={() => setActive(id)}
                  >
                    <span className="icon">{MODULES[id].icon}</span>
                    {MODULES[id].label}
                    {MODULES[id].count && <span className="count">{MODULES[id].count}</span>}
                  </button>
                ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="sb-user">
          <div style={{ fontSize: 12, color: '#90a8bb' }}>{SCHOOL.term}</div>
          <button className="logout" title="Log out" onClick={onLogout}>⎋ Log out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h2>{mod.label}</h2>
            <div className="subtitle">{roNote ? `${mod.subtitle} · ${roNote}` : mod.subtitle}</div>
          </div>
          <div className="drop-anchor" style={{ marginLeft: 'auto' }}>
            <div className="search" style={{ marginLeft: 0 }}>
              <span>🔍</span>
              <input
                placeholder={isStudent ? 'Search my courses, results…' : 'Search learners, staff, invoices…'}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {q.trim().length >= 2 && (
              <div className="drop">
                {results.length === 0 ? (
                  <div className="drop-empty">No results for “{q}”</div>
                ) : (
                  results.map(([label, sub, type, tone, mod], i) => (
                    <button key={i} className="drop-item" onClick={() => goTo(mod, type === 'Student' ? label : null)}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{label}</div>
                        <div className="di-sub">{sub}</div>
                      </div>
                      <Badge tone={tone}>{type}</Badge>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="date">{TODAY}</div>
          {!isStudent && (<>
          <div className="drop-anchor">
            <button className="icon-btn" title="Messages" onClick={() => { setShowMsg((v) => !v); setShowNotif(false) }}>
              <span className="gs">✉️</span><span className="dot" />
            </button>
            {showMsg && (
              <div className="drop">
                <div className="dhead">Messages</div>
                {[
                  ['Meme Nakanyala (parent, Gr 10B)', 'Requesting a payment plan for Term 3 fees…', '25 min ago', 'finance'],
                  ['Johannes Haufiku (HOD)', 'Humanities dept meeting moved to Friday 13:00', '2 h ago', 'scheduling'],
                  ['NamRA eServices', 'June PAYE submission accepted — ref 2026/06/8841', 'Yesterday', 'hr'],
                ].map(([from, text, time, mod], i) => (
                  <button key={i} className="drop-item" onClick={() => goTo(mod)}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{from}</div>
                      <div className="di-sub">{text}</div>
                      <div className="di-sub">{time}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="drop-anchor">
            <button className="icon-btn" title="Notifications" onClick={() => { setShowNotif((v) => !v); setShowMsg(false) }}>
              <span className="gs">🔔</span><span className="dot" />
            </button>
            {showNotif && (
              <div className="drop">
                <div className="dhead">Notifications</div>
                {ACTIVITY_FEED.slice(0, 5).map((f, i) => (
                  <button key={i} className="drop-item" onClick={() => goTo(f.mod)}>
                    <span className="gs" style={{ fontSize: 15 }}>{f.icon}</span>
                    <div>
                      <div>{f.text}</div>
                      <div className="di-sub">{f.time}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </>)}
          <div className="drop-anchor">
            <button className="icon-btn" title="Account" style={{ padding: 4 }} onClick={() => { setShowUser((v) => !v); setShowNotif(false); setShowMsg(false) }}>
              <Avatar name={role.user} size={30} />
            </button>
            {showUser && (
              <div className="drop" style={{ minWidth: 220 }}>
                <div className="dhead">{role.user}</div>
                <div style={{ padding: '4px 14px 10px', fontSize: 12, color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)' }}>
                  {role.name} · Symanek Suite
                </div>
                <button className="drop-item" onClick={() => setShowUser(false)}>My profile & preferences</button>
                <button className="drop-item" style={{ color: 'var(--red)', fontWeight: 600 }} onClick={onLogout}>
                  ⎋ Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <Comp role={role} openPOS={() => setShowPOS(true)} go={goTo} focus={focus} clearFocus={() => setFocus(null)} />
        </main>
      </div>
    </div>
  )
}
