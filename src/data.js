// ============================================================
// SYMANEK SUITE — mock data set
// Symanek Specialized College — Semester 2, 2026
// All figures in Namibian Dollars (N$)
// ============================================================

export const SCHOOL = {
  name: 'Symanek Specialized College',
  term: 'Semester 2, 2026',
  learners: 476,
  staff: 64,
}

export const fmtN = (n) =>
  'N$ ' + n.toLocaleString('en-NA', { maximumFractionDigits: n % 1 ? 2 : 0 })

// ---------- roles ----------
export const ROLES = [
  { id: 'admin', name: 'School Admin', icon: '🏛️', color: 'var(--petrol-100)', desc: 'Full control — every module', user: 'Maria Amukoto' },
  { id: 'bursar', name: 'Finance / Bursar', icon: '💰', color: 'var(--green-soft)', desc: 'Finance, accounting & canteen reports', user: 'Petrus Shilongo' },
  { id: 'hr', name: 'HR Officer', icon: '🗂️', color: 'var(--purple-soft)', desc: 'HR & payroll, staff records', user: 'Ndapewa Amutenya' },
  { id: 'teacher', name: 'Lecturer', icon: '📗', color: 'var(--blue-soft)', desc: 'Own timetable, gradebook, leave', user: 'Tobias Shikongo' },
  { id: 'seller', name: 'Canteen Seller', icon: '🧾', color: 'var(--amber-soft)', desc: 'POS screen only — locked down', user: 'Ester Nghifikwa' },
  { id: 'librarian', name: 'Librarian', icon: '📚', color: 'var(--red-soft)', desc: 'Library module only', user: 'Frans Kandjii' },
  { id: 'student', name: 'Student', icon: '🎓', color: 'var(--blue-soft)', desc: 'My registration, grades, timetable & fees', user: 'Gabriel !Naruseb' },
  { id: 'registrar', name: 'Registrar', icon: '📋', color: 'var(--petrol-100)', desc: 'Records, exams, graduation & compliance', user: 'Marta Kavezeri' },
  { id: 'applicant', name: 'Applicant', icon: '✍️', color: 'var(--orange-soft)', desc: 'Apply online & track admission', user: 'Justina Haikali' },
]

// ---------- dashboard ----------
export const ENROLMENT_BY_GRADE = [
  { grade: 'DBA-6', count: 74 },
  { grade: 'DAF-6', count: 61 },
  { grade: 'CIT-5', count: 48 },
  { grade: 'CVT-4', count: 96 },
  { grade: 'BED-7', count: 32 },
  { grade: 'Short courses', count: 120 },
  { grade: 'Bridging', count: 45 },
]

export const FEE_COLLECTION = {
  collected: 1420000,
  target: 1630000,
  outstanding: 210000,
  inArrears: 94,
}

export const ACTIVITY_FEED = [
  { icon: '📨', bg: 'var(--blue-soft)', text: 'New application — Justina Haikali applied for Diploma in Business Administration (2027 intake)', time: '5 min ago', mod: 'admissions' },
  { icon: '💳', bg: 'var(--green-soft)', text: 'Payment received — N$ 3,650 from L. Ndeshipanda (Gr 11B invoice INV-2214)', time: '8 min ago', mod: 'finance' },
  { icon: '🌴', bg: 'var(--blue-soft)', text: 'Leave request submitted — Selma Iyambo, Annual leave, 3 days', time: '32 min ago', mod: 'hr' },
  { icon: '📦', bg: 'var(--orange-soft)', text: 'Canteen stock low — Bread Rolls below reorder point (12 left)', time: '1 h ago', mod: 'canteen' },
  { icon: '📕', bg: 'var(--red-soft)', text: 'Book overdue — "Accounting Grade 12" out 9 days, T. Gaoseb (Gr 12A)', time: '2 h ago', mod: 'library' },
  { icon: '🧑‍🏫', bg: 'var(--purple-soft)', text: 'Staff onboarded — Loide Nangolo added to Languages department', time: 'Yesterday', mod: 'hr' },
  { icon: '🧾', bg: 'var(--petrol-50)', text: 'Invoice batch generated — 476 Semester 2 invoices issued', time: 'Yesterday', mod: 'finance' },
]

// ---------- scheduling ----------
export const PERIODS = [
  { id: 'P1', time: '07:30–08:15' },
  { id: 'P2', time: '08:15–09:00' },
  { id: 'P3', time: '09:00–09:45' },
  { id: 'BRK', time: '09:45–10:15' },
  { id: 'P4', time: '10:15–11:00' },
  { id: 'P5', time: '11:00–11:45' },
  { id: 'P6', time: '11:45–12:30' },
]

export const SUBJECT_STYLES = {
  'Phys. Science': 'subj-sci',
  Mathematics: 'subj-math',
  English: 'subj-eng',
  Humanities: 'subj-hum',
  Accounting: 'subj-acc',
  'Voc. Skills': 'subj-voc',
}

// timetable for DBA-6 Y1 — [P1..P6][Mon..Fri], null = free
export const TIMETABLE_10B = {
  P1: [
    { s: 'Mathematics', r: 'Rm 12' }, { s: 'English', r: 'Rm 4' }, { s: 'Phys. Science', r: 'Lab 2' },
    { s: 'Mathematics', r: 'Rm 12' }, { s: 'Humanities', r: 'Rm 7' },
  ],
  P2: [
    { s: 'Phys. Science', r: 'Lab 2' }, { s: 'Mathematics', r: 'Rm 12' }, { s: 'English', r: 'Rm 4' },
    { s: 'Accounting', r: 'Rm 9' }, { s: 'Phys. Science', r: 'Lab 2' },
  ],
  P3: [
    { s: 'English', r: 'Rm 4' }, { s: 'Humanities', r: 'Rm 7' }, { s: 'Accounting', r: 'Rm 9' },
    { s: 'English', r: 'Rm 4' }, { s: 'Mathematics', r: 'Rm 12' },
  ],
  P4: [
    { s: 'Humanities', r: 'Rm 7' }, { s: 'Accounting', r: 'Rm 9' }, { s: 'Mathematics', r: 'Rm 12' },
    { s: 'Phys. Science', r: 'Lab 2' }, null,
  ],
  P5: [
    { s: 'Accounting', r: 'Rm 9' }, { s: 'Phys. Science', r: 'Lab 2' }, null,
    { s: 'Humanities', r: 'Rm 7' }, { s: 'English', r: 'Rm 4' },
  ],
  P6: [
    { s: 'Voc. Skills', r: 'Wksp 1' }, null, { s: 'Voc. Skills', r: 'Wksp 1' },
    null, { s: 'Voc. Skills', r: 'Wksp 1' },
  ],
}

const TIMETABLE_11A = {
  P1: [
    { s: 'English', r: 'Rm 4' }, { s: 'Phys. Science', r: 'Lab 1' }, { s: 'Mathematics', r: 'Rm 12' },
    { s: 'Humanities', r: 'Rm 7' }, { s: 'Accounting', r: 'Rm 9' },
  ],
  P2: [
    { s: 'Mathematics', r: 'Rm 12' }, { s: 'Phys. Science', r: 'Lab 1' }, { s: 'Humanities', r: 'Rm 7' },
    { s: 'English', r: 'Rm 4' }, { s: 'Mathematics', r: 'Rm 12' },
  ],
  P3: [
    { s: 'Accounting', r: 'Rm 9' }, { s: 'English', r: 'Rm 4' }, { s: 'Phys. Science', r: 'Lab 1' },
    { s: 'Phys. Science', r: 'Lab 1' }, { s: 'Humanities', r: 'Rm 7' },
  ],
  P4: [
    { s: 'Phys. Science', r: 'Lab 1' }, { s: 'Mathematics', r: 'Rm 12' }, { s: 'English', r: 'Rm 4' },
    null, { s: 'Voc. Skills', r: 'Wksp 1' },
  ],
  P5: [
    { s: 'Humanities', r: 'Rm 7' }, null, { s: 'Accounting', r: 'Rm 9' },
    { s: 'Mathematics', r: 'Rm 12' }, { s: 'Phys. Science', r: 'Lab 1' },
  ],
  P6: [
    null, { s: 'Voc. Skills', r: 'Wksp 1' }, null, { s: 'Accounting', r: 'Rm 9' }, null,
  ],
}

const TIMETABLE_12A = {
  P1: [
    { s: 'Phys. Science', r: 'Lab 1' }, { s: 'Accounting', r: 'Rm 9' }, { s: 'English', r: 'Rm 4' },
    { s: 'Mathematics', r: 'Rm 12' }, { s: 'Phys. Science', r: 'Lab 1' },
  ],
  P2: [
    { s: 'Mathematics', r: 'Rm 12' }, { s: 'Humanities', r: 'Rm 7' }, { s: 'Accounting', r: 'Rm 9' },
    { s: 'English', r: 'Rm 4' }, { s: 'Mathematics', r: 'Rm 12' },
  ],
  P3: [
    { s: 'English', r: 'Rm 4' }, { s: 'Phys. Science', r: 'Lab 1' }, { s: 'Mathematics', r: 'Rm 12' },
    { s: 'Humanities', r: 'Rm 7' }, { s: 'Accounting', r: 'Rm 9' },
  ],
  P4: [
    { s: 'Humanities', r: 'Rm 7' }, { s: 'English', r: 'Rm 4' }, { s: 'Phys. Science', r: 'Lab 1' },
    { s: 'Accounting', r: 'Rm 9' }, null,
  ],
  P5: [
    { s: 'Accounting', r: 'Rm 9' }, { s: 'Mathematics', r: 'Rm 12' }, null,
    { s: 'Phys. Science', r: 'Lab 1' }, { s: 'English', r: 'Rm 4' },
  ],
  P6: [
    { s: 'Phys. Science', r: 'Lab 1' }, null, { s: 'Humanities', r: 'Rm 7' },
    { s: 'Phys. Science', r: 'Lab 1' }, null,
  ],
}

export const TIMETABLES = {
  'DBA-6 Y1': TIMETABLE_10B,
  'DAF-6 Y2': TIMETABLE_11A,
  'CVT-4 Y2': TIMETABLE_12A,
}

export const DUTY_ROSTER = [
  { staff: 'Tobias Shikongo', duties: ['Workshop supervision', '—', 'Exam invigilation', '—', 'Student advising'] },
  { staff: 'Selma Iyambo', duties: ['—', 'Lab supervision', '—', 'Exam invigilation', '—'] },
  { staff: 'Johannes Haufiku', duties: ['Student advising', '—', 'Exam invigilation', '—', 'Open day desk'] },
  { staff: 'Loide Nangolo', duties: ['—', 'Exam invigilation', '—', 'Lab supervision', '—'] },
  { staff: 'Ester Nghifikwa', duties: ['Front desk', '—', '—', 'Open day desk', '—'] },
  { staff: 'Frans Kandjii', duties: ['—', 'Library support', 'Exam invigilation', '—', 'Front desk'] },
]

// ---------- finance ----------
export const FIN_STATS = {
  collected: 1420000,
  outstanding: 210000,
  expenses: 986000,
  net: 434000,
}

export const EXPENSE_BREAKDOWN = [
  { cat: 'Salaries', pct: 58, amount: 571880 },
  { cat: 'Materials', pct: 11, amount: 108460 },
  { cat: 'Canteen supplies', pct: 10, amount: 98600 },
  { cat: 'Utilities', pct: 8, amount: 78880 },
  { cat: 'Transport', pct: 7, amount: 69020 },
  { cat: 'Maintenance', pct: 6, amount: 59160 },
]

export const COLLECTION_BY_BAND = [
  { band: 'DBA-6 · Diploma', billed: 549050, collected: 507800, rate: 92 },
  { band: 'DAF-6 · Diploma', billed: 633600, collected: 551900, rate: 87 },
  { band: 'CIT-5 · Certificate', billed: 309160, collected: 262100, rate: 85 },
  { band: 'CVT-4 · Certificate', billed: 312960, collected: 244800, rate: 78 },
  { band: 'BED-7 · Bachelor', billed: 89280, collected: 53400, rate: 60 },
]

export const INVOICES = [
  { id: 'INV-2214', learner: 'Lahja Ndeshipanda', grade: 'CIT-5 Y1', amount: 11200, balance: 0, due: '15 Jul 2026', status: 'Paid' },
  { id: 'INV-2215', learner: 'Tuhafeni Gaoseb', grade: 'DAF-6 Y2', amount: 13100, balance: 6550, due: '15 Jul 2026', status: 'Partial' },
  { id: 'INV-2216', learner: 'Ndinelago Hamutenya', grade: 'DBA-6 Y1', amount: 11200, balance: 11200, due: '30 Jun 2026', status: 'Overdue' },
  { id: 'INV-2217', learner: 'Gabriel !Naruseb', grade: 'CVT-4 Y2', amount: 16300, balance: 16300, due: '15 Jul 2026', status: 'Pending' },
  { id: 'INV-2218', learner: 'Helena Shivute', grade: 'BED-7 Y1', amount: 9700, balance: 0, due: '15 Jul 2026', status: 'Paid' },
  { id: 'INV-2219', learner: 'Immanuel Tjiho', grade: 'BED-7 Y1', amount: 9700, balance: 4850, due: '15 Jul 2026', status: 'Partial' },
  { id: 'INV-2220', learner: 'Rauna Nakale', grade: 'DAF-6 Y1', amount: 7200, balance: 7200, due: '25 Jun 2026', status: 'Overdue' },
  { id: 'INV-2221', learner: 'Sakaria Ipinge', grade: 'DAF-6 Y2', amount: 13100, balance: 0, due: '15 Jul 2026', status: 'Paid' },
]

export const FEE_STRUCTURE = [
  { band: 'DBA-6 · Diploma', tuition: 8400, levy: 1300, learners: 74 },
  { band: 'DAF-6 · Diploma', tuition: 9700, levy: 1500, learners: 61 },
  { band: 'CIT-5 · Certificate', tuition: 11400, levy: 1700, learners: 48 },
  { band: 'CVT-4 · Certificate', tuition: 14200, levy: 2100, learners: 96 },
  { band: 'BED-7 · Bachelor', tuition: 6400, levy: 800, learners: 32 },
]

// ---------- HR & payroll ----------
export const STAFF = [
  { id: 'SYM-001', name: 'Tobias Shikongo', role: 'Lecturer — Physical Sciences', dept: 'Sciences', contract: 'Permanent', status: 'Active', joined: 'Jan 2019', phone: '+264 81 234 5671' },
  { id: 'SYM-002', name: 'Selma Iyambo', role: 'Lecturer — Mathematics', dept: 'Mathematics', contract: 'Permanent', status: 'Active', joined: 'Jan 2020', phone: '+264 81 234 5672' },
  { id: 'SYM-003', name: 'Johannes Haufiku', role: 'HOD — Humanities', dept: 'Humanities', contract: 'Permanent', status: 'Active', joined: 'Jan 2016', phone: '+264 81 234 5673' },
  { id: 'SYM-004', name: 'Loide Nangolo', role: 'Lecturer — Languages', dept: 'Languages', contract: 'Contract', status: 'Active', joined: 'Jun 2025', phone: '+264 81 234 5674' },
  { id: 'SYM-005', name: 'Ester Nghifikwa', role: 'Canteen Attendant', dept: 'Support', contract: 'Casual', status: 'Active', joined: 'Feb 2024', phone: '+264 81 234 5675' },
  { id: 'SYM-006', name: 'Frans Kandjii', role: 'Librarian', dept: 'Support', contract: 'Permanent', status: 'Active', joined: 'Jan 2018', phone: '+264 81 234 5676' },
  { id: 'SYM-007', name: 'Ndapewa Amutenya', role: 'HR Officer', dept: 'Administration', contract: 'Permanent', status: 'On Leave', joined: 'Mar 2021', phone: '+264 81 234 5677' },
  { id: 'SYM-008', name: 'Petrus Shilongo', role: 'Bursar', dept: 'Administration', contract: 'Permanent', status: 'Active', joined: 'Jan 2017', phone: '+264 81 234 5678' },
]

export const staffEmail = (name) =>
  name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/ +/).join('.') + '@symanek.edu.na'

export const LEAVE_REQUESTS = [
  { id: 1, name: 'Selma Iyambo', type: 'Annual', days: 3, period: '14–16 Jul 2026', status: 'Pending' },
  { id: 2, name: 'Loide Nangolo', type: 'Sick', days: 2, period: '06–07 Jul 2026', status: 'Pending' },
  { id: 3, name: 'Johannes Haufiku', type: 'Compassionate', days: 4, period: '20–23 Jul 2026', status: 'Pending' },
  { id: 4, name: 'Ndapewa Amutenya', type: 'Maternity', days: 84, period: '01 Jun – 23 Aug 2026', status: 'Approved' },
  { id: 5, name: 'Frans Kandjii', type: 'Annual', days: 5, period: '18–22 May 2026', status: 'Approved' },
  { id: 6, name: 'Ester Nghifikwa', type: 'Sick', days: 1, period: '02 Jun 2026', status: 'Declined' },
]

// gross only — PAYE/SSC are computed live from the NamRA tables below
// (mirrors the Genesis_HR_v4 payroll engine)
export const PAYROLL = [
  { name: 'Tobias Shikongo', gross: 24500 },
  { name: 'Selma Iyambo', gross: 23800 },
  { name: 'Johannes Haufiku', gross: 31200 },
  { name: 'Loide Nangolo', gross: 19600 },
  { name: 'Ester Nghifikwa', gross: 6800 },
  { name: 'Frans Kandjii', gross: 14200 },
]

// ---------- teacher portal (Tobias Shikongo) ----------
export const TEACHER_CLASSES = [
  { cls: 'DBA-6 Y1', subject: 'Phys. Science', learners: 34, avg: 61 },
  { cls: 'DAF-6 Y2', subject: 'Phys. Science', learners: 31, avg: 66 },
  { cls: 'CVT-4 Y2', subject: 'Phys. Science', learners: 28, avg: 58 },
]

// teacher's own weekly slots — [P1..P6][Mon..Fri]
export const TEACHER_TIMETABLE = {
  P1: [null, null, { s: 'Phys. Science', r: '10B · Lab 2' }, null, { s: 'Phys. Science', r: '12A · Lab 1' }],
  P2: [{ s: 'Phys. Science', r: '10B · Lab 2' }, { s: 'Phys. Science', r: '11A · Lab 1' }, null, null, { s: 'Phys. Science', r: '10B · Lab 2' }],
  P3: [null, { s: 'Phys. Science', r: '12A · Lab 1' }, null, { s: 'Phys. Science', r: '11A · Lab 1' }, null],
  P4: [{ s: 'Phys. Science', r: '11A · Lab 1' }, null, { s: 'Phys. Science', r: '12A · Lab 1' }, { s: 'Phys. Science', r: '10B · Lab 2' }, null],
  P5: [null, { s: 'Phys. Science', r: '10B · Lab 2' }, null, null, { s: 'Phys. Science', r: '11A · Lab 1' }],
  P6: [{ s: 'Phys. Science', r: '12A · Lab 1' }, null, null, { s: 'Phys. Science', r: '12A · Lab 1' }, null],
}

export const GRADEBOOK = [
  { learner: 'Ndinelago Hamutenya', t1: 64, t2: 68, t3: 71 },
  { learner: 'Petrina Shaanika', t1: 72, t2: 70, t3: 74 },
  { learner: 'Kandali Amupolo', t1: 55, t2: 58, t3: 56 },
  { learner: 'Josef Uirab', t1: 48, t2: 52, t3: 57 },
  { learner: 'Maria Nekundi', t1: 81, t2: 79, t3: 84 },
  { learner: 'Simon Hangula', t1: 60, t2: 55, t3: 52 },
  { learner: 'Ndeshi Kambonde', t1: 67, t2: 71, t3: 70 },
  { learner: 'Paulus Nuuyoma', t1: 44, t2: 49, t3: 51 },
]

export const GRADEBOOKS = {
  'DBA-6 Y1': GRADEBOOK,
  'DAF-6 Y2': [
    { learner: 'Ndeshi Kambonde', t1: 67, t2: 71, t3: 70 },
    { learner: 'Tangeni Amupanda', t1: 74, t2: 72, t3: 76 },
    { learner: 'Saara Nghixulifwa', t1: 59, t2: 63, t3: 65 },
    { learner: 'Elifas Shindondola', t1: 51, t2: 54, t3: 53 },
    { learner: 'Hilya Nampala', t1: 78, t2: 81, t3: 83 },
    { learner: 'Gerson Tjivikua', t1: 62, t2: 58, t3: 61 },
    { learner: 'Ndapanda Shilongo', t1: 70, t2: 69, t3: 72 },
    { learner: 'Absalom Nghipondoka', t1: 47, t2: 50, t3: 54 },
  ],
  'CVT-4 Y2': [
    { learner: 'Tuhafeni Gaoseb', t1: 58, t2: 61, t3: 60 },
    { learner: 'Maria Nekundi', t1: 81, t2: 79, t3: 84 },
    { learner: 'Fillemon Amadhila', t1: 55, t2: 52, t3: 57 },
    { learner: 'Ndeyapo Iithete', t1: 66, t2: 68, t3: 71 },
    { learner: 'Lukas Khairabeb', t1: 49, t2: 53, t3: 52 },
    { learner: 'Twapewa Hamukwaya', t1: 72, t2: 75, t3: 74 },
    { learner: 'Set-son Garoeb', t1: 60, t2: 57, t3: 59 },
    { learner: 'Anna Shiweda', t1: 76, t2: 78, t3: 80 },
  ],
}

export const PAYMENTS = [
  { date: '03 Jul 2026', invoice: 'INV-2214', learner: 'Lahja Ndeshipanda', method: 'Bank transfer', amount: 3650 },
  { date: '02 Jul 2026', invoice: 'INV-2221', learner: 'Sakaria Ipinge', method: 'Cash', amount: 13100 },
  { date: '01 Jul 2026', invoice: 'INV-2215', learner: 'Tuhafeni Gaoseb', method: 'Card', amount: 6550 },
  { date: '30 Jun 2026', invoice: 'INV-2218', learner: 'Helena Shivute', method: 'Bank transfer', amount: 9700 },
  { date: '28 Jun 2026', invoice: 'INV-2219', learner: 'Immanuel Tjiho', method: 'Cash', amount: 4850 },
]

export const LEAVE_BALANCES = [
  { type: 'Annual', total: 24, used: 6 },
  { type: 'Sick', total: 30, used: 2 },
  { type: 'Compassionate', total: 5, used: 0 },
]

// Tobias — PAYE per 2024/25 brackets: N$294,000/yr → 9,000 + 25% × 144,000 = 45,000/yr
export const PAYSLIP = { month: 'June 2026', gross: 24500, paye: 3750, ssc: 81, net: 20669 }

// ---------- canteen ----------
export const CANTEEN_STATS = {
  salesToday: 4180,
  transactions: 187,
  avgBasket: 22.35,
  margin: 41,
}

export const TOP_SELLERS = [
  { item: 'Beef Kapana Roll', units: 46, revenue: 1012 },
  { item: 'Coca-Cola 300ml', units: 58, revenue: 812 },
  { item: 'Chicken & Chips', units: 21, revenue: 735 },
  { item: 'Vetkoek + Mince', units: 33, revenue: 594 },
  { item: 'Lunch Combo', units: 11, revenue: 495 },
]

export const HOURLY_SALES = [
  { h: '07h', v: 320 }, { h: '08h', v: 240 }, { h: '09h', v: 410 },
  { h: '10h', v: 1450 }, { h: '11h', v: 630 }, { h: '12h', v: 780 }, { h: '13h', v: 350 },
]

export const INVENTORY = [
  { item: 'Beef Kapana Roll', cat: 'Meals', stock: 38, reorder: 15, cost: 13, price: 22 },
  { item: 'Chicken & Chips', cat: 'Meals', stock: 24, reorder: 10, cost: 21, price: 35 },
  { item: 'Vetkoek + Mince', cat: 'Meals', stock: 41, reorder: 15, cost: 10, price: 18 },
  { item: 'Meat Pie', cat: 'Snacks', stock: 29, reorder: 12, cost: 9.5, price: 16 },
  { item: 'Bread Roll', cat: 'Snacks', stock: 12, reorder: 20, cost: 3, price: 6 },
  { item: 'Fruit Cup', cat: 'Snacks', stock: 18, reorder: 8, cost: 7, price: 12 },
  { item: 'Coca-Cola 300ml', cat: 'Drinks', stock: 64, reorder: 24, cost: 9, price: 14 },
  { item: 'Water 500ml', cat: 'Drinks', stock: 82, reorder: 24, cost: 4.5, price: 8 },
  { item: 'Lunch Combo', cat: 'Combos', stock: 15, reorder: 6, cost: 28, price: 45 },
]

export const TILL_SESSIONS = [
  { seller: 'Ester Nghifikwa', opened: '07:05', closed: '—', txns: 187, cash: 2926, card: 1254, status: 'Open' },
  { seller: 'Ester Nghifikwa', opened: '07:02', closed: '14:10', txns: 214, cash: 3180, card: 1462, status: 'Closed', day: 'Yesterday' },
  { seller: 'Hilma Shipanga', opened: '07:10', closed: '14:05', txns: 176, cash: 2540, card: 1105, status: 'Closed', day: 'Yesterday' },
  { seller: 'Hilma Shipanga', opened: '07:00', closed: '14:00', txns: 198, cash: 2895, card: 1330, status: 'Closed', day: 'Mon 29 Jun' },
]

export const POS_PRODUCTS = [
  { id: 1, name: 'Beef Kapana Roll', price: 22, emoji: '🌯', cat: 'Meals', stock: 38, popular: true },
  { id: 2, name: 'Chicken & Chips', price: 35, emoji: '🍗', cat: 'Meals', stock: 24, popular: true },
  { id: 3, name: 'Vetkoek + Mince', price: 18, emoji: '🥙', cat: 'Meals', stock: 41, popular: true },
  { id: 4, name: 'Meat Pie', price: 16, emoji: '🥧', cat: 'Snacks', stock: 29, popular: true },
  { id: 5, name: 'Bread Roll', price: 6, emoji: '🥖', cat: 'Snacks', stock: 12, popular: true },
  { id: 6, name: 'Fruit Cup', price: 12, emoji: '🍉', cat: 'Snacks', stock: 18, popular: true },
  { id: 7, name: 'Coca-Cola 300ml', price: 14, emoji: '🥤', cat: 'Drinks', stock: 64, popular: true },
  { id: 8, name: 'Water 500ml', price: 8, emoji: '💧', cat: 'Drinks', stock: 82, popular: true },
  { id: 9, name: 'Orange Juice 300ml', price: 15, emoji: '🍊', cat: 'Drinks', stock: 36, popular: true },
  { id: 10, name: 'Lunch Combo', price: 45, emoji: '🍱', cat: 'Combos', stock: 15, popular: true },
  { id: 11, name: 'Snack Combo', price: 28, emoji: '🧺', cat: 'Combos', stock: 22, popular: false },
]

export const POS_CATS = ['Popular', 'Meals', 'Snacks', 'Drinks', 'Combos']

// ---------- students (Student 360) ----------
export const LEARNERS = [
  { id: 'STU-1041', name: 'Ndinelago Hamutenya', grade: 'DBA-6 Y1', guardian: 'Meme T. Hamutenya', phone: '+264 81 445 2201', status: 'Enrolled', attendance: 96 },
  { id: 'STU-0872', name: 'Tuhafeni Gaoseb', grade: 'DAF-6 Y2', guardian: 'Mr. E. Gaoseb', phone: '+264 81 445 2202', status: 'Enrolled', attendance: 88 },
  { id: 'STU-0913', name: 'Lahja Ndeshipanda', grade: 'CIT-5 Y1', guardian: 'Ms. H. Ndeshipanda', phone: '+264 81 445 2203', status: 'Enrolled', attendance: 98 },
  { id: 'STU-1055', name: 'Petrina Shaanika', grade: 'DBA-6 Y1', guardian: 'Mr. J. Shaanika', phone: '+264 81 445 2204', status: 'Enrolled', attendance: 94 },
  { id: 'STU-0844', name: 'Maria Nekundi', grade: 'DAF-6 Y2', guardian: 'Dr. L. Nekundi', phone: '+264 81 445 2205', status: 'Enrolled', attendance: 99 },
  { id: 'STU-1067', name: 'Josef Uirab', grade: 'DBA-6 Y1', guardian: 'Ms. K. Uiras', phone: '+264 81 445 2206', status: 'Enrolled', attendance: 81 },
  { id: 'STU-1298', name: 'Helena Shivute', grade: 'BED-7 Y1', guardian: 'Meme N. Shivute', phone: '+264 81 445 2207', status: 'Enrolled', attendance: 97 },
  { id: 'STU-1204', name: 'Immanuel Tjiho', grade: 'BED-7 Y1', guardian: 'Mr. P. Tjiho', phone: '+264 81 445 2208', status: 'Enrolled', attendance: 90 },
  { id: 'STU-0790', name: 'Gabriel !Naruseb', grade: 'CVT-4 Y2', guardian: 'NTA sponsorship', phone: '+264 81 445 2209', status: 'Sponsored', attendance: 92 },
  { id: 'STU-0651', name: 'Rauna Nakale', grade: 'DAF-6 Y1', guardian: '(self)', phone: '+264 81 445 2210', status: 'Enrolled', attendance: 76 },
]

export const INCIDENTS = [
  { learner: 'Josef Uirab', date: '22 Jun 2026', type: 'Attendance below 75% (S1)', action: 'Academic advising referral', by: 'J. Haufiku' },
  { learner: 'Tuhafeni Gaoseb', date: '10 Jun 2026', type: 'Academic integrity — late submission', action: 'Written warning', by: 'M. Amukoto' },
  { learner: 'Immanuel Tjiho', date: '28 May 2026', type: 'Lab safety breach', action: 'Verbal warning', by: 'S. Iyambo' },
]

// ---------- collections work queue (bursar) ----------
export const DEBTORS = [
  { id: 1, learner: 'Ndinelago Hamutenya', grade: 'DBA-6 Y1', balance: 11200, daysOver: 34, stage: 'Letter sent', promise: null, guardian: 'Meme T. Hamutenya · +264 81 445 2201' },
  { id: 2, learner: 'Rauna Nakale', grade: 'DAF-6 Y1', balance: 7200, daysOver: 39, stage: 'Reminder sent', promise: '15 Jul 2026', guardian: '(self) · +264 81 445 2210' },
  { id: 3, learner: 'Tuhafeni Gaoseb', grade: 'DAF-6 Y2', balance: 6550, daysOver: 19, stage: 'Reminder sent', promise: null, guardian: 'Mr. E. Gaoseb · +264 81 445 2202' },
  { id: 4, learner: 'Immanuel Tjiho', grade: 'BED-7 Y1', balance: 4850, daysOver: 12, stage: 'New', promise: null, guardian: 'Mr. P. Tjiho · +264 81 445 2208' },
  { id: 5, learner: 'Gabriel !Naruseb', grade: 'CVT-4 Y2', balance: 16300, daysOver: 5, stage: 'New', promise: null, guardian: 'NTA claim pending · ref VET-2026-081' },
]

// ---------- relief / substitution board ----------
export const RELIEF_TODAY = [
  { teacher: 'Selma Iyambo', reason: 'Sick leave', periods: [
    { p: 'P2', cls: 'DBA-6 Y1', subject: 'Mathematics', room: 'Rm 12', cover: null, options: ['Tobias Shikongo', 'Loide Nangolo'] },
    { p: 'P3', cls: 'CVT-4 Y2', subject: 'Mathematics', room: 'Rm 12', cover: null, options: ['Johannes Haufiku', 'Loide Nangolo'] },
    { p: 'P5', cls: 'DAF-6 Y2', subject: 'Mathematics', room: 'Rm 12', cover: null, options: ['Tobias Shikongo', 'Frans Kandjii'] },
  ]},
  { teacher: 'Loide Nangolo', reason: 'NIED workshop (pm)', periods: [
    { p: 'P6', cls: 'Grade 9C', subject: 'English', room: 'Rm 4', cover: null, options: ['Johannes Haufiku'] },
  ]},
]

// ---------- HOD moderation ----------
export const MODERATION = [
  { cls: 'DBA-6 Y1', subject: 'Phys. Science', teacher: 'Tobias Shikongo', avg: 64, submitted: '02 Jul 2026', status: 'Awaiting moderation' },
  { cls: 'DAF-6 Y2', subject: 'Phys. Science', teacher: 'Tobias Shikongo', avg: 66, submitted: '02 Jul 2026', status: 'Awaiting moderation' },
  { cls: 'CVT-4 Y2', subject: 'Mathematics', teacher: 'Selma Iyambo', avg: 58, submitted: '01 Jul 2026', status: 'Awaiting moderation' },
  { cls: 'DBA-6 Y1', subject: 'Mathematics', teacher: 'Selma Iyambo', avg: 61, submitted: '30 Jun 2026', status: 'Approved' },
  { cls: 'CVT-4 Y2', subject: 'English', teacher: 'Loide Nangolo', avg: 67, submitted: '29 Jun 2026', status: 'Approved' },
]

export const AT_RISK = [
  { learner: 'Paulus Nuuyoma', grade: '10B', failing: ['Phys. Science 51', 'Mathematics 44', 'Accounting 47'], attendance: 84 },
  { learner: 'Lukas Khairabeb', grade: '12A', failing: ['Phys. Science 52', 'Mathematics 46', 'English 49'], attendance: 79 },
  { learner: 'Josef Uirab', grade: '10B', failing: ['Mathematics 43', 'Humanities 48', 'English 46'], attendance: 81 },
  { learner: 'Absalom Nghipondoka', grade: '11A', failing: ['Phys. Science 54', 'Accounting 42', 'Mathematics 49'], attendance: 87 },
]

// ---------- cash flow (director) ----------
export const CASHFLOW = [
  { m: 'Jul', in_: 486, out: 322 },
  { m: 'Aug', in_: 168, out: 318 },
  { m: 'Sep', in_: 512, out: 331 }, // term 3 fees land
  { m: 'Oct', in_: 189, out: 326 },
  { m: 'Nov', in_: 122, out: 340 }, // projected
  { m: 'Dec', in_: 96, out: 385 }, // projected + 13th cheque
] // N$ thousands

// ---------- action queue (owners + due) ----------
export const WORK_QUEUE = [
  { id: 1, task: 'Loide Nangolo contract expires 31 Aug — renew or advertise', owner: 'HR Officer', due: '18 Jul', sev: 'red' },
  { id: 2, task: 'Till variance N$ 214 short — Tue session, needs sign-off', owner: 'Bursar', due: '07 Jul', sev: 'red' },
  { id: 3, task: 'Bread Rolls below reorder point (12 left)', owner: 'Canteen', due: '06 Jul', sev: 'orange' },
  { id: 4, task: '2 overdue invoice batches — start dunning cycle', owner: 'Bursar', due: '08 Jul', sev: 'orange' },
  { id: 5, task: 'NTA claim VET-2026-081 documentation due', owner: 'Bursar', due: '15 Jul', sev: 'orange' },
  { id: 6, task: '3 exam-board results awaiting approval — transcripts blocked', owner: 'Registrar', due: '10 Jul', sev: 'orange' },
  { id: 7, task: '5 applications missing documents — chase before intake close', owner: 'Admissions', due: '14 Jul', sev: 'gray' },
  { id: 8, task: 'EMIS termly return to Ministry', owner: 'Principal', due: '31 Jul', sev: 'gray' },
]

// ---------- library ----------
export const LIBRARY_STATS = { titles: 486, available: 1211, onLoan: 213, overdue: 9 }

export const CATALOGUE = [
  { title: 'Physical Science Grade 12', author: 'M. van Wyk', isbn: '978-99916-42-18-3', cat: 'Textbook', avail: 6, total: 40 },
  { title: 'Accounting Grade 12', author: 'P. Basson', isbn: '978-99916-51-02-4', cat: 'Textbook', avail: 0, total: 30 },
  { title: 'Mathematics Grade 10', author: 'J. Amakali', isbn: '978-99916-38-77-1', cat: 'Textbook', avail: 14, total: 45 },
  { title: 'Things Fall Apart', author: 'Chinua Achebe', isbn: '978-0-435905-25-5', cat: 'Literature', avail: 11, total: 15 },
  { title: 'The Purple Violet of Oshaantu', author: 'Neshani Andreas', isbn: '978-0-435910-08-2', cat: 'Literature', avail: 4, total: 12 },
  { title: 'Oxford English Dictionary (School)', author: 'Oxford Press', isbn: '978-0-19-274941-9', cat: 'Reference', avail: 8, total: 10 },
  { title: 'A History of Namibia', author: 'Marion Wallace', isbn: '978-1-84904-098-4', cat: 'Reference', avail: 3, total: 6 },
  { title: 'Sam Nujoma: A Biography', author: 'S. Nujoma', isbn: '978-99916-40-11-0', cat: 'Biography', avail: 2, total: 4 },
]

export const LOANS = [
  { id: 1, book: 'Accounting Grade 12', borrower: 'Tuhafeni Gaoseb', grade: '12A', issued: '15 Jun 2026', due: '24 Jun 2026', status: 'Overdue' },
  { id: 2, book: 'Physical Science Grade 12', borrower: 'Maria Nekundi', grade: '12A', issued: '22 Jun 2026', due: '06 Jul 2026', status: 'Due Soon' },
  { id: 3, book: 'Things Fall Apart', borrower: 'Petrina Shaanika', grade: '10B', issued: '25 Jun 2026', due: '09 Jul 2026', status: 'On Loan' },
  { id: 4, book: 'A History of Namibia', borrower: 'Loide Nangolo (staff)', grade: '—', issued: '18 Jun 2026', due: '02 Jul 2026', status: 'Overdue' },
  { id: 5, book: 'Mathematics Grade 10', borrower: 'Josef Uirab', grade: '10B', issued: '28 Jun 2026', due: '12 Jul 2026', status: 'On Loan' },
  { id: 6, book: 'The Purple Violet of Oshaantu', borrower: 'Ndeshi Kambonde', grade: '11A', issued: '24 Jun 2026', due: '08 Jul 2026', status: 'On Loan' },
]

// fines: N$2 per overdue day
export const FINES = [
  { id: 1, borrower: 'Tuhafeni Gaoseb', book: 'Accounting Grade 12', days: 9 },
  { id: 2, borrower: 'Loide Nangolo (staff)', book: 'A History of Namibia', days: 1 },
  { id: 3, borrower: 'Simon Hangula', book: 'Meat and Marketing (returned)', days: 6 },
]

// ============================================================
// Academic lifecycle — tertiary layer (programmes, admissions,
// exam board, sponsorships). Additive: school datasets untouched.
// ============================================================

// ---------- programmes & curriculum (NQA / NCHE framing) ----------
export const PROGRAMMES = [
  { code: 'DBA-6', name: 'Diploma in Business Administration', nqf: 6, years: 3, coordinator: 'Johannes Haufiku', enrolled: 74, accreditation: 'NQA Accredited' },
  { code: 'DAF-6', name: 'Diploma in Accounting & Finance', nqf: 6, years: 3, coordinator: 'Petrus Shilongo', enrolled: 61, accreditation: 'NQA Accredited' },
  { code: 'CIT-5', name: 'Certificate in Information Technology', nqf: 5, years: 1, coordinator: 'Selma Iyambo', enrolled: 48, accreditation: 'NQA Accredited' },
  { code: 'CVT-4', name: 'Certificate in Vocational Trades', nqf: 4, years: 2, coordinator: 'Tobias Shikongo', enrolled: 96, accreditation: 'NTA Registered' },
  { code: 'BED-7', name: 'Bachelor of Education (Foundation Phase)', nqf: 7, years: 4, coordinator: 'Loide Nangolo', enrolled: 32, accreditation: 'Provisional' },
]

export const COURSES = [
  { code: 'BBA111', title: 'Principles of Management', prog: 'DBA-6', credits: 12, sem: 'S1', lecturer: 'Johannes Haufiku', enrolled: 42, cap: 45, prereq: '—' },
  { code: 'BBA124', title: 'Business Communication', prog: 'DBA-6', credits: 8, sem: 'S2', lecturer: 'Loide Nangolo', enrolled: 39, cap: 45, prereq: '—' },
  { code: 'ACC110', title: 'Financial Accounting I', prog: 'DAF-6', credits: 16, sem: 'S1', lecturer: 'Petrus Shilongo', enrolled: 44, cap: 45, prereq: '—' },
  { code: 'ACC220', title: 'Financial Accounting II', prog: 'DAF-6', credits: 16, sem: 'S2', lecturer: 'Petrus Shilongo', enrolled: 28, cap: 40, prereq: 'ACC110' },
  { code: 'ITC105', title: 'Computer Literacy & Office Tools', prog: 'CIT-5', credits: 10, sem: 'S1', lecturer: 'Selma Iyambo', enrolled: 46, cap: 48, prereq: '—' },
  { code: 'ITC152', title: 'Introduction to Networks', prog: 'CIT-5', credits: 12, sem: 'S2', lecturer: 'Selma Iyambo', enrolled: 31, cap: 36, prereq: 'ITC105' },
  { code: 'VTW101', title: 'Workshop Practice & Safety', prog: 'CVT-4', credits: 14, sem: 'S1', lecturer: 'Tobias Shikongo', enrolled: 50, cap: 50, prereq: '—' },
  { code: 'VTW210', title: 'Advanced Workshop Practice', prog: 'CVT-4', credits: 14, sem: 'S2', lecturer: 'Tobias Shikongo', enrolled: 44, cap: 50, prereq: 'VTW101' },
  { code: 'TRT120', title: 'Trade Theory & Materials', prog: 'CVT-4', credits: 12, sem: 'S2', lecturer: 'Tobias Shikongo', enrolled: 47, cap: 50, prereq: '—' },
  { code: 'ENT100', title: 'Entrepreneurship for Trades', prog: 'CVT-4', credits: 8, sem: 'S2', lecturer: 'Johannes Haufiku', enrolled: 39, cap: 45, prereq: '—' },
  { code: 'IND199', title: 'Industry Attachment (WIL)', prog: 'CVT-4', credits: 12, sem: 'S2', lecturer: 'Tobias Shikongo', enrolled: 22, cap: 60, prereq: 'VTW101' },
  { code: 'EDU130', title: 'Child Development & Learning', prog: 'BED-7', credits: 12, sem: 'S1', lecturer: 'Loide Nangolo', enrolled: 30, cap: 35, prereq: '—' },
]

// ---------- admissions pipeline (2027 intake) ----------
export const ADMISSION_STAGES = ['Applied', 'Under Review', 'Offer Sent', 'Enrolled']

export const APPLICANTS = [
  { id: 'APP-2701', name: 'Justina Haikali', prog: 'DBA-6', points: 32, stage: 'Applied', applied: '28 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': true, 'Proof of payment (N$ 150)': false } },
  { id: 'APP-2702', name: 'Nangula Amwele', prog: 'DAF-6', points: 35, stage: 'Applied', applied: '30 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': false, 'Proof of payment (N$ 150)': true } },
  { id: 'APP-2703', name: 'Erastus Kapofi', prog: 'CVT-4', points: 24, stage: 'Applied', applied: '01 Jul 2026', docs: { 'Grade 12 certificate': false, 'ID copy': true, 'Proof of payment (N$ 150)': true } },
  { id: 'APP-2704', name: 'Meameno Shixwameni', prog: 'CIT-5', points: 29, stage: 'Under Review', applied: '22 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': true, 'Proof of payment (N$ 150)': true } },
  { id: 'APP-2705', name: 'Panduleni Ekandjo', prog: 'DBA-6', points: 27, stage: 'Under Review', applied: '24 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': true, 'Proof of payment (N$ 150)': true } },
  { id: 'APP-2706', name: 'Victoria Muharukua', prog: 'BED-7', points: 38, stage: 'Offer Sent', applied: '15 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': true, 'Proof of payment (N$ 150)': true } },
  { id: 'APP-2707', name: 'Shapopi Nailenge', prog: 'DAF-6', points: 33, stage: 'Offer Sent', applied: '18 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': true, 'Proof of payment (N$ 150)': true } },
  { id: 'APP-2708', name: 'Ruusa Nghidinwa', prog: 'CIT-5', points: 31, stage: 'Enrolled', applied: '05 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': true, 'Proof of payment (N$ 150)': true } },
  { id: 'APP-2709', name: 'Gerhard Swartbooi', prog: 'CVT-4', points: 26, stage: 'Enrolled', applied: '08 Jun 2026', docs: { 'Grade 12 certificate': true, 'ID copy': true, 'Proof of payment (N$ 150)': true } },
]

export const INTAKES = [
  { prog: 'DBA-6', capacity: 50, applications: 41, offers: 18, enrolled: 9 },
  { prog: 'DAF-6', capacity: 45, applications: 38, offers: 15, enrolled: 8 },
  { prog: 'CIT-5', capacity: 48, applications: 52, offers: 30, enrolled: 14 },
  { prog: 'CVT-4', capacity: 50, applications: 47, offers: 26, enrolled: 12 },
  { prog: 'BED-7', capacity: 35, applications: 22, offers: 10, enrolled: 4 },
]

// ---------- exam board (results locked on approval → transcripts) ----------
export const EXAM_BOARD = [
  { code: 'BBA111', title: 'Principles of Management', lecturer: 'Johannes Haufiku', sat: 42, passRate: 81, avg: 63, status: 'Awaiting approval' },
  { code: 'ACC110', title: 'Financial Accounting I', lecturer: 'Petrus Shilongo', sat: 44, passRate: 68, avg: 57, status: 'Awaiting approval' },
  { code: 'ITC105', title: 'Computer Literacy & Office Tools', lecturer: 'Selma Iyambo', sat: 46, passRate: 91, avg: 71, status: 'Awaiting approval' },
  { code: 'VTW101', title: 'Workshop Practice & Safety', lecturer: 'Tobias Shikongo', sat: 50, passRate: 88, avg: 69, status: 'Published' },
  { code: 'EDU130', title: 'Child Development & Learning', lecturer: 'Loide Nangolo', sat: 30, passRate: 77, avg: 62, status: 'Published' },
]

// letter grade + GPA points from a % mark (institutional scale)
export const gradeOf = (mark) =>
  mark >= 80 ? { letter: 'A', gpa: 4.0 } :
  mark >= 70 ? { letter: 'B', gpa: 3.0 } :
  mark >= 60 ? { letter: 'C', gpa: 2.0 } :
  mark >= 50 ? { letter: 'D', gpa: 1.0 } :
  { letter: 'F', gpa: 0 }

// ---------- sponsorships & bursaries (funding mix) ----------
export const SPONSORS = [
  { id: 1, sponsor: 'NSFAF', type: 'Government loan/grant', learners: ['Gabriel !Naruseb', 'Rauna Nakale'], coverage: 100, billed: 23500, received: 0, status: 'Claim submitted', ref: 'NSFAF-2026-1174' },
  { id: 2, sponsor: 'NTA Levy Fund', type: 'Vocational grant', learners: ['Gabriel !Naruseb'], coverage: 80, billed: 13040, received: 13040, status: 'Paid', ref: 'VET-2026-081' },
  { id: 3, sponsor: 'FNB Namibia Foundation', type: 'Corporate bursary', learners: ['Maria Nekundi'], coverage: 100, billed: 13100, received: 13100, status: 'Paid', ref: 'FNB-BUR-044' },
  { id: 4, sponsor: 'Symanek Merit Bursary', type: 'Institutional', learners: ['Lahja Ndeshipanda', 'Helena Shivute'], coverage: 50, billed: 10450, received: 10450, status: 'Internal transfer', ref: 'SYM-MB-12' },
  { id: 5, sponsor: 'Ohorongo Cement Trust', type: 'Corporate bursary', learners: ['Immanuel Tjiho'], coverage: 75, billed: 7275, received: 0, status: 'Awaiting PO', ref: 'OHG-2026-09' },
]

// ---------- audit log (referenced all over the copy — now visible) ----------
export const AUDIT_LOG = [
  { when: '04 Jul 2026 09:41', who: 'Maria Amukoto', role: 'School Admin', action: 'Approved mark sheet — DBA-6 Y1 Mathematics (locked)', mod: 'Academics' },
  { when: '04 Jul 2026 09:12', who: 'Petrus Shilongo', role: 'Bursar', action: 'Recorded payment N$ 3,650 on INV-2214', mod: 'Finance' },
  { when: '04 Jul 2026 08:55', who: 'Ndapewa Amutenya', role: 'HR Officer', action: 'Approved maternity leave — N. Amutenya (84 days)', mod: 'HR' },
  { when: '03 Jul 2026 16:20', who: 'Maria Amukoto', role: 'School Admin', action: 'Edited fee structure — Vocational tuition N$ 14,200', mod: 'Finance' },
  { when: '03 Jul 2026 14:05', who: 'Ester Nghifikwa', role: 'Canteen Seller', action: 'Till session closed — variance N$ 214 short (flagged)', mod: 'Canteen' },
  { when: '03 Jul 2026 11:30', who: 'Frans Kandjii', role: 'Librarian', action: 'Fine N$ 18 collected — T. Gaoseb', mod: 'Library' },
  { when: '02 Jul 2026 10:15', who: 'Maria Amukoto', role: 'School Admin', action: 'Published exam results — VTW101 (transcripts updated)', mod: 'Academics' },
  { when: '01 Jul 2026 08:02', who: 'System', role: '—', action: 'Invoice batch generated — 842 Term 3 invoices', mod: 'Finance' },
]

// ---------- lecturer layer (Tobias Shikongo teaches VTW101) ----------
export const COURSE_RESULTS = {
  VTW101: [
    { learner: 'Gabriel !Naruseb', ca: 68, exam: 61 },
    { learner: 'Gerhard Swartbooi', ca: 55, exam: 49 },
    { learner: 'Ruusa Nghidinwa', ca: 74, exam: 70 },
    { learner: 'Tomas Nakathingo', ca: 61, exam: 58 },
    { learner: 'Ndahafa Iipinge', ca: 82, exam: 77 },
    { learner: 'Jason !Gaseb', ca: 47, exam: 42 },
  ],
}

// ---------- HR: contracts, compliance, recruitment, workload ----------
export const CONTRACTS = [
  { staff: 'Loide Nangolo', type: 'Fixed-term', start: 'Jun 2025', end: '31 Aug 2026', daysLeft: 58 },
  { staff: 'Ester Nghifikwa', type: 'Casual', start: 'Feb 2024', end: '31 Dec 2026', daysLeft: 180 },
  { staff: 'Tobias Shikongo', type: 'Permanent', start: 'Jan 2019', end: '—', daysLeft: null },
  { staff: 'Selma Iyambo', type: 'Permanent', start: 'Jan 2020', end: '—', daysLeft: null },
  { staff: 'Johannes Haufiku', type: 'Permanent', start: 'Jan 2016', end: '—', daysLeft: null },
]

export const QUALIFICATIONS = [
  { staff: 'Tobias Shikongo', qual: 'B.Ed (Sciences) · UNAM', body: 'NQA verified', expires: '—', status: 'Valid' },
  { staff: 'Selma Iyambo', qual: 'B.Sc Mathematics · NUST', body: 'NQA verified', expires: '—', status: 'Valid' },
  { staff: 'Loide Nangolo', qual: 'PGDE (Languages) · IUM', body: 'NQA verification pending', expires: '—', status: 'Pending' },
  { staff: 'Tobias Shikongo', qual: 'Trade Instructor Licence', body: 'NTA', expires: '30 Sep 2026', status: 'Expiring' },
  { staff: 'Frans Kandjii', qual: 'Dip. Library Science · UNAM', body: 'NQA verified', expires: '—', status: 'Valid' },
]

export const RECRUIT_STAGES = ['Applied', 'Interview', 'Offer', 'Onboarding']
export const RECRUITS = [
  { id: 'REC-101', name: 'Anna Nghilokwa', post: 'Lecturer — Accounting', stage: 'Applied', applied: '30 Jun 2026', score: null },
  { id: 'REC-102', name: 'Petrus Ankama', post: 'Lecturer — Accounting', stage: 'Applied', applied: '01 Jul 2026', score: null },
  { id: 'REC-103', name: 'Helvi Mwandingi', post: 'Lecturer — Languages', stage: 'Interview', applied: '22 Jun 2026', score: '4.2 / 5' },
  { id: 'REC-104', name: 'Sacky Amutenya', post: 'IT Technician', stage: 'Interview', applied: '24 Jun 2026', score: '3.8 / 5' },
  { id: 'REC-105', name: 'Fenni Shaanika', post: 'Lecturer — Accounting', stage: 'Offer', applied: '12 Jun 2026', score: '4.6 / 5' },
  { id: 'REC-106', name: 'Marta Kavezeri', post: 'Admissions Officer', stage: 'Onboarding', applied: '02 Jun 2026', score: '4.4 / 5' },
]

export const WORKLOAD = [
  { staff: 'Tobias Shikongo', classes: 3, courses: 1, credits: 14, hours: 22, cap: 26 },
  { staff: 'Selma Iyambo', classes: 3, courses: 2, credits: 22, hours: 25, cap: 26 },
  { staff: 'Johannes Haufiku', classes: 2, courses: 1, credits: 12, hours: 18, cap: 24 },
  { staff: 'Loide Nangolo', classes: 2, courses: 1, credits: 8, hours: 27, cap: 26 },
  { staff: 'Petrus Shilongo', classes: 0, courses: 2, credits: 32, hours: 12, cap: 16 },
]

// ---------- finance: budget vs actual ----------
export const BUDGET = [
  { cat: 'Salaries', budget: 590000, actual: 571880 },
  { cat: 'Materials', budget: 95000, actual: 108460 },
  { cat: 'Canteen supplies', budget: 100000, actual: 98600 },
  { cat: 'Utilities', budget: 82000, actual: 78880 },
  { cat: 'Transport', budget: 60000, actual: 69020 },
  { cat: 'Maintenance', budget: 70000, actual: 59160 },
]

// ---------- library reservations ----------
export const RESERVATIONS = [
  { id: 1, title: 'Accounting Grade 12', requester: 'Ndeyapo Iithete', grade: '12A', placed: '28 Jun 2026', pos: 1 },
  { id: 2, title: 'Accounting Grade 12', requester: 'Anna Shiweda', grade: '12A', placed: '30 Jun 2026', pos: 2 },
  { id: 3, title: 'Sam Nujoma: A Biography', requester: 'Johannes Haufiku (staff)', grade: '—', placed: '01 Jul 2026', pos: 1 },
]

// ============================================================
// NamRA compliance layer — mirrors the two workbooks in
// public/assets/: Genesis_HR_v4_Hybrid_Payroll.xlsx (payroll)
// and Namibia_Financial_Model_v8.xlsx (double-entry bookkeeping).
// Adapted to a private university/college.
// ============================================================

// PAYE — Income Tax Act brackets, 2024/25 tables (threshold raised
// to N$100,000 on 1 Mar 2024; the workbook still had the old N$50,000)
export const PAYE_BRACKETS = [
  { from: 0, to: 100000, rate: 0, fixed: 0 },
  { from: 100001, to: 150000, rate: 0.18, fixed: 0 },
  { from: 150001, to: 350000, rate: 0.25, fixed: 9000 },
  { from: 350001, to: 550000, rate: 0.28, fixed: 59000 },
  { from: 550001, to: 850000, rate: 0.30, fixed: 115000 },
  { from: 850001, to: 1550000, rate: 0.32, fixed: 205000 },
  { from: 1550001, to: Infinity, rate: 0.37, fixed: 429000 },
]

export const payeMonthly = (gross) => {
  const annual = gross * 12
  const b = PAYE_BRACKETS.find((b) => annual >= b.from && annual <= b.to)
  return Math.round((b.fixed + b.rate * Math.max(0, annual - (b.from - 1))) / 12)
}

// SSC — 0.9% employee + 0.9% employer of basic, ceiling N$81/month each
export const sscMonthly = (gross) => Math.min(Math.round(gross * 0.009), 81)
// VET levy — employer, 1% of payroll where annual payroll > N$1,000,000
export const VET_LEVY_RATE = 0.01

export const TAX_CONST = {
  corporateRate: 0.30, // NamRA non-mining rate (private college; public/charitable education is s16 exempt)
  vatRate: 0.15, // tuition is VAT-EXEMPT (VAT Act 10 of 2000); canteen/hostel sales are taxable
}

// chart of accounts (college edition of the workbook's CoA)
export const COA = {
  'Cash & Cash Equivalents': ['Asset', 'D'],
  'Student Debtors (AR)': ['Asset', 'D'],
  'Property, Plant & Equipment': ['Asset', 'D'],
  'Accumulated Depreciation': ['Asset', 'C'],
  'VAT Payable': ['Liability', 'C'],
  'Income Tax Payable': ['Liability', 'C'],
  'Share Capital': ['Equity', 'C'],
  'Tuition Revenue (VAT-exempt)': ['Revenue', 'C'],
  'Canteen Sales (VAT 15%)': ['Revenue', 'C'],
  'Canteen Cost of Sales': ['Expense', 'D'],
  'Salaries & Wages': ['Expense', 'D'],
  'Rent Expense': ['Expense', 'D'],
  'Utilities Expense': ['Expense', 'D'],
  'Marketing & Advertising': ['Expense', 'D'],
  'Depreciation Expense': ['Expense', 'D'],
  'Fines & Penalties (non-deductible)': ['Expense', 'D'],
  'Entertainment (50% non-deductible)': ['Expense', 'D'],
}

// general journal — Semester 1 2026, every entry balances (Dr = Cr)
export const JOURNAL = [
  { date: '15 Jan', desc: 'Term 1 tuition invoiced (VAT-exempt supply)', acc: 'Student Debtors (AR)', dr: 1540000, cr: 0, vat: 'Exempt' },
  { date: '15 Jan', desc: 'Term 1 tuition invoiced (VAT-exempt supply)', acc: 'Tuition Revenue (VAT-exempt)', dr: 0, cr: 1540000, vat: 'Exempt' },
  { date: '10 Feb', desc: 'NSFAF sponsorship receipts', acc: 'Cash & Cash Equivalents', dr: 236500, cr: 0, vat: '—' },
  { date: '10 Feb', desc: 'NSFAF sponsorship receipts', acc: 'Student Debtors (AR)', dr: 0, cr: 236500, vat: '—' },
  { date: '28 Feb', desc: 'Tuition receipts — guardians & debit orders', acc: 'Cash & Cash Equivalents', dr: 1286000, cr: 0, vat: '—' },
  { date: '28 Feb', desc: 'Tuition receipts — guardians & debit orders', acc: 'Student Debtors (AR)', dr: 0, cr: 1286000, vat: '—' },
  { date: '20 Jan', desc: 'Computer lab — 24 PCs + server (FA-001)', acc: 'Property, Plant & Equipment', dr: 145000, cr: 0, vat: '—' },
  { date: '20 Jan', desc: 'Computer lab — 24 PCs + server (FA-001)', acc: 'Cash & Cash Equivalents', dr: 0, cr: 145000, vat: '—' },
  { date: '01 Mar', desc: 'Student minibus 22-seater (FA-002)', acc: 'Property, Plant & Equipment', dr: 380000, cr: 0, vat: '—' },
  { date: '01 Mar', desc: 'Student minibus 22-seater (FA-002)', acc: 'Cash & Cash Equivalents', dr: 0, cr: 380000, vat: '—' },
  { date: '05 Feb', desc: 'Workshop machinery — trades (FA-003)', acc: 'Property, Plant & Equipment', dr: 96000, cr: 0, vat: '—' },
  { date: '05 Feb', desc: 'Workshop machinery — trades (FA-003)', acc: 'Cash & Cash Equivalents', dr: 0, cr: 96000, vat: '—' },
  { date: '31 Mar', desc: 'Salaries Q1 (see Genesis payroll)', acc: 'Salaries & Wages', dr: 486000, cr: 0, vat: '—' },
  { date: '31 Mar', desc: 'Salaries Q1 (see Genesis payroll)', acc: 'Cash & Cash Equivalents', dr: 0, cr: 486000, vat: '—' },
  { date: '30 Jun', desc: 'Salaries Q2', acc: 'Salaries & Wages', dr: 486000, cr: 0, vat: '—' },
  { date: '30 Jun', desc: 'Salaries Q2', acc: 'Cash & Cash Equivalents', dr: 0, cr: 486000, vat: '—' },
  { date: '30 Apr', desc: 'Canteen sales S1 — taxable supply', acc: 'Cash & Cash Equivalents', dr: 118450, cr: 0, vat: 'Y' },
  { date: '30 Apr', desc: 'Canteen sales S1 — output VAT 15%', acc: 'Canteen Sales (VAT 15%)', dr: 0, cr: 103000, vat: 'Y' },
  { date: '30 Apr', desc: 'Canteen sales S1 — output VAT 15%', acc: 'VAT Payable', dr: 0, cr: 15450, vat: 'Y' },
  { date: '15 Apr', desc: 'Canteen supplies — input VAT claimable', acc: 'Canteen Cost of Sales', dr: 48000, cr: 0, vat: 'Y' },
  { date: '15 Apr', desc: 'Canteen supplies — input VAT claimable', acc: 'VAT Payable', dr: 7200, cr: 0, vat: 'Y' },
  { date: '15 Apr', desc: 'Canteen supplies — input VAT claimable', acc: 'Cash & Cash Equivalents', dr: 0, cr: 55200, vat: 'Y' },
  { date: '28 Feb', desc: 'Campus rent Jan–Jun', acc: 'Rent Expense', dr: 72000, cr: 0, vat: '—' },
  { date: '28 Feb', desc: 'Campus rent Jan–Jun', acc: 'Cash & Cash Equivalents', dr: 0, cr: 72000, vat: '—' },
  { date: '20 Jun', desc: 'Utilities S1 — electricity, water, internet', acc: 'Utilities Expense', dr: 39500, cr: 0, vat: '—' },
  { date: '20 Jun', desc: 'Utilities S1 — electricity, water, internet', acc: 'Cash & Cash Equivalents', dr: 0, cr: 39500, vat: '—' },
  { date: '12 May', desc: 'Open day & recruitment marketing', acc: 'Marketing & Advertising', dr: 22400, cr: 0, vat: '—' },
  { date: '12 May', desc: 'Open day & recruitment marketing', acc: 'Cash & Cash Equivalents', dr: 0, cr: 22400, vat: '—' },
  { date: '30 Jun', desc: 'Depreciation S1 (half-year)', acc: 'Depreciation Expense', dr: 66964, cr: 0, vat: '—' },
  { date: '30 Jun', desc: 'Depreciation S1 (half-year)', acc: 'Accumulated Depreciation', dr: 0, cr: 66964, vat: '—' },
  { date: '03 Apr', desc: 'Traffic fine — minibus (non-deductible)', acc: 'Fines & Penalties (non-deductible)', dr: 2400, cr: 0, vat: '—' },
  { date: '03 Apr', desc: 'Traffic fine — minibus (non-deductible)', acc: 'Cash & Cash Equivalents', dr: 0, cr: 2400, vat: '—' },
  { date: '22 May', desc: 'Staff year-function catering', acc: 'Entertainment (50% non-deductible)', dr: 9600, cr: 0, vat: '—' },
  { date: '22 May', desc: 'Staff year-function catering', acc: 'Cash & Cash Equivalents', dr: 0, cr: 9600, vat: '—' },
  { date: '02 Jan', desc: 'Opening — founders share capital', acc: 'Cash & Cash Equivalents', dr: 400000, cr: 0, vat: '—' },
  { date: '02 Jan', desc: 'Opening — founders share capital', acc: 'Share Capital', dr: 0, cr: 400000, vat: '—' },
]

// fixed asset register — NamRA wear & tear (s17B ITA): computers 33.33%,
// vehicles 20%, plant & machinery 10%, industrial buildings 4%
export const ASSET_REGISTER = [
  { id: 'FA-001', desc: 'Computer lab — 24 PCs + server', cat: 'Computers & Equipment', acquired: '20 Jan 2026', cost: 145000, rate: 0.3333 },
  { id: 'FA-002', desc: 'Student minibus 22-seater (NAM 4521 W)', cat: 'Motor Vehicles', acquired: '01 Mar 2026', cost: 380000, rate: 0.20 },
  { id: 'FA-003', desc: 'Workshop machinery — trades', cat: 'Plant & Machinery', acquired: '05 Feb 2026', cost: 96000, rate: 0.10 },
]

// NamRA filing calendar for a private college (employer + VAT vendor)
export const TAX_CALENDAR = [
  { obligation: 'PAYE return (EMP)', freq: 'Monthly', due: '20th of following month', next: '20 Jul 2026', status: 'Up to date' },
  { obligation: 'Social Security (SSC)', freq: 'Monthly', due: '30 days after month-end', next: '30 Jul 2026', status: 'Up to date' },
  { obligation: 'VAT return (canteen — taxable supplies)', freq: 'Bi-monthly', due: '25th after period end', next: '25 Jul 2026', status: 'Due soon' },
  { obligation: 'VET levy (payroll > N$1m)', freq: 'Monthly', due: '20th of following month', next: '20 Jul 2026', status: 'Up to date' },
  { obligation: 'Provisional tax P1 (≥40% estimate)', freq: 'Annual', due: 'Within 6 months of year start', next: '31 Aug 2026', status: 'Upcoming' },
  { obligation: 'Provisional tax P2 (balance)', freq: 'Annual', due: 'On/before year end', next: '28 Feb 2027', status: 'Upcoming' },
  { obligation: 'Annual income tax return', freq: 'Annual', due: 'Within 7 months of year end', next: '31 Jul 2027', status: 'Upcoming' },
]

// ---------- SIS layer (Workday-style): holds, degree audit, BP engine ----------
// holds gate registration/transcripts until resolved (auto-released on payment)
export const HOLDS = [
  { student: 'Tuhafeni Gaoseb', type: 'Financial', reason: 'Overdue balance N$ 6,550 (INV-2215)', impact: ['Blocks registration', 'Blocks transcript'], since: '20 Jun 2026' },
  { student: 'Ndinelago Hamutenya', type: 'Financial', reason: 'Overdue balance N$ 11,200 (INV-2216)', impact: ['Blocks registration'], since: '30 Jun 2026' },
  { student: 'Rauna Nakale', type: 'Advising', reason: 'Compulsory academic advising before S2 registration', impact: ['Blocks registration'], since: '01 Jul 2026' },
]

// degree audit — requirements evaluated against the student's catalog year
export const DEGREE_AUDIT = {
  'Ruusa Nghidinwa': {
    prog: 'CIT-5', catalog: '2026', gpa: 3.1, reqs: [
      { req: 'Core courses (ITC105 + ITC152)', need: 22, done: 10, inprog: 12, status: 'In progress' },
      { req: 'Digital literacy elective', need: 10, done: 10, inprog: 0, status: 'Satisfied' },
      { req: 'Work-integrated learning', need: 8, done: 0, inprog: 0, status: 'Not satisfied' },
      { req: 'Total credits — NQF Level 5', need: 40, done: 20, inprog: 12, status: 'In progress' },
    ],
  },
  'Gabriel !Naruseb': {
    prog: 'CVT-4', catalog: '2025', gpa: 2.4, reqs: [
      { req: 'Workshop practice (VTW101)', need: 14, done: 14, inprog: 0, status: 'Satisfied' },
      { req: 'Trade theory modules', need: 24, done: 12, inprog: 6, status: 'In progress' },
      { req: 'Industry attachment', need: 12, done: 0, inprog: 0, status: 'Not satisfied' },
      { req: 'Total credits — NQF Level 4', need: 50, done: 26, inprog: 6, status: 'In progress' },
    ],
  },
}

// configurable business processes (workflow engine) — steps, approvals, notifications
export const BP_DEFS = [
  { bp: 'Student course registration', trigger: 'Self-service portal', steps: 'Eligibility → holds → prereqs → capacity → charge assessment → enrol', approvals: 'Auto (rules engine)', notify: 'Student + lecturer' },
  { bp: 'Financial hold — apply / release', trigger: 'Overdue balance > N$ 500', steps: 'Detect → create hold → notify → auto-release on payment', approvals: 'Auto', notify: 'Student + bursar' },
  { bp: 'Exam board publication', trigger: 'Lecturer submits marks', steps: 'Moderate → board approval → publish to transcript', approvals: 'Registrar', notify: 'Students' },
  { bp: 'Staff leave request', trigger: 'Employee portal', steps: 'Request → balance check → approve → payroll sync', approvals: 'HR Officer', notify: 'Employee' },
  { bp: 'Sponsorship claim', trigger: 'Invoice issued to sponsor', steps: 'Claim pack → submit to funder → track payout', approvals: 'Bursar', notify: 'Finance' },
]

// worktags — multidimensional metadata on every posting (cost centre / fund / project)
export const WORKTAG_OF = {
  'Tuition Revenue (VAT-exempt)': 'Fund: Tuition',
  'Student Debtors (AR)': 'Fund: Tuition',
  'Canteen Sales (VAT 15%)': 'CC: Canteen',
  'Canteen Cost of Sales': 'CC: Canteen',
  'Salaries & Wages': 'CC: Academic staff',
  'Property, Plant & Equipment': 'Project: Campus 2026',
  'Depreciation Expense': 'Project: Campus 2026',
  'Rent Expense': 'CC: Facilities',
  'Utilities Expense': 'CC: Facilities',
  'Marketing & Advertising': 'CC: Admissions',
}

// ---------- POS prepaid student accounts ----------
export const STUDENT_ACCOUNTS = [
  { name: 'Ndinelago Hamutenya', id: 'STU-1041', balance: 86 },
  { name: 'Petrina Shaanika', id: 'STU-1055', balance: 152 },
  { name: 'Maria Nekundi', id: 'STU-0844', balance: 240 },
  { name: 'Helena Shivute', id: 'STU-1298', balance: 12 },
  { name: 'Immanuel Tjiho', id: 'STU-1204', balance: 64 },
]

// ---------- LMS / courseware (shared by lecturer + student) ----------
export const COURSEWARE = {
  VTW101: {
    materials: [
      { week: 'Week 1', title: 'Workshop Safety Handbook', type: 'PDF' },
      { week: 'Week 2', title: 'Hand & Power Tools — Slides', type: 'Slides' },
      { week: 'Week 3', title: 'Welding Demonstration', type: 'Video' },
      { week: 'Week 4', title: 'Measurement & Marking Out', type: 'PDF' },
    ],
    assignments: [
      { id: 'VTW101-A1', title: 'Safety Procedures Quiz', due: '18 Jul 2026', points: 20, submitted: 42, total: 50 },
      { id: 'VTW101-A2', title: 'Tool Identification Report', due: '25 Jul 2026', points: 30, submitted: 18, total: 50 },
    ],
  },
}

// ---------- examinations (logistics) ----------
export const EXAM_SCHEDULE = [
  { code: 'BBA111', title: 'Principles of Management', date: '24 Nov 2026', time: '09:00', venue: 'Hall A', seats: 60, sat: 42, invigilator: 'Johannes Haufiku' },
  { code: 'ACC110', title: 'Financial Accounting I', date: '25 Nov 2026', time: '09:00', venue: 'Hall A', seats: 60, sat: 44, invigilator: 'Petrus Shilongo' },
  { code: 'ITC105', title: 'Computer Literacy & Office Tools', date: '26 Nov 2026', time: '13:00', venue: 'Lab 1+2', seats: 48, sat: 46, invigilator: 'Selma Iyambo' },
  { code: 'VTW101', title: 'Workshop Practice & Safety', date: '27 Nov 2026', time: '09:00', venue: 'Workshop A', seats: 50, sat: 50, invigilator: 'Tobias Shikongo' },
  { code: 'EDU130', title: 'Child Development & Learning', date: '27 Nov 2026', time: '13:00', venue: 'Hall B', seats: 40, sat: 30, invigilator: 'Loide Nangolo' },
]

// ---------- graduation & clearance ----------
export const GRADUANDS = [
  { student: 'Ruusa Nghidinwa', prog: 'CIT-5', gpa: 3.1, finance: true, library: true, academic: true },
  { student: 'Gabriel !Naruseb', prog: 'CVT-4', gpa: 2.4, finance: false, library: true, academic: true },
  { student: 'Gerhard Swartbooi', prog: 'CVT-4', gpa: 2.0, finance: true, library: false, academic: true },
  { student: 'Ndahafa Iipinge', prog: 'CVT-4', gpa: 3.4, finance: true, library: true, academic: true },
  { student: 'Victoria Muharukua', prog: 'BED-7', gpa: 2.8, finance: true, library: true, academic: false },
]

// ---------- accommodation / residences ----------
export const RESIDENCES = [
  { block: 'Etosha House', rooms: 60, occupied: 54, fee: 6800 },
  { block: 'Namib Hall', rooms: 48, occupied: 48, fee: 6200 },
  { block: 'Kavango Court', rooms: 36, occupied: 22, fee: 5600 },
]
export const ALLOCATIONS = [
  { student: 'Gabriel !Naruseb', block: 'Etosha House', room: 'E-214', status: 'Allocated', fee: 6800 },
  { student: 'Ruusa Nghidinwa', block: 'Namib Hall', room: 'N-108', status: 'Allocated', fee: 6200 },
  { student: 'Immanuel Tjiho', block: 'Kavango Court', room: 'K-031', status: 'Allocated', fee: 5600 },
]
export const RES_WAITLIST = [
  { student: 'Rauna Nakale', pref: 'Namib Hall', since: '02 Jul 2026' },
  { student: 'Helena Shivute', pref: 'Etosha House', since: '04 Jul 2026' },
]

// ---------- NCHE / regulatory returns ----------
export const NCHE_RETURNS = [
  { ret: 'HEMIS enrolment return', period: '2026 annual', due: '31 Mar 2027', status: 'Not started' },
  { ret: 'Graduate output return', period: '2026 annual', due: '30 Apr 2027', status: 'Not started' },
  { ret: 'Programme accreditation renewal — BED-7', period: '—', due: '30 Sep 2026', status: 'In progress' },
  { ret: 'Staff qualifications audit (NQA)', period: '2026', due: '30 Nov 2026', status: 'In progress' },
]
export const INSTITUTION_TYPES = ['Vocational college', 'Full university', 'Distance / open learning']

// ---------- multi-tenant: which modules an institution type hides ----------
export const INSTITUTION_HIDE = {
  'Vocational college': [],
  'Full university': [],
  'Distance / open learning': ['accommodation', 'canteen'],
}
export const getInstType = () =>
  (typeof localStorage !== 'undefined' && localStorage.getItem('sym.insttype')) || 'Vocational college'
