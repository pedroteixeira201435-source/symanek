-- ============================================================================
-- DEMO/STAGING SEED (idempotent). Bundled as a migration so it deploys to the
-- cloud via 'supabase db push' (which does not run seed files). Safe to remove
-- for a clean production. Auth users are created separately (seed_auth.sh).
-- ============================================================================

-- ---- site programmes (real catalogue) ----
-- AUTO-GENERATED from lib/content.ts — do not edit by hand. Run: npx tsx scripts/gen-seed.ts
insert into public.programmes
  (slug, name, category, level, duration, fee, modes, description, requirements, careers)
values
  ('certificate-auxiliary-nursing-science', 'Certificate in Auxiliary Nursing Science', 'nursing-care', NULL, 'Certificate', NULL, 'Full-Time, Distance Learning', 'Prepares students to provide basic nursing care and support services under the supervision of registered nurses. Registered with the Nursing Council of Namibia.', NULL, ARRAY['Auxiliary Nurse', 'Nursing Assistant', 'Care Support Worker', 'Clinic Support Staff']),
  ('certificate-caregiving', 'Certificate in Caregiving', 'nursing-care', NULL, '6 Months', 9370, 'Full-Time, Distance Learning', 'Equips learners with practical skills to provide quality care and support to elderly persons, persons with disabilities and chronically ill patients. Registered with the Nursing Council of Namibia for Care Giving.', 'Grade 9–12 with minimum 15 points; relevant caregiving experience may strengthen applications.', ARRAY['Caregiver', 'Home-Based Care Assistant', 'Elderly Care Assistant', 'Disability Support Worker', 'Community Health Assistant']),
  ('bachelor-ohse-honours-nqf8', 'Bachelor of Occupational Health, Safety and Environmental Management, Honours', 'academic', 'NQF Level 8', 'Degree', NULL, NULL, 'Provides advanced knowledge and professional competencies required for senior safety and environmental management roles.', NULL, ARRAY[]::text[]),
  ('bachelor-ohse-nqf7', 'Bachelor of Occupational Health, Safety and Environmental Management', 'academic', 'NQF Level 7', '3-year degree', NULL, NULL, 'A comprehensive three-year degree designed to prepare graduates to manage workplace safety and environmental concerns.', NULL, ARRAY[]::text[]),
  ('certificate-ohs-level-4', 'Certificate in Occupational Health and Safety', 'tvet', 'Level 4', '12 Months', 19670, 'Full-Time (Preferred), Distance Learning', 'Entry-level qualification covering hazard identification, risk assessment, incident investigation, safety legislation, emergency preparedness, workplace inspections and safety management systems.', 'Grade 11 or 12 with minimum 20 points. Grade 10 (old curriculum) with minimum 22 points. English with an E symbol or better.', ARRAY['Safety Officer', 'Safety Representative', 'HSE Assistant', 'Safety Coordinator', 'Compliance Assistant']),
  ('diploma-ohs-level-5', 'Diploma in Occupational Health and Safety', 'tvet', 'Level 5', '12 Months', 19670, 'Full-Time, Distance Learning', 'Advanced competencies in workplace safety management, compliance monitoring, occupational risk management and incident prevention. Progresses to the Bachelor in Occupational Health, Safety and Environmental Management Level 7.', 'Occupational Health and Safety Level 4 qualification.', ARRAY['OHS Officer', 'SHE Officer', 'Risk Management Officer', 'Compliance Officer', 'Safety Supervisor']),
  ('certificate-mental-health-level-4', 'Certificate in Mental Health Support and Psychosocial Counselling', 'tvet', 'Level 4', '12 Months', 14090, 'Full-Time, Distance Learning', 'Basic psychosocial support, mental health awareness, counselling assistance and community-based support services.', 'Grade 11 or 12 with minimum 20 points. Grade 10 with minimum 22 points. English with an E symbol or better. Certificate in Counselling Services Level 3.', ARRAY['Mental Health Support Worker', 'Community Support Worker', 'Counselling Assistant', 'Youth Development Officer', 'NGO Support Worker']),
  ('diploma-mental-health-level-5', 'Diploma in Mental Health Support and Psychosocial Counselling', 'tvet', 'Level 5', '12 Months', 14090, 'Full-Time, Distance Learning', 'Advanced psychosocial support, counselling and mental health intervention skills.', 'Mental Health Support Level 4 or Counselling Services Level 4.', ARRAY['Psychosocial Counsellor', 'Mental Health Practitioner Assistant', 'Community Development Practitioner', 'Employee Wellness Coordinator', 'Youth Counsellor']),
  ('certificate-medical-office-admin-level-4', 'Certificate in Medical Office Administration', 'tvet', 'Level 4', '12 Months', 14090, 'Full-Time, Distance Learning', 'Administrative and clerical roles in healthcare settings including hospitals, clinics, medical practices and pharmacies.', 'Grade 11 or 12 with minimum 20 points in six subjects; Grade 10 (old curriculum) with minimum 22 points; English with an E symbol or better; National Vocational Certificate in Office Administration Level 3; or mature-age entry with 3+ years relevant work experience.', ARRAY['Medical Office Administrator', 'Medical Receptionist', 'Patient Administration Clerk', 'Health Records Clerk', 'Hospital Front Desk Officer']),
  ('diploma-medical-office-admin-level-5', 'Diploma in Medical Office Administration', 'tvet', 'Level 5', '12 Months', 14090, 'Full-Time, Distance Learning', 'Supervisory and management roles in healthcare administration.', 'Medical Office Administration Level 4, Medical Secretary Level 4, Office Administration Level 4, or equivalent NQF Level 4.', ARRAY['Medical Office Manager', 'Hospital Administrator', 'Practice Administrator', 'Patient Services Manager', 'Health Records Supervisor']),
  ('certificate-nutrition-dietetics-level-4', 'Certificate in Nutrition and Dietetics', 'tvet', 'Level 4', '12 Months', 14090, 'Full-Time, Distance Learning', 'Practical knowledge in nutrition, healthy living, food science, community nutrition and health promotion.', 'Grade 11 or 12 with minimum 20 points. Grade 10 with minimum 22 points. English with an E symbol or better. Food and Nutrition Level 3 or Community Health Level 3.', ARRAY['Nutrition Assistant', 'Community Nutrition Worker', 'Health Promotion Assistant', 'School Nutrition Assistant', 'Wellness Programme Assistant']),
  ('diploma-nutrition-dietetics-level-5', 'Diploma in Nutrition and Dietetics', 'tvet', 'Level 5', '12 Months', 14090, 'Full-Time, Distance Learning', 'Advanced nutrition assessment, diet planning, health promotion, food safety, occupational nutrition and community programmes.', 'National Vocational Certificate in Nutrition and Dietetics Level 4 or Community Health Level 4.', ARRAY['Nutrition Technician', 'Community Nutrition Practitioner', 'Workplace Wellness Coordinator', 'Health Promotion Officer', 'Food Service Supervisor']),
  ('certificate-medical-secretary', 'Certificate in Medical Secretary', 'six-months', NULL, '6 Months', 11020, 'Full-Time, Distance Learning', 'Prepares students for administrative roles within healthcare facilities — medical terminology, office administration, patient communication and records management.', 'Grade 9–12 with minimum 15 points; one year work experience as a Medical Secretary or Receptionist considered.', ARRAY['Medical Secretary', 'Medical Receptionist', 'Clinic Administrator', 'Patient Records Clerk', 'Front Office Administrator']),
  ('ohs-representative', 'Occupational Health and Safety (OHS) Representative', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Prepares participants to effectively perform the duties of an OHS Representative within the workplace.', NULL, ARRAY[]::text[]),
  ('first-aid-level-1-2', 'First Aid Level 1 & 2', 'health-safety-emergency', NULL, '3 Days', 750, 'Face-to-Face / Online', 'Learn lifesaving skills to provide immediate assistance during medical emergencies before professional help arrives.', NULL, ARRAY[]::text[]),
  ('fire-fighting-fire-marshal', 'Fire Fighting and Fire Marshal Training', 'health-safety-emergency', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Gain the skills necessary to prevent fires, respond effectively to fire emergencies and safely evacuate occupants.', NULL, ARRAY[]::text[]),
  ('infection-prevention-control', 'Infection Prevention and Control', 'health-safety-emergency', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Focuses on preventing the spread of infections within healthcare facilities, food establishments and community settings.', NULL, ARRAY[]::text[]),
  ('elderly-care-geriatric-support', 'Elderly Care and Geriatric Support', 'health-safety-emergency', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Learn how to provide compassionate and professional care to elderly individuals in homes, healthcare facilities and communities.', NULL, ARRAY[]::text[]),
  ('home-based-palliative-care', 'Home-Based and Palliative Care', 'health-safety-emergency', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Develop practical skills to support patients with chronic illnesses and those requiring end-of-life care.', NULL, ARRAY[]::text[]),
  ('patient-administration-reception', 'Patient Administration and Reception', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Equips participants with essential healthcare reception and patient administration skills.', NULL, ARRAY[]::text[]),
  ('medical-coding', 'Medical Coding', 'health-safety-emergency', NULL, '4 Days', 1200, 'Face-to-Face / Online', 'Learn the fundamentals of medical coding used in healthcare billing, records management and insurance administration.', NULL, ARRAY[]::text[]),
  ('emergency-preparedness-evacuation', 'Emergency Preparedness and Evacuation', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Prepare employees and organizations to effectively respond during emergencies and disasters.', NULL, ARRAY[]::text[]),
  ('safety-auditing-inspection', 'Safety Auditing and Inspection', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Develop the skills necessary to conduct workplace safety inspections and audits.', NULL, ARRAY[]::text[]),
  ('incident-investigation-reporting', 'Incident Investigation and Reporting', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Learn how to investigate workplace incidents and identify root causes to prevent recurrence.', NULL, ARRAY[]::text[]),
  ('hira', 'Hazard Identification and Risk Assessment (HIRA)', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'One of the most important safety courses for identifying workplace hazards and reducing risks.', NULL, ARRAY[]::text[]),
  ('construction-safety', 'Construction Safety', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Provides safety knowledge specifically for construction sites and projects.', NULL, ARRAY[]::text[]),
  ('working-at-heights', 'Working at Heights Safety', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Learn safe work practices for activities conducted above ground level.', NULL, ARRAY[]::text[]),
  ('confined-space-entry', 'Confined Space Entry', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Provides critical safety procedures for entering and working within confined spaces.', NULL, ARRAY[]::text[]),
  ('she-induction', 'SHE Induction Training', 'health-safety-emergency', NULL, '2 Days', 850, 'Face-to-Face / Online', 'An introductory safety course designed for employees entering industrial and high-risk workplaces.', NULL, ARRAY[]::text[]),
  ('mining-safety-awareness', 'Mining Safety Awareness', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Introduces participants to health, safety and environmental practices commonly applied within mining operations.', NULL, ARRAY[]::text[]),
  ('intro-oil-gas-operations', 'Introduction to Oil and Gas Operations', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Gain foundational knowledge of the oil and gas industry, including exploration, production, transportation and safety requirements.', NULL, ARRAY[]::text[]),
  ('offshore-safety-awareness', 'Offshore Safety Awareness', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Introduces participants to safety requirements and hazards associated with offshore work environments.', NULL, ARRAY[]::text[]),
  ('hazardous-chemical-handling', 'Hazardous Chemical Handling', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Learn how to safely handle, store, transport and dispose of hazardous chemicals used in industrial operations.', NULL, ARRAY[]::text[]),
  ('permit-to-work-systems', 'Permit to Work Systems', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Introduces permit-to-work systems used to control high-risk activities and improve workplace safety.', NULL, ARRAY[]::text[]),
  ('waste-management-pollution-control', 'Waste Management and Pollution Control', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Develop practical skills for managing waste and minimizing environmental impacts in industrial settings.', NULL, ARRAY[]::text[]),
  ('basic-rigging-slinging', 'Basic Rigging and Slinging', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Introduces participants to safe lifting operations, rigging techniques and load handling procedures.', NULL, ARRAY[]::text[]),
  ('industrial-hygiene-awareness', 'Industrial Hygiene Awareness', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Learn how workplace exposures can affect employee health and how to identify, evaluate and control occupational health hazards.', NULL, ARRAY[]::text[]),
  ('lockout-tagout', 'Lockout and Tagout (LOTO)', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Teaches safe isolation procedures to prevent accidental energization of equipment during maintenance and repair.', NULL, ARRAY[]::text[]),
  ('industrial-housekeeping', 'Industrial Housekeeping', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Focuses on maintaining safe and organized workplaces to reduce accidents and improve productivity.', NULL, ARRAY[]::text[]),
  ('forklift-operator-awareness', 'Forklift Operator Awareness', 'mining-oil-gas', NULL, '3 Days', 1500, 'Face-to-Face / Online', 'Gain awareness of safe forklift operations, workplace hazards and operator responsibilities.', NULL, ARRAY[]::text[]),
  ('renewable-energy-green-hydrogen', 'Introduction to Renewable Energy and Green Hydrogen', 'mining-oil-gas', NULL, '2 Days', 850, 'Face-to-Face / Online', 'Introduces participants to Namibia''s emerging renewable energy and green hydrogen industries.', NULL, ARRAY[]::text[]),
  ('office-administration-skills', 'Office Administration Skills', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Equips participants with essential administrative and office management skills required in modern workplaces.', NULL, ARRAY[]::text[]),
  ('receptionist-front-desk', 'Receptionist and Front Desk Operations', 'business-administration', NULL, '3 Days', 750, 'Face-to-Face / Online', 'Develop the professional skills needed to create positive first impressions and effectively manage front-office operations.', NULL, ARRAY[]::text[]),
  ('customer-care-service-excellence', 'Customer Care and Service Excellence', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Teaches participants how to deliver outstanding customer experiences.', NULL, ARRAY[]::text[]),
  ('records-filing-management', 'Records and Filing Management', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Learn effective methods for organizing, storing, retrieving and managing organizational records and information.', NULL, ARRAY[]::text[]),
  ('basic-hr-management', 'Basic Human Resource Management', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Introduces participants to the core functions of human resource management and employee relations.', NULL, ARRAY[]::text[]),
  ('entrepreneurship-small-business', 'Entrepreneurship and Small Business Management', 'business-administration', NULL, '3 Days', 1000, 'Face-to-Face / Online', 'Learn how to start, manage and grow a successful small business in today''s competitive environment.', NULL, ARRAY[]::text[]),
  ('business-communication-skills', 'Business Communication Skills', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Develops effective verbal, written and interpersonal communication abilities.', NULL, ARRAY[]::text[]),
  ('supervisory-management-skills', 'Supervisory Management Skills', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Focuses on leadership, team management and operational effectiveness.', NULL, ARRAY[]::text[]),
  ('leadership-team-building', 'Leadership and Team Building', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Develop the leadership competencies needed to inspire teams, improve productivity and drive organizational success.', NULL, ARRAY[]::text[]),
  ('time-management-productivity', 'Time Management and Productivity', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Learn practical techniques for managing time effectively, improving productivity and achieving professional goals.', NULL, ARRAY[]::text[]),
  ('conflict-management-resolution', 'Conflict Management and Resolution', 'business-administration', NULL, '2 Days', 750, 'Face-to-Face / Online', 'Equips participants with practical strategies for managing workplace conflict and maintaining positive working relationships.', NULL, ARRAY[]::text[]),
  ('project-management-fundamentals', 'Project Management Fundamentals', 'business-administration', NULL, '4 Days', 1100, 'Face-to-Face / Online', 'Gain practical knowledge of project planning, implementation, monitoring and successful project delivery.', NULL, ARRAY[]::text[])
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, level = excluded.level,
  duration = excluded.duration, fee = excluded.fee, modes = excluded.modes,
  description = excluded.description, requirements = excluded.requirements,
  careers = excluded.careers, active = true, updated_at = now();

-- ---- demo applications ----
-- Local dev seed (demo applications). Runs on `supabase db reset` AFTER
-- seed_programmes.sql (order set in config.toml [db.seed].sql_paths).
-- Programmes themselves come from seed_programmes.sql (auto-generated from lib/content.ts).

-- Keep the reference counter ahead of the demo references below.
insert into public.reference_counters (year, last_seq) values (2026, 43)
  on conflict (year) do update set last_seq = greatest(public.reference_counters.last_seq, 43);

-- Demo applications so the Student Portal is explorable before real data exists.
insert into public.applications
  (reference, full_name, email, phone, programme_id, programme_slug, mode, stage, amount_due, approval_letter_path)
select 'SYM-2026-0042', 'Gabriel Naruseb', 'gabriel@example.com', '+264 81 000 0042',
       p.id, p.slug, 'full_time', 'approved', p.fee, 'approval-letters/SYM-2026-0042.pdf'
from public.programmes p where p.slug = 'certificate-ohs-level-4'
on conflict (reference) do nothing;

insert into public.applications
  (reference, full_name, email, phone, programme_id, programme_slug, mode, stage, amount_due, approval_letter_path)
select 'SYM-2026-0043', 'Maria Shikongo', 'maria@example.com', '+264 81 000 0043',
       p.id, p.slug, 'full_time', 'enrolled', 0, 'approval-letters/SYM-2026-0043.pdf'
from public.programmes p where p.slug = 'certificate-caregiving'
on conflict (reference) do nothing;

-- ---- suite demo slice ----
-- ============================================================================
-- Symanek Suite — demo seed (B1b) derived from src/data.js.
-- Coherent slice around demo student Gabriel !Naruseb (CVT-4 Y2).
-- Suite demo programmes are inserted with active=false + category 'suite-demo'
-- so they never surface on the public marketing site.
-- Idempotent via NOT EXISTS / ON CONFLICT guards.
-- ============================================================================

-- ---------- tenant ----------
insert into public.institutions (name, type, modules_enabled)
select 'Symanek Specialized College', 'Vocational college',
       array['admissions','registrar','finance','accounting','hr','library','residences','canteen','academics','compliance']
where not exists (select 1 from public.institutions where name = 'Symanek Specialized College');

-- ---------- programmes (Suite demo set; hidden from public site) ----------
insert into public.programmes (slug, name, category, level, duration, description, active)
select v.slug, v.name, 'suite-demo', 'NQF '||v.nqf, v.years||'-year', v.name, false
from (values
  ('dba-6','Diploma in Business Administration',6,3),
  ('daf-6','Diploma in Accounting & Finance',6,3),
  ('cit-5','Certificate in Information Technology',5,1),
  ('cvt-4','Certificate in Vocational Trades',4,2),
  ('bed-7','Bachelor of Education (Foundation Phase)',7,4)
) as v(slug,name,nqf,years)
on conflict (slug) do nothing;

-- ---------- staff ----------
insert into public.staff (tenant_id, staff_no, name, email, role, department)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.no, v.name,
       lower(regexp_replace(v.name,'[^a-zA-Z ]','','g'))||'@symanek.edu.na', v.role, v.dept
from (values
  ('SYM-001','Tobias Shikongo','Lecturer — Physical Sciences','Sciences'),
  ('SYM-002','Selma Iyambo','Lecturer — Mathematics','Mathematics'),
  ('SYM-003','Johannes Haufiku','HOD — Humanities','Humanities'),
  ('SYM-004','Loide Nangolo','Lecturer — Languages','Languages'),
  ('SYM-006','Frans Kandjii','Librarian','Support'),
  ('SYM-007','Ndapewa Amutenya','HR Officer','Administration'),
  ('SYM-008','Petrus Shilongo','Bursar','Administration')
) as v(no,name,role,dept)
where not exists (select 1 from public.staff s where s.staff_no = v.no);

-- ---------- courses ----------
insert into public.courses (tenant_id, code, title, programme_id, credits, semester, capacity, lecturer_staff_id)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.code, v.title, (select id from public.programmes where slug=v.slug),
       v.credits, v.sem, v.cap, (select id from public.staff where name=v.lect)
from (values
  ('BBA111','Principles of Management','dba-6',12,'S1',45,'Johannes Haufiku'),
  ('BBA124','Business Communication','dba-6',8,'S2',45,'Loide Nangolo'),
  ('ACC110','Financial Accounting I','daf-6',16,'S1',45,'Petrus Shilongo'),
  ('ACC220','Financial Accounting II','daf-6',16,'S2',40,'Petrus Shilongo'),
  ('ITC105','Computer Literacy & Office Tools','cit-5',10,'S1',48,'Selma Iyambo'),
  ('ITC152','Introduction to Networks','cit-5',12,'S2',36,'Selma Iyambo'),
  ('VTW101','Workshop Practice & Safety','cvt-4',14,'S1',50,'Tobias Shikongo'),
  ('VTW210','Advanced Workshop Practice','cvt-4',14,'S2',50,'Tobias Shikongo'),
  ('TRT120','Trade Theory & Materials','cvt-4',12,'S2',50,'Tobias Shikongo'),
  ('ENT100','Entrepreneurship for Trades','cvt-4',8,'S2',45,'Johannes Haufiku'),
  ('IND199','Industry Attachment (WIL)','cvt-4',12,'S2',60,'Tobias Shikongo'),
  ('EDU130','Child Development & Learning','bed-7',12,'S1',35,'Loide Nangolo')
) as v(code,title,slug,credits,sem,cap,lect)
where not exists (select 1 from public.courses c where c.code = v.code);

-- catalogue enrichment (coordinator / enrolled / accreditation / prereq)
update public.programmes p set nqf=v.nqf, years=v.years, coordinator=v.coord, enrolled=v.enr, accreditation=v.acc
from (values
  ('dba-6',6,3,'Johannes Haufiku',74,'NQA Accredited'),
  ('daf-6',6,3,'Petrus Shilongo',61,'NQA Accredited'),
  ('cit-5',5,1,'Selma Iyambo',48,'NQA Accredited'),
  ('cvt-4',4,2,'Tobias Shikongo',96,'NTA Registered'),
  ('bed-7',7,4,'Loide Nangolo',32,'Provisional')
) as v(slug,nqf,years,coord,enr,acc) where p.slug=v.slug;

update public.courses c set enrolled=v.enr, prereq_code=v.prereq
from (values
  ('BBA111',42,'—'),('BBA124',39,'—'),('ACC110',44,'—'),('ACC220',28,'ACC110'),
  ('ITC105',46,'—'),('ITC152',31,'ITC105'),('VTW101',50,'—'),('VTW210',44,'VTW101'),
  ('TRT120',47,'—'),('ENT100',39,'—'),('IND199',22,'VTW101'),('EDU130',30,'—')
) as v(code,enr,prereq) where c.code=v.code;

-- ---------- students ----------
insert into public.students (tenant_id, reference, full_name, email, programme_id, year, status)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.ref, v.name,
       lower(regexp_replace(v.name,'[^a-zA-Z ]','','g'))||'@student.symanek.edu.na',
       (select id from public.programmes where slug=v.slug), v.year, 'enrolled'
from (values
  ('SYM-STU-0001','Gabriel !Naruseb','cvt-4',2),
  ('SYM-STU-0002','Lahja Ndeshipanda','cit-5',1),
  ('SYM-STU-0003','Tuhafeni Gaoseb','daf-6',2),
  ('SYM-STU-0004','Ndinelago Hamutenya','dba-6',1),
  ('SYM-STU-0005','Helena Shivute','bed-7',1),
  ('SYM-STU-0006','Immanuel Tjiho','bed-7',1),
  ('SYM-STU-0007','Rauna Nakale','daf-6',1),
  ('SYM-STU-0008','Sakaria Ipinge','daf-6',2),
  ('SYM-STU-0009','Maria Nekundi','cit-5',1),
  ('SYM-STU-0010','Ruusa Nghidinwa','cit-5',1),
  ('SYM-STU-0011','Gerhard Swartbooi','cvt-4',1),
  ('SYM-STU-0012','Petrina Shaanika','cvt-4',1)
) as v(ref,name,slug,year)
where not exists (select 1 from public.students s where s.reference = v.ref);

-- ---------- enrolments (Gabriel's full CVT-4 load + VTW101 cohort) ----------
insert into public.enrolments (tenant_id, student_id, course_id, semester, status, charge)
select (select id from public.institutions where name='Symanek Specialized College'),
       (select id from public.students s where s.full_name=v.name),
       (select id from public.courses c where c.code=v.code),
       (select semester from public.courses c where c.code=v.code), v.status, v.charge
from (values
  ('Gabriel !Naruseb','VTW101','passed',3200),
  ('Gabriel !Naruseb','VTW210','registered',3200),
  ('Gabriel !Naruseb','TRT120','registered',2800),
  ('Gabriel !Naruseb','ENT100','registered',1900),
  ('Gabriel !Naruseb','IND199','registered',2800),
  ('Gerhard Swartbooi','VTW101','failed',3200),
  ('Ruusa Nghidinwa','ITC105','passed',2400)
) as v(name,code,status,charge)
where not exists (
  select 1 from public.enrolments e
  where e.student_id=(select id from public.students s where s.full_name=v.name)
    and e.course_id=(select id from public.courses c where c.code=v.code)
);

-- ---------- results (VTW101 mark sheet; final = 0.4*ca + 0.6*exam) ----------
insert into public.results (enrolment_id, ca, exam, final, grade, published)
select e.id, v.ca, v.exam, round(0.4*v.ca + 0.6*v.exam, 2),
       case when (0.4*v.ca+0.6*v.exam)>=80 then 'A' when (0.4*v.ca+0.6*v.exam)>=70 then 'B'
            when (0.4*v.ca+0.6*v.exam)>=60 then 'C' when (0.4*v.ca+0.6*v.exam)>=50 then 'D' else 'F' end,
       v.pub
from (values
  ('Gabriel !Naruseb','VTW101',68,61,true),
  ('Gerhard Swartbooi','VTW101',55,49,true),
  ('Ruusa Nghidinwa','ITC105',74,70,false)   -- provisional: awaiting exam-board approval
) as v(name,code,ca,exam,pub)
join public.enrolments e
  on e.student_id=(select id from public.students s where s.full_name=v.name)
 and e.course_id=(select id from public.courses c where c.code=v.code)
where not exists (select 1 from public.results r where r.enrolment_id=e.id);

-- ---------- invoices (tuition) ----------
insert into public.invoices (tenant_id, student_id, amount, balance, due, status)
select (select id from public.institutions where name='Symanek Specialized College'),
       (select id from public.students s where s.full_name=v.name),
       v.amount, v.balance, v.due::date,
       case when v.balance=0 then 'paid' when v.balance<v.amount then 'part' else 'open' end
from (values
  ('Lahja Ndeshipanda',11200,0,'2026-07-15'),
  ('Tuhafeni Gaoseb',13100,6550,'2026-07-15'),
  ('Ndinelago Hamutenya',11200,11200,'2026-06-30'),
  ('Gabriel !Naruseb',16300,16300,'2026-07-15'),
  ('Helena Shivute',9700,0,'2026-07-15'),
  ('Immanuel Tjiho',9700,4850,'2026-07-15'),
  ('Rauna Nakale',7200,7200,'2026-06-25'),
  ('Sakaria Ipinge',13100,0,'2026-07-15')
) as v(name,amount,balance,due)
where not exists (
  select 1 from public.invoices i
  where i.student_id=(select id from public.students s where s.full_name=v.name)
);

-- ---------- holds ----------
insert into public.holds (student_id, type, reason, blocks, active)
select (select id from public.students s where s.full_name=v.name), v.type, v.reason, v.blocks, true
from (values
  ('Tuhafeni Gaoseb','financial','Overdue balance N$ 6,550 (INV-2215)', array['registration','transcript']),
  ('Ndinelago Hamutenya','financial','Overdue balance N$ 11,200 (INV-2216)', array['registration']),
  ('Rauna Nakale','advising','Compulsory academic advising before S2 registration', array['registration'])
) as v(name,type,reason,blocks)
where not exists (
  select 1 from public.holds h
  where h.student_id=(select id from public.students s where s.full_name=v.name) and h.active
);

-- ---------- sponsors + claims ----------
insert into public.sponsors (tenant_id, name, type)
select (select id from public.institutions where name='Symanek Specialized College'), v.name, v.type
from (values
  ('NSFAF','Government loan/grant'),
  ('NTA Levy Fund','Vocational grant'),
  ('FNB Namibia Foundation','Corporate bursary'),
  ('Symanek Merit Bursary','Institutional'),
  ('Ohorongo Cement Trust','Corporate bursary')
) as v(name,type)
where not exists (select 1 from public.sponsors s where s.name=v.name);

insert into public.sponsor_claims (student_id, sponsor_id, coverage, billed, received, status)
select (select id from public.students s where s.full_name=v.name),
       (select id from public.sponsors sp where sp.name=v.sponsor),
       v.coverage, v.billed, v.received, v.status
from (values
  ('Gabriel !Naruseb','NSFAF',100,23500,0,'Claim submitted'),
  ('Gabriel !Naruseb','NTA Levy Fund',80,13040,13040,'Paid'),
  ('Maria Nekundi','FNB Namibia Foundation',100,13100,13100,'Paid')
) as v(name,sponsor,coverage,billed,received,status)
where (select id from public.students s where s.full_name=v.name) is not null
  and not exists (
    select 1 from public.sponsor_claims sc
    where sc.student_id=(select id from public.students s where s.full_name=v.name)
      and sc.sponsor_id=(select id from public.sponsors sp where sp.name=v.sponsor)
  );

-- ---------- exam sittings ----------
insert into public.exam_sittings (course_id, venue, seats, invigilator_staff_id, at)
select (select id from public.courses c where c.code=v.code), v.venue, v.seats,
       (select id from public.staff st where st.name=v.invig), v.at::timestamptz
from (values
  ('VTW101','Workshop A',50,'Tobias Shikongo','2026-11-27 09:00'),
  ('ACC110','Hall A',60,'Petrus Shilongo','2026-11-25 09:00'),
  ('ITC105','Lab 1+2',48,'Selma Iyambo','2026-11-26 13:00')
) as v(code,venue,seats,invig,at)
where not exists (
  select 1 from public.exam_sittings x where x.course_id=(select id from public.courses c where c.code=v.code)
);

-- ---------- courseware + assignments (VTW101) ----------
insert into public.courseware (course_id, title, url)
select (select id from public.courses c where c.code='VTW101'), v.title, null
from (values ('Workshop Safety Handbook'),('Hand & Power Tools — Slides'),('Welding Demonstration')) as v(title)
where not exists (select 1 from public.courseware cw
  where cw.course_id=(select id from public.courses c where c.code='VTW101') and cw.title=v.title);

insert into public.assignments (course_id, title, due, max_marks)
select (select id from public.courses c where c.code='VTW101'), v.title, v.due::date, v.max
from (values ('Safety Procedures Quiz','2026-07-18',20),('Tool Identification Report','2026-07-25',30)) as v(title,due,max)
where not exists (select 1 from public.assignments a
  where a.course_id=(select id from public.courses c where c.code='VTW101') and a.title=v.title);
