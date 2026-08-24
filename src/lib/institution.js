export const SCHOOL = {
  name: 'Symanek Specialized College',
  term: 'Semester 2, 2026',
  learners: 0,
  staff: 0,
}

export const ROLES = [
  { id: 'admin', name: 'Administrator', user: 'Administrator', desc: 'Full Suite administration' },
  { id: 'bursar', name: 'Bursar / Finance', user: 'Bursar', desc: 'Fees, invoices and payments' },
  { id: 'hr', name: 'HR Officer', user: 'HR Officer', desc: 'Staff, leave and payroll' },
  { id: 'teacher', name: 'Lecturer', user: 'Lecturer', desc: 'Teaching, grades and courseware' },
  { id: 'seller', name: 'Canteen Seller', user: 'Canteen Seller', desc: 'Point of sale only' },
  { id: 'librarian', name: 'Librarian', user: 'Librarian', desc: 'Library catalogue and loans' },
  { id: 'student', name: 'Student', user: 'Student', desc: 'Student self-service portal' },
  { id: 'registrar', name: 'Registrar', user: 'Registrar', desc: 'Admissions, students and academic records' },
  { id: 'applicant', name: 'Applicant', user: 'Applicant', desc: 'Application self-service' },
]

export const INSTITUTION_HIDE = {
  college: [],
}

export const getInstType = () => 'college'

export const ACTIVITY_FEED = []
