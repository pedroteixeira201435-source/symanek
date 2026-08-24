# Symanek — Production UAT and release gate

**Approver:** Pedro Teixeira (`pedroteixeira201435@gmail.com`). No production
release is approved until Pedro records an outcome for every applicable check.

## Release 1 — public site

Run against the production Vercel URL with a real staff account and dedicated
test applicant. Record the reference, timestamp and result for each step.

| Scenario | Expected result | Pass |
|---|---|---|
| Application | `/apply` completes Turnstile; a new application persists in Supabase. | [ ] |
| Admissions review | Real staff account can view and approve the application. | [ ] |
| Portal status | Reference lookup shows only permitted status; email lookup enables the letter. | [ ] |
| Approval letter | Signed PDF URL opens the correct letter and expires after its configured period. | [ ] |
| EFT proof | Valid image/PDF under 10 MB uploads; invalid type/oversize is rejected. | [ ] |
| Payment confirmation | Staff reviews the proof and records EFT; enrolment/status updates once. | [ ] |
| Abuse controls | Missing/invalid Turnstile and repeated requests are rejected with a clear message. | [ ] |
| Recovery | A failed request does not create duplicate applications or payments. | [ ] |

**Release 1 decision:** [ ] approved  [ ] rejected
**Pedro signature/date:** ______________________________

## Release 2 — Suite core academic scope

Release only the modules: Dashboard, Students, Admissions, Programmes,
Academics, Examinations, Graduation, Finance, Lecturer Portal and Student
Portal. POS, canteen, library, HR, accounting, accommodation, compliance,
courseware, Apply Online and settings remain out of production scope.

| Scenario | Expected result | Pass |
|---|---|---|
| Authentication | Real role account signs in; demo accounts cannot sign in. | [ ] |
| Access control | Each role can see only the released modules and authorized records. | [ ] |
| Admissions to enrolment | Approved and paid applicant becomes the correct student record. | [ ] |
| Academic record | Registrar can enter/publish results; student sees only their own record. | [ ] |
| Official results | Grade bands have written college approval before any Statement of Result is issued. | [ ] |
| Finance | Bursar records a manual EFT once and audit trail is present. | [ ] |
| Documents | Official document uses confirmed data, bank details and stamp. | [ ] |

**Release 2 decision:** [ ] approved  [ ] rejected
**Pedro signature/date:** ______________________________

## Preconditions and evidence

- Attach successful CI run, both production build logs, backup/PITR evidence and
  a restore-test record.
- Attach proof that demo accounts were retired, secrets rotated and production
  data contains only approved roster records.
- Any failed critical scenario blocks release until it is fixed and retested.
