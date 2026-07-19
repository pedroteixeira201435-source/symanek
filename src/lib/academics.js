// Symanek Specialized College — academic assessment engine.
//
// Single source of truth for the institution's marking rules, as specified by
// the client (2026 review feedback). Keep the numbers here — the UI reads them
// so a policy change never means hunting through components.
//
//  • Final mark  = 60% continuous assessment (CA) + 40% examination
//  • Semester subjects: 3 formative assessments (2 tests + 1 assignment)
//  • Year subjects:     5 formative assessments (3 tests + 2 assignments)
//  • Every examination is out of 100 marks, written over 3 hours
//  • Pass rules:
//      – minimum 50% in each formative assessment
//      – minimum 50% final mark to pass the module
//      – minimum 40% in the examination paper to pass the paper
//      – final mark of 45–49% qualifies for a second-opportunity examination
//  • Two intakes per year: January and July

export const WEIGHTS = Object.freeze({ ca: 0.6, exam: 0.4 });

export const EXAM_CONFIG = Object.freeze({ outOf: 100, durationHours: 3 });

export const PASS = Object.freeze({
  formativeMin: 50, // minimum % in each formative (CA) assessment
  moduleFinalMin: 50, // minimum final % to pass the module
  examPaperMin: 40, // minimum % in the exam paper to pass the paper
  secondOppLow: 45, // final mark band (inclusive) that earns a
  secondOppHigh: 49, // second-opportunity examination
});

// Subject types and their formative assessment structure.
export const SUBJECT_TYPES = Object.freeze({
  semester: {
    key: 'semester',
    label: 'Semester subject',
    tests: 2,
    assignments: 1,
    get formativeCount() {
      return this.tests + this.assignments;
    },
  },
  year: {
    key: 'year',
    label: 'Year subject/module',
    tests: 3,
    assignments: 2,
    get formativeCount() {
      return this.tests + this.assignments;
    },
  },
});

export const INTAKES = Object.freeze([
  { key: 'january', label: 'January intake' },
  { key: 'july', label: 'July intake' },
]);

// Letter grade + GPA points from a % mark (institutional scale).
export function gradeOf(mark) {
  if (mark >= 80) return { letter: 'A', gpa: 4.0 };
  if (mark >= 70) return { letter: 'B', gpa: 3.0 };
  if (mark >= 60) return { letter: 'C', gpa: 2.0 };
  if (mark >= 50) return { letter: 'D', gpa: 1.0 };
  return { letter: 'F', gpa: 0 };
}

// Continuous assessment mark: simple average of the formative marks, which is
// then weighted at 60%. `marks` is an array of percentages (0–100).
export function caFromComponents(marks) {
  if (!Array.isArray(marks) || marks.length === 0) return 0;
  const sum = marks.reduce((s, m) => s + Number(m || 0), 0);
  return sum / marks.length;
}

// Final module mark = 60% CA + 40% exam, rounded to a whole percentage.
export function finalMark(ca, exam) {
  return Math.round(Number(ca) * WEIGHTS.ca + Number(exam) * WEIGHTS.exam);
}

// Evaluate a module result against the institutional rules.
// Returns { final, outcome, label, tone, reasons[] }.
//   outcome ∈ 'pass' | 'second_opportunity' | 'fail'
export function evaluateResult({ ca, exam }) {
  const final = finalMark(ca, exam);
  const examOk = Number(exam) >= PASS.examPaperMin;
  const finalOk = final >= PASS.moduleFinalMin;
  const inSecondOppBand = final >= PASS.secondOppLow && final <= PASS.secondOppHigh;
  const reasons = [];

  let outcome;
  if (finalOk && examOk) {
    outcome = 'pass';
  } else if (inSecondOppBand || (finalOk && !examOk)) {
    outcome = 'second_opportunity';
    if (!examOk) reasons.push(`Exam paper below ${PASS.examPaperMin}% — paper must be re-sat`);
    if (inSecondOppBand) reasons.push(`Final ${final}% is in the ${PASS.secondOppLow}–${PASS.secondOppHigh}% band`);
  } else {
    outcome = 'fail';
    if (!finalOk) reasons.push(`Final ${final}% below the ${PASS.moduleFinalMin}% module pass mark`);
    if (!examOk) reasons.push(`Exam paper below ${PASS.examPaperMin}%`);
  }

  const meta = {
    pass: { label: 'Pass', tone: 'green' },
    second_opportunity: { label: 'Second opportunity', tone: 'amber' },
    fail: { label: 'Fail', tone: 'red' },
  }[outcome];

  return { final, outcome, reasons, ...meta };
}

// Human-readable summary of the marking policy (for banners / help text).
export const POLICY_SUMMARY =
  `Final mark = ${Math.round(WEIGHTS.ca * 100)}% continuous assessment + ` +
  `${Math.round(WEIGHTS.exam * 100)}% examination. ` +
  `Pass the module with ${PASS.moduleFinalMin}%+ (exam paper ${PASS.examPaperMin}%+); ` +
  `${PASS.secondOppLow}–${PASS.secondOppHigh}% qualifies for a second opportunity. ` +
  `Exams are out of ${EXAM_CONFIG.outOf} marks over ${EXAM_CONFIG.durationHours} hours.`;
