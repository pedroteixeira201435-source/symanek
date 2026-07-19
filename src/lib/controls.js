// Symanek Suite — institutional control configuration.
//
// The "open/close certain functions" the client asked for: marks insertion,
// marks release, application periods, registration periods, etc. These defaults
// seed the admin Settings panel; other modules import them to show whether a
// window is currently open. In Phase 2 this table lives in the database and the
// admin toggles persist per intake.

import { INTAKES } from './academics.js'

export { INTAKES }

// Minimum class-attendance % a student must reach to be admitted to the final
// examination (client rule).
export const ATTENDANCE_MIN = 80;

// Control windows — each function can be opened or closed by the admin, with an
// optional date range shown to users.
export const CONTROL_WINDOWS = [
  { key: 'applications', label: 'Application period', open: true, from: '2026-06-01', to: '2026-09-30', intake: 'july' },
  { key: 'registration', label: 'Registration period', open: true, from: '2026-07-01', to: '2026-07-31', intake: 'july' },
  { key: 'marks_insertion', label: 'Marks insertion (lecturers)', open: true, from: '2026-11-01', to: '2026-11-20', intake: 'july' },
  { key: 'marks_release', label: 'Marks release (to students)', open: false, from: '2026-12-05', to: '2026-12-31', intake: 'july' },
  { key: 'second_opportunity', label: 'Second-opportunity examination', open: false, from: '2027-01-12', to: '2027-01-23', intake: 'july' },
  { key: 'graduation_clearance', label: 'Graduation clearance', open: false, from: '2027-02-01', to: '2027-02-28', intake: 'july' },
];

export function windowByKey(key) {
  return CONTROL_WINDOWS.find((w) => w.key === key);
}

export function isWindowOpen(key) {
  return !!windowByKey(key)?.open;
}

// Documents a student record can produce. `needsClearance` gates on holds;
// `needsAttendance` gates the exam permit on the 80% rule.
export const STUDENT_DOCUMENTS = [
  { key: 'proof_of_registration', label: 'Proof of registration', needsClearance: true },
  { key: 'exam_permit', label: 'Examination permit', needsClearance: true, needsAttendance: true },
  { key: 'academic_record', label: 'Academic record', needsClearance: true },
  { key: 'statement_of_results', label: 'Statement of results', needsClearance: true },
  { key: 'admission_letter', label: 'Admission letter', needsClearance: false },
  { key: 'rejection_letter', label: 'Rejection letter', needsClearance: false, staffOnly: true },
];

// Announcements pushed to the student portal.
export const ANNOUNCEMENTS = [
  { id: 'AN-04', date: '2026-11-01', title: 'November examinations timetable published', body: 'The final examination timetable for the July intake is now available under My Timetable. Exams run 09–20 Nov 2026.', tone: 'blue' },
  { id: 'AN-03', date: '2026-10-20', title: 'Examination permits require 80% attendance', body: 'Only students with at least 80% class attendance will be issued an examination permit. Check your attendance under My Studies.', tone: 'amber' },
  { id: 'AN-02', date: '2026-10-05', title: 'Second-opportunity examinations', body: 'Students with a final mark of 45–49% qualify for a second-opportunity examination in January 2027.', tone: 'blue' },
  { id: 'AN-01', date: '2026-09-15', title: 'January 2027 intake now open', body: 'Applications for the January 2027 intake are open. Application fee N$200; registration fee N$500.', tone: 'green' },
];
