-- ============================================================================
-- Symanek Suite — GO-LIVE SEED (REAL data, Symanek response 2026-08).
--   • 7 staff accounts (records; auth users created separately)
--   • programme modules (courses) for 10 programmes
--   • 24 registered students — Auxiliary Nursing, January 2026 intake
--
-- Idempotent: safe to re-run. Run against the live project when Pedro
-- unblocks the cloud:  supabase db execute --file supabase/seed_golive.sql
-- (or paste into the SQL editor).  NOT part of the migration chain.
--
-- RESOLVED (Symanek response 2026-08-23):
--   • OHS Level 4 (Q0172) & Level 5 (Q0173) modules — seeded from the NQA
--     unit-standard qualifications (unit ID = module code, per the college).
--   • lecturer-per-module mapping (E1) — set below from the lecturer list.
--
--   • "Zidane Muhuka" (23 Aug) resolved to the existing "Muhuka Ratukara"
--     (SYM-STF-006) — same surname/title/role, only other nursing lecturer.
--
-- STILL PENDING from client (do not invent):
--   • students for programmes other than Auxiliary Nursing (E3).
--   • staff emails for the newly named lecturers (left NULL below).
-- ============================================================================

-- ---------- staff (real) ----------
insert into public.staff (tenant_id, staff_no, name, email, role, department)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.no, v.name, v.email, v.role, v.dept
from (values
  ('SYM-STF-001','Olivia Nelumbu','nelumbuo@symanekacademy.com','CEO','Executive'),
  ('SYM-STF-002','Jeremia Fillemon','jeremiaf@symanekacademy.com','System Administrator / Campus Acting Manager','Administration'),
  ('SYM-STF-003','Melkisedek Job','jobnangolo@symanekacademy.com','Debtors & Creditors Clerk','Finance'),
  ('SYM-STF-004','Katrina Inkembwa','katrinai@symanekacademy.com','Lecturer — Nursing','Nursing'),
  ('SYM-STF-005','Rebbeka Shilongo','rebbekas@symanekacademy.com','Administration Assistant','Administration'),
  ('SYM-STF-006','Muhuka Ratukara','ratukaram@symanekacademy.com','Lecturer — Nursing','Nursing'),
  ('SYM-STF-007','Shimunyengu Dortea','dshimunyengu@symanekacademy.com','Instructor — OHS','Occupational Health & Safety')
) as v(no,name,email,role,dept)
where not exists (select 1 from public.staff s where s.staff_no = v.no);

-- ---------- courses / modules (real curriculum) ----------
insert into public.courses (tenant_id, code, title, programme_id, credits, semester)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.code, v.title, (select id from public.programmes where slug=v.slug), v.credits, v.sem
from (values
  ('NAP1500','Human Anatomy and Physiology','certificate-auxiliary-nursing-science',12,'Year (S1&S2)'),
  ('GNS1500','General Nursing Science Theory','certificate-auxiliary-nursing-science',15,'Year (S1&S2)'),
  ('GNSP1500','General Nursing Science Practical','certificate-auxiliary-nursing-science',70,'Year (S1&S2)'),
  ('CHN1500','Community Health Nursing Theory','certificate-auxiliary-nursing-science',10,'Year (S1&S2)'),
  ('CHNP1500','Community Health Nursing Practical','certificate-auxiliary-nursing-science',30,'Year (S1&S2)'),
  ('ENP1500','Ethos of Nursing and Professional Practice','certificate-auxiliary-nursing-science',8,'Year (S1&S2)'),
  ('NECS1500','English for Communication and Study Skills','certificate-auxiliary-nursing-science',4,'S1'),
  ('FAN1500','First Aid','certificate-auxiliary-nursing-science',4,'S1'),
  ('BCS1400','Basic Computer Skills','certificate-auxiliary-nursing-science',4,'S1'),
  ('ISFN1500','Introduction to Sociology for Nurses','certificate-auxiliary-nursing-science',5,'S1'),
  ('HISY1400','Introduction to Health Information System','certificate-auxiliary-nursing-science',4,'S2'),
  ('IHED1500','Introduction to Health Education','certificate-auxiliary-nursing-science',4,'S2'),
  ('IFN1500','Introduction to Food and Nutrition','certificate-auxiliary-nursing-science',4,'S2'),
  ('NECS1400','English for Communication and Study Skills','bachelor-ohse-nqf7',4,'Y1 S1'),
  ('NFAD1400','First Aid','bachelor-ohse-nqf7',4,'Y1 S1'),
  ('IHUA1500','Introduction to Human Anatomy','bachelor-ohse-nqf7',8,'Y1 S1'),
  ('NBCS1400','Basic Computer Skills','bachelor-ohse-nqf7',4,'Y1 S1'),
  ('OHSEL1501','OHS & Environmental Law and Regulations I','bachelor-ohse-nqf7',8,'Y1 S1'),
  ('IOHSM1501','Introduction to OHS & Environmental Management I','bachelor-ohse-nqf7',8,'Y1 S1'),
  ('EFAW1500','English for Academic Writing','bachelor-ohse-nqf7',6,'Y1 S2'),
  ('IHUP1500','Introduction to Human Physiology','bachelor-ohse-nqf7',8,'Y1 S2'),
  ('IOHSM1502','Introduction to OHS & Environmental Management II','bachelor-ohse-nqf7',10,'Y1 S2'),
  ('OHSEL1502','OHS & Environmental Law and Regulations II','bachelor-ohse-nqf7',6,'Y1 S2'),
  ('MIDI1500','Microbiology and Infectious Diseases','bachelor-ohse-nqf7',6,'Y1 S2'),
  ('MOHS1500','Mathematics for OHS','bachelor-ohse-nqf7',5,'Y1 S2'),
  ('EHSP1500','Environmental Health & Safety Practice I (Internship)','bachelor-ohse-nqf7',16,'Y1 S2'),
  ('BIHI2600','Biostatistics & Health Informatics','bachelor-ohse-nqf7',5,'Y2 S1'),
  ('EPOD2600','Epidemiology and Occupational Diseases','bachelor-ohse-nqf7',5,'Y2 S1'),
  ('PHESA2600','Psychological Health and Safety','bachelor-ohse-nqf7',8,'Y2 S1'),
  ('SASD2600','Safety Systems Design','bachelor-ohse-nqf7',8,'Y2 S1'),
  ('FSEM2600','Fire Safety & Emergency Management','bachelor-ohse-nqf7',8,'Y2 S1'),
  ('ERDE2600','Ergonomic Design','bachelor-ohse-nqf7',8,'Y2 S1'),
  ('APIN2600','Accident Prevention & Investigation','bachelor-ohse-nqf7',8,'Y2 S1'),
  ('EHSP2600','Environmental Health & Safety Practice II (Internship)','bachelor-ohse-nqf7',16,'Y2 S1'),
  ('CSTO2600','Chemical Safety & Toxicology','bachelor-ohse-nqf7',8,'Y2 S2'),
  ('HIRA2600','Hazard Identification & Risk Assessment','bachelor-ohse-nqf7',10,'Y2 S2'),
  ('ENSE2600','Environmental Science & Ecology','bachelor-ohse-nqf7',8,'Y2 S2'),
  ('BESL2600','Behavioural Safety & Leadership','bachelor-ohse-nqf7',8,'Y2 S2'),
  ('INHS2600','Industrial Health and Safety I','bachelor-ohse-nqf7',10,'Y2 S2'),
  ('WMPC2600','Waste Management and Pollution Control','bachelor-ohse-nqf7',6,'Y2 S2'),
  ('SEMA3700','Sustainable Environmental Management','bachelor-ohse-nqf7',10,'Y3 S1'),
  ('OHSES3701','OHS&E Management Systems I','bachelor-ohse-nqf7',12,'Y3 S1'),
  ('QMS3701','Quality Management Systems I','bachelor-ohse-nqf7',12,'Y3 S1'),
  ('WPHP3700','Workplace Health Promotion','bachelor-ohse-nqf7',12,'Y3 S1'),
  ('DPRE3700','Disaster Preparedness & Response','bachelor-ohse-nqf7',10,'Y3 S1'),
  ('PMOHS3700','Project Management in OHS','bachelor-ohse-nqf7',8,'Y3 S1'),
  ('INHS3700','Industrial Health and Safety II','bachelor-ohse-nqf7',15,'Y3 S1'),
  ('EHSP3700','Environmental Health & Safety Practice III (Internship)','bachelor-ohse-nqf7',16,'Y3 S1'),
  ('REME3700','Introduction to Research Methodology','bachelor-ohse-nqf7',8,'Y3 S2'),
  ('OHSEMS3702','OHS&E Management Systems II','bachelor-ohse-nqf7',12,'Y3 S2'),
  ('QMS3702','Quality Management Systems II','bachelor-ohse-nqf7',12,'Y3 S2'),
  ('PIH3700','Principles of Industrial Hygiene','bachelor-ohse-nqf7',10,'Y3 S2'),
  ('OHSEPA3700','OHS & Environment Policy Development and Advocacy','bachelor-ohse-nqf7',10,'Y3 S2'),
  ('EHSP3701','Environmental Health & Safety Practice III (Internship)','bachelor-ohse-nqf7',24,'Y3 S2'),
  ('AOHG811','Advanced Occupational Health & Safety Governance','bachelor-ohse-honours-nqf8',12,'S1'),
  ('AEMS812','Advanced Environmental Management & Sustainability','bachelor-ohse-honours-nqf8',12,'S1'),
  ('SRMC813','Strategic Risk Management & Legal Compliance','bachelor-ohse-honours-nqf8',12,'S1'),
  ('IMAS814','Integrated Management Systems (ISO 45001, 14001, 9001)','bachelor-ohse-honours-nqf8',12,'S1'),
  ('REME815','Research Methodology','bachelor-ohse-honours-nqf8',10,'S1'),
  ('AAW816','Advanced Academic Writing','bachelor-ohse-honours-nqf8',12,'S1'),
  ('OHSP821','OHSE Policy Development, Governance & Advocacy','bachelor-ohse-honours-nqf8',10,'S2'),
  ('CSEG822','Corporate Sustainability, ESG & Environmental Governance','bachelor-ohse-honours-nqf8',10,'S2'),
  ('SLSC823','Strategic Leadership & Safety Culture','bachelor-ohse-honours-nqf8',10,'S2'),
  ('AIAS824','Advanced Incident Analysis & Systems Failure Management','bachelor-ohse-honours-nqf8',10,'S2'),
  ('CTSK826','Critical Thinking Skills in Health and Safety','bachelor-ohse-honours-nqf8',8,'S2'),
  ('REPR825','Research Project','bachelor-ohse-honours-nqf8',32,'S2'),
  ('CCFN1300','Fundamentals of Nursing and Caregiving','certificate-caregiving',6,'S1'),
  ('CCCS1300','Communication Skills for Caregivers','certificate-caregiving',3,'S1'),
  ('CCAP1300','Introduction to Anatomy and Physiology','certificate-caregiving',4,'S1'),
  ('CCFA1300','First Aid','certificate-caregiving',4,'S1'),
  ('CCWM1300','Introduction to Wound Management','certificate-caregiving',3,'S1'),
  ('CCIP1300','Introduction to Infection Prevention and Control','certificate-caregiving',4,'S1'),
  ('CCPH1300','Introduction to Pharmacology and Safe Medication Assistance','certificate-caregiving',4,'S1'),
  ('CCWP1300','Caregiving Workplace Practice (Internship)','certificate-caregiving',32,'S1'),
  ('MPN401','Medical Practice N4','certificate-medical-office-admin-level-4',25,'S1'),
  ('IPN402','Information Processing N4','certificate-medical-office-admin-level-4',18,'S1'),
  ('OPN403','Office Practice N4','certificate-medical-office-admin-level-4',20,'S1'),
  ('COM404','Communication N4','certificate-medical-office-admin-level-4',12,'S1'),
  ('EBN405','Entrepreneurship & Business Management N4','certificate-medical-office-admin-level-4',15,'S2'),
  ('FAN406','Financial Accounting N4','certificate-medical-office-admin-level-4',15,'S2'),
  ('CPN407','Computer Practice N4','certificate-medical-office-admin-level-4',15,'S2'),
  ('MPN502','Medical Practice N5','diploma-medical-office-admin-level-5',30,'S1&S2'),
  ('IPN502','Information Processing N5','diploma-medical-office-admin-level-5',25,'S1&S2'),
  ('OPN502','Office Practice N5','diploma-medical-office-admin-level-5',30,'S1&S2'),
  ('COM502','Communication N5','diploma-medical-office-admin-level-5',25,'S1&S2'),
  ('FIA402','First Aid N4','diploma-medical-office-admin-level-5',4,'S2'),
  ('WIL502','Work Integrated Learning','diploma-medical-office-admin-level-5',50,'S1&S2'),
  ('MHSC401','Introduction to Mental Health and Wellbeing','certificate-mental-health-level-4',15,'S1'),
  ('PSYC402','Fundamentals of Psychology and Human Behaviour','certificate-mental-health-level-4',15,'S1'),
  ('SOCI403','Sociology for Mental Health','certificate-mental-health-level-4',12,'S1'),
  ('COMS404','Communication Skills and Interpersonal Relations','certificate-mental-health-level-4',12,'S1'),
  ('ETHC405','Professional Ethics and Legal Framework in Counselling','certificate-mental-health-level-4',10,'S1'),
  ('PSYC406','Fundamentals of Psychological Counselling','certificate-mental-health-level-4',15,'S1'),
  ('TRMA407','Trauma, Crisis, and Stress Management','certificate-mental-health-level-4',15,'S1'),
  ('NBCS1400','Basic Computer Skills','certificate-mental-health-level-4',4,'S1'),
  ('COMM408','Community Mental Health and Support Systems','certificate-mental-health-level-4',15,'S2'),
  ('RECD409','Record Keeping, Case Management, and Documentation','certificate-mental-health-level-4',12,'S2'),
  ('SASI410','Substance Abuse and Social Issues','certificate-mental-health-level-4',12,'S2'),
  ('CSKL411','Counselling Skills and Techniques','certificate-mental-health-level-4',20,'S2'),
  ('PSYC412','Psychological Counselling II','certificate-mental-health-level-4',12,'S2'),
  ('HLTH413','Bullying, Addiction, and Gender Based Violence Recovery Studies','certificate-mental-health-level-4',10,'S2'),
  ('WIL415','Work Integrated Learning (WIL) / Practicum','certificate-mental-health-level-4',30,'S2'),
  ('MHSP501','Applied Mental Health and Psychopathology','diploma-mental-health-level-5',15,'S1'),
  ('PSYC502','Developmental Psychology and Lifespan Mental Health','diploma-mental-health-level-5',12,'S1'),
  ('CSGW503','Advanced Counselling Theories and Techniques','diploma-mental-health-level-5',16,'S1'),
  ('ELEF504','Ethics, Legal Framework and Professional Practice','diploma-mental-health-level-5',10,'S1'),
  ('TRMA505','Trauma-Informed Care and Crisis Intervention','diploma-mental-health-level-5',10,'S1'),
  ('PSYC506','Behavioural Intervention and Motivational Approaches','diploma-mental-health-level-5',12,'S2'),
  ('CMGT507','Case Management and Multi-Disciplinary Coordination','diploma-mental-health-level-5',12,'S2'),
  ('COMM508','Community Programme Design and Evaluation','diploma-mental-health-level-5',10,'S2'),
  ('EBP509','Evidence-Based Practice and Reflective Professional Development','diploma-mental-health-level-5',8,'S2'),
  ('MHWI510','Mental Health in Workplace and Institutional Settings','diploma-mental-health-level-5',8,'S2'),
  ('PSYC511','Psychopharmacology Awareness for Support Practitioners','diploma-mental-health-level-5',7,'S2'),
  ('WIL512','Work Integrated Learning (Supervised Field Practice)','diploma-mental-health-level-5',50,'S2'),
  ('NUDI401','Introduction to Nutrition and Dietetics','certificate-nutrition-dietetics-level-4',8,'S1'),
  ('ANPH402','Human Anatomy and Physiology for Nutrition','certificate-nutrition-dietetics-level-4',10,'S1'),
  ('FOSC403','Fundamentals of Food Science','certificate-nutrition-dietetics-level-4',10,'S1'),
  ('HNUT404','Principles of Human Nutrition','certificate-nutrition-dietetics-level-4',8,'S1'),
  ('COMH405','Communication Skills for Health Education','certificate-nutrition-dietetics-level-4',6,'S1'),
  ('FPRT406','Food Preparation and Kitchen Skills Practical','certificate-nutrition-dietetics-level-4',10,'S1'),
  ('FCUL407','Food Culture, Indigenous Foods and Dietary Practices','certificate-nutrition-dietetics-level-4',6,'S1'),
  ('NBCS1400','Basic Computer Skills','certificate-nutrition-dietetics-level-4',4,'S1'),
  ('LCNU408','Lifecycle Nutrition','certificate-nutrition-dietetics-level-4',8,'S2'),
  ('CNPB409','Community Nutrition and Public Health','certificate-nutrition-dietetics-level-4',8,'S2'),
  ('FHSS410','Food Hygiene, Safety and Sanitation','certificate-nutrition-dietetics-level-4',10,'S2'),
  ('IPCN411','Infection Prevention and Control in Food and Nutrition Settings','certificate-nutrition-dietetics-level-4',6,'S2'),
  ('NAMP412','Nutrition Assessment and Meal Planning','certificate-nutrition-dietetics-level-4',10,'S2'),
  ('FADR413','Basic First Aid and Emergency Response','certificate-nutrition-dietetics-level-4',6,'S2'),
  ('CNPR414','Community Nutrition Practical','certificate-nutrition-dietetics-level-4',15,'S2'),
  ('IONU415','Industrial and Occupational Nutrition','certificate-nutrition-dietetics-level-4',8,'S2'),
  ('NUBM501','Nutritional Biochemistry and Metabolism','diploma-nutrition-dietetics-level-5',12,'S1'),
  ('AHNU502','Advanced Human Nutrition','diploma-nutrition-dietetics-level-5',12,'S1'),
  ('NUMQ503','Nutritional Microbiology and Food Quality Control','diploma-nutrition-dietetics-level-5',10,'S1'),
  ('NASU504','Nutrition Assessment and Surveillance','diploma-nutrition-dietetics-level-5',12,'S1'),
  ('MIYC505','Maternal, Infant and Young Child Nutrition','diploma-nutrition-dietetics-level-5',10,'S1'),
  ('FSMC506','Food Service Management and Institutional Catering','diploma-nutrition-dietetics-level-5',10,'S1'),
  ('NAFP507','Practical in Nutrition Assessment and Food Service (WIL)','diploma-nutrition-dietetics-level-5',14,'S1'),
  ('CNDT508','Clinical Nutrition and Diet Therapy','diploma-nutrition-dietetics-level-5',12,'S2'),
  ('PHON509','Public Health and Occupational Nutrition in SADC','diploma-nutrition-dietetics-level-5',12,'S2'),
  ('NCBC510','Nutrition Counselling and Behaviour Change','diploma-nutrition-dietetics-level-5',10,'S2'),
  ('IRMNS511','Introduction to Research Methods and Nutrition Statistics','diploma-nutrition-dietetics-level-5',8,'S2'),
  ('FSSI512','Food Systems, Sustainability and Indigenous Diets','diploma-nutrition-dietetics-level-5',10,'S2'),
  ('EPPN513','Entrepreneurship and Professional Practice in Nutrition','diploma-nutrition-dietetics-level-5',8,'S2'),
  ('WIL514','Supervised Practicum / Field Attachment','diploma-nutrition-dietetics-level-5',22,'S2'),
  ('AION515','Applied Industrial and Occupational Nutrition','diploma-nutrition-dietetics-level-5',8,'S2')
) as v(code,title,slug,credits,sem)
where (select id from public.programmes where slug=v.slug) is not null
  and not exists (
    select 1 from public.courses c
    where c.code = v.code
      and c.programme_id = (select id from public.programmes where slug=v.slug)
  );

-- ---------- students (Auxiliary Nursing, January 2026 intake) ----------
insert into public.students (tenant_id, reference, student_no, full_name, email, programme_id, year, status)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.ref, v.ref, v.name, v.email,
       (select id from public.programmes where slug='certificate-auxiliary-nursing-science'), 1, 'enrolled'
from (values
  ('202610273','Lebohang R R Topnaar','topnaarlebhang@gmail.com'),
  ('202626873','Mahe A P Peiter','mahepieters@gmail.com'),
  ('202694308','Shahida Petha','shahidapetha44@gmail.com'),
  ('202691406','Mbalandiina Mwatelulo','mbalandinavalentine@gmail.com'),
  ('202671588','Uzuvira C Ngairo','khadishangairo1996@gmail.com'),
  ('202625461','Meriam N Mutunda','meriammutunda@gmail.com'),
  ('202620433','Rhuzaine R N Mukumba','shanicemukumba43@gmail.com'),
  ('202694340','Lowrence N Shoombe','lowrenceshoombe15@gmail.com'),
  ('202686830','Romeo R Geingob','geingobromeo@gmail.com'),
  ('202686656','Liyandja-tango Amunyela','channafaratango@gmail.com'),
  ('202667489','Kornelia H Taapopi','korneliataapopi@gmail.com'),
  ('202697893','Magano K Kadhingula','maganokadhingula@gmail.com'),
  ('202665491','Arijetha Hoaes','arijetnah@gmail.com'),
  ('202634425','Tuhafeni N Hamundja','hamundjat@gmail.com'),
  ('202659146','Merveline U Modise','mervelinemodise8@gmail.com'),
  ('202662769','Simona D Karunga','samonadimpho852@gmail.com'),
  ('202643860','Mekondjo Mborero','mekondjomborero@gmail.com'),
  ('202691832','Vetondouua Hengari','vetondouuahengari3@gmail.com'),
  ('202676854','Manga Zambwe','mangakani05@gmail.com'),
  ('202688910','Brigitte H Kandondo','brigittemukuve@gmail.com'),
  ('202697010','Eveline Sabba','shashatia123@gmail.com'),
  ('202671756','Kaarina L Fillemon','fillemonkaarina74@gmail.com'),
  ('202676924','Mbapeua Mbariko','mbapeuambariko72@gmail.com'),
  ('202586674','Uyarurapo Albertina Katjivikua','albertinakatjivikua@gmail.com')
) as v(ref,name,email)
where not exists (select 1 from public.students s where s.reference = v.ref);

-- ---------- additional lecturers (Symanek response 2026-08-23) ----------
-- Emails unknown (not supplied by the college) — left NULL, to be filled later.
insert into public.staff (tenant_id, staff_no, name, email, role, department)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.no, v.name, v.email, v.role, v.dept
from (values
  ('SYM-STF-008','Josephine Ipinge',   null::text, 'Lecturer — Medical Office Administration','Medical Office Administration'),
  -- NB: the 23 Aug response names the Auxiliary lecturer "Zidane Muhuka"; the
  -- earlier staff list (ICT System info) has "Muhuka Ratukara" (Mr., Lecturer,
  -- Nursing, ratukaram@) — same surname/title/role, the only other nursing
  -- lecturer, so treated as the SAME person (SYM-STF-006). No new record added.
  ('SYM-STF-010','Rakkel',              null::text, 'Lecturer — Mental Health & Psychosocial Counselling','Mental Health'),
  ('SYM-STF-011','Sithembinkosi Moyo',  null::text, 'Lecturer — OHSE (Bachelor)','Occupational Health & Safety'),
  ('SYM-STF-012','Julia Abel',          null::text, 'Lecturer — OHSE (Bachelor, first semester)','Occupational Health & Safety')
) as v(no,name,email,role,dept)
where not exists (select 1 from public.staff s where s.staff_no = v.no);

-- ---------- OHS Level 4 & 5 modules (NQA unit standards; code = unit ID) ----------
insert into public.courses (tenant_id, code, title, programme_id, credits, semester)
select (select id from public.institutions where name='Symanek Specialized College'),
       v.code, v.title, (select id from public.programmes where slug=v.slug), v.credits, v.sem
from (values
  -- Certificate in OHS Level 4 (Q0172) — compulsory + supervisor + representative strands
  ('846','Ensure your own actions reduce risks to health and safety','certificate-ohs-level-4',3,'Compulsory (L3)'),
  ('847','Demonstrate responsibility within the workplace to protect the environment','certificate-ohs-level-4',5,'Compulsory (L3)'),
  ('849','Monitor procedures to safely control work operations','certificate-ohs-level-4',5,'Compulsory (L4)'),
  ('850','Supervise the health, safety and welfare of an employee new to a role in the workplace','certificate-ohs-level-4',8,'Compulsory (L4)'),
  ('851','Advocate and keep pace with improvements in health and safety practice','certificate-ohs-level-4',6,'Compulsory (L4)'),
  ('852','Develop and maintain individual and organisational competence in health and safety matters','certificate-ohs-level-4',8,'Compulsory (L4)'),
  ('853','Develop and implement the health and safety programme','certificate-ohs-level-4',7,'Compulsory (L5)'),
  ('848','Develop procedures to safely control work operations','certificate-ohs-level-4',6,'Supervisor strand (L4)'),
  ('859','Promote a positive health and safety culture in workplaces','certificate-ohs-level-4',10,'Representative strand (L5)'),
  ('863','Contribute to health and safety legal actions','certificate-ohs-level-4',6,'Representative strand (L5)'),
  -- Diploma in OHS Level 5 (Q0173) — all compulsory
  ('846','Ensure your own actions reduce risks to health and safety','diploma-ohs-level-5',3,'Compulsory (L3)'),
  ('847','Demonstrate responsibility within the workplace to protect the environment','diploma-ohs-level-5',3,'Compulsory (L3)'),
  ('848','Develop procedures to safely control work operations','diploma-ohs-level-5',6,'Compulsory (L4)'),
  ('849','Monitor procedures to safely control work operations','diploma-ohs-level-5',5,'Compulsory (L4)'),
  ('850','Supervise the health, safety and welfare of an employee new to a role in the workplace','diploma-ohs-level-5',8,'Compulsory (L4)'),
  ('851','Advocate and keep pace with improvements in health and safety practices','diploma-ohs-level-5',6,'Compulsory (L4)'),
  ('852','Develop and maintain individual and organisational competence in health and safety matters','diploma-ohs-level-5',8,'Compulsory (L4)'),
  ('853','Develop and implement effective communication systems for health and safety information','diploma-ohs-level-5',7,'Compulsory (L4)'),
  ('854','Develop and implement the health and safety programme','diploma-ohs-level-5',7,'Compulsory (L5)'),
  ('855','Conduct a health and safety risk assessment in a workplace','diploma-ohs-level-5',10,'Compulsory (L5)'),
  ('856','Develop and carry out health and safety audit systems','diploma-ohs-level-5',8,'Compulsory (L5)'),
  ('857','Develop and implement health and safety emergency response systems and procedures','diploma-ohs-level-5',6,'Compulsory (L5)'),
  ('858','Investigate and evaluate health and safety incidents, accidents and complaints in the workplace','diploma-ohs-level-5',8,'Compulsory (L5)'),
  ('859','Promote a positive health and safety culture in workplaces','diploma-ohs-level-5',10,'Compulsory (L5)'),
  ('860','Review health and safety procedures in workplaces','diploma-ohs-level-5',8,'Compulsory (L5)'),
  ('861','Develop and review the organisation''s health and safety strategy','diploma-ohs-level-5',12,'Compulsory (L5)'),
  ('862','Develop and implement health and safety review systems','diploma-ohs-level-5',8,'Compulsory (L5)'),
  ('863','Contribute to health and safety legal actions','diploma-ohs-level-5',6,'Compulsory (L5)')
) as v(code,title,slug,credits,sem)
where (select id from public.programmes where slug=v.slug) is not null
  and not exists (
    select 1 from public.courses c
    where c.code = v.code
      and c.programme_id = (select id from public.programmes where slug=v.slug)
  );

-- ---------- lecturer-per-module mapping (Symanek response 2026-08-23) ----------
-- Set the broad rule per programme first, then override the exceptions.

-- OHS Level 4 & 5 → Ms. Dortea L. Shimunyengu
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-007')
where programme_id in (select id from public.programmes where slug in ('certificate-ohs-level-4','diploma-ohs-level-5'));

-- Caregiving → Ms. Katrina Inkembwa
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-004')
where programme_id = (select id from public.programmes where slug='certificate-caregiving');

-- Auxiliary Nursing → Mr. Muhuka Ratukara (a.k.a. "Zidane Muhuka", SYM-STF-006),
-- except First Aid + Ethos of Nursing → Ms. Katrina Inkembwa
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-006')
where programme_id = (select id from public.programmes where slug='certificate-auxiliary-nursing-science');
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-004')
where programme_id = (select id from public.programmes where slug='certificate-auxiliary-nursing-science')
  and code in ('FAN1500','ENP1500');

-- Medical Office Administration (L4 & L5) → Ms. Josephine Ipinge
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-008')
where programme_id in (select id from public.programmes where slug in ('certificate-medical-office-admin-level-4','diploma-medical-office-admin-level-5'));

-- Mental Health Support & Psychosocial Counselling (L4 & L5) → Ms. Rakkel
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-010')
where programme_id in (select id from public.programmes where slug in ('certificate-mental-health-level-4','diploma-mental-health-level-5'));

-- Bachelor OHSE (L7 & Honours L8) → Ms. Sithembinkosi Moyo;
-- first semester of the Level 7 (Y1 S1, being implemented now) → Ms. Julia Abel
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-011')
where programme_id in (select id from public.programmes where slug in ('bachelor-ohse-nqf7','bachelor-ohse-honours-nqf8'));
update public.courses set lecturer_staff_id = (select id from public.staff where staff_no='SYM-STF-012')
where programme_id = (select id from public.programmes where slug='bachelor-ohse-nqf7')
  and semester = 'Y1 S1';

notify pgrst, 'reload schema';
