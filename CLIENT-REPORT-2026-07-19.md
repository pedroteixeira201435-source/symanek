# Symanek Specialized College — Review Feedback Implementation Report

**Date:** 19 July 2026
**Prepared for:** Symanek Specialized College
**Scope:** Website (symanekacademy rebuild) and the Symanek Suite management system

---

## Summary

All the points raised in your review (both the *Website / Student Portal* notes and the
*System Audit — School Admin* notes) have been **implemented and deployed to production**.

**Live now:**
- **Public website:** https://symanek-site.vercel.app
- **Management system (Symanek Suite):** https://symanek-suite.vercel.app

Below, every item from your feedback is listed with its status. A short list of items that
require a value or content from your side (fees, entry requirements, etc.) is at the end —
these are now **editable directly from the system's admin area**, exactly as requested, so no
developer is needed to change them.

---

## PART 1 — WEBSITE

### Page 1 — Home
| # | Your request | Status |
|---|--------------|--------|
| 1 | Add "NQA accredited" and "HPCNA registered" | ✅ Done |
| 2 | Add study mode: part-time with online synchronisation | ✅ Done |
| 3 | Bachelor Honours is a 1-year programme, NQF Level 8 | ✅ Done |
| 4 | Indicate the duration for all qualifications | ✅ Done |
| 5 | Bachelor study modes: full-time face-to-face / distance / part-time online sync | ✅ Done |
| 6 | Application fee for all programmes = N$200 | ✅ Done |
| 7 | Registration fee = N$500 (all), except Caregiving N$1650 | ✅ Done |
| 8 | Address: ERF 2948, Extension 6, Okahandja, Namibia | ✅ Done |

### Page 2 — About Us
| # | Your request | Status |
|---|--------------|--------|
| 1 | Nursing **Board** of Namibia (not Council); Caregiving is not registrable | ✅ Done |
| 2 | Registered with NTA for OHS Level 4 **and 5**, and Office Administration Level 4 | ✅ Done |
| 3 | Registered with the HPCNA | ✅ Done |
| 4 | Accredited by the Namibia Qualifications Authority (NQA) | ✅ Done |
| 5 | State that we offer internship | ✅ Done |
| 6 | Add our values | ✅ Done (new "Our Values" section) |
| + | New "Our Team" section featuring the staff photo you provided | ✅ Done |

### Page 2 — Our Programmes
| # | Your request | Status |
|---|--------------|--------|
| 1 | Rename to "Nursing and Healthcare" (not "Nursing and Care") | ✅ Done |
| 2 | Indicate fees for all programmes | ✅ Done (fees shown per programme; bachelors pending your figures — see end) |
| 3 | NQF levels: Caregiving = Level 3, Auxiliary Nursing = Level 5 | ✅ Done |
| 4 | Indicate admission requirements for all programmes | ✅ Done (bachelors pending your text — see end) |
| + | Mental Health students photo added to the Mental Health programme pages | ✅ Done |

### Page 3 — Gallery
| # | Your request | Status |
|---|--------------|--------|
| 1 | Add more pictures / remove repeats | ✅ New photo added; ready to receive Jeremia's graduation photos to complete |

### Operating hours (footer)
- **07:30 – 17:00 (Monday to Thursday)** and **07:30 – 13:00 (Fridays)** — ✅ Done

---

## PART 2 — STUDENT PORTAL & SYSTEM RULES

| # | Your request | Status |
|---|--------------|--------|
| 1 | HR: staff download payslips online; apply for leave online; manager approves online | ✅ Done |
| 2 | Record class attendance hours | ✅ Done |
| 2 | Minimum **80% attendance** required for admission to the final examination | ✅ Done (enforced; no exam permit issued below 80%) |
| 2 | Add **examination permit**, **rejection letter** and **admission letter** as documents | ✅ Done |
| 2 | Add an **announcements** section for students | ✅ Done |
| 3 | First and second **opportunity examination marks** | ✅ Done |
| 3 | Download the **examination timetable** | ✅ Done |
| 4 | Accommodate **January and July intakes** | ✅ Done |
| 5 | Subject weighting formula: **60% CA + 40% examination** | ✅ Done (this was previously reversed — now corrected) |
| 5 | Minimum formative pass 50% | ✅ Done |
| 5 | Minimum 50% to pass the module at final examination | ✅ Done |
| 5 | Minimum 40% to pass the examination paper | ✅ Done |
| 5 | Average 45–49% qualifies for a **second-opportunity examination** | ✅ Done |
| 6 | Two subject types: **semester** (3 formatives: 2 tests + 1 assignment) and **year** (5 formatives: 3 tests + 2 assignments) | ✅ Done |
| 7 | All examinations out of **100 marks**, written over **3 hours** | ✅ Done |
| — | Ability to **open/close functions** (marks release, marks insertion, application periods, registration periods, etc.) | ✅ Done (Settings → Academic control windows) |

---

## PART 3 — SYSTEM AUDIT: THE SCHOOL ADMIN

You noted the School Admin should have full control of every module. Implemented as follows:

### 1. Application Component (student biographical information)
- Admin can **add new students** — ✅ Done
- Each student record has an **Action button** with:
  - Show profile ✅ · Update profile ✅ · Documents ✅ · Applications ✅ · Reset password ✅ · Log in as ✅

### 2. Admission
- **Manual Admission** — list of students with their application status, and an Action button to **process** applications (advance stage or reject) — ✅ Done

### 3. Registration
- Modules registration ✅ · Qualification management ✅ · Modules management ✅ · **Student Blocks** (place/release holds) ✅

### 4. Students' Marks
- My Modules (per lecturer) ✅
- **Marks Suppression** by academic year and intake, choosing which marks to suppress (**CA / Exam / Final**) ✅
- **Module Allocation** — allocating modules to teaching staff ✅
- **Control access, assign permissions and block staff access** (role permission matrix + activate/deactivate) ✅

### 5. Documents (previously missing)
- **Examination permit** ✅ · **Proof of registration** ✅ · **Academic records** ✅ · **Student letters** (admission / rejection) ✅ · **Statement of results** ✅
- All generate as official, printable documents on the college letterhead.

### 6. Settings
- Previously empty — now includes the **institution profile, academic calendar, module toggles, role permissions, user accounts, and the academic control windows** described above. ✅

---

## Items awaiting your input (now editable in the admin area)

These are fully wired into the site and system; they only need the correct **values/text** from
the college, which can be entered/edited from the admin area — no developer required:

1. **Bachelor of OHSE (Honours, L8 and L7)** — tuition fees and admission requirements.
2. **Certificate in Auxiliary Nursing Science** — tuition fee, exact duration and admission
   requirements. *(A 12-month duration is shown as a placeholder — please confirm.)*
3. **Our Values** — the wording currently on the site is a first draft based on your
   mission/vision; please confirm or replace with the official values.
4. **Gallery** — please send the additional graduation photos (from Jeremia) so we can remove any
   repeats and complete the gallery.

---

## Technical confirmation

- Both applications are **live in production** and verified working.
- The **database is in full conformity** — all schema migrations are applied on the live database
  with no discrepancies.
- All changes have been committed to the project's source repository.

*Prepared by the development team.*
