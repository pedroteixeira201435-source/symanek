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
