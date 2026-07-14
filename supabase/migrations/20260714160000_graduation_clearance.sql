-- ============================================================================
-- Symanek Suite — graduation clearance + certificate issue (Phase 2 / B4)
-- Clearance is DERIVED server-side from live data (BACKEND.md):
--   finance  = no outstanding invoice balance
--   library  = no active library hold
--   academic = cumulative GPA >= 2.0 (published results, institutional scale)
-- A certificate can only be issued when all three clear.
-- ============================================================================

create table public.certificates (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid unique references public.students(id) on delete cascade,
  cert_no    text unique not null,
  gpa        numeric(3,2),
  issued_by  uuid references auth.users(id),
  issued_at  timestamptz not null default now()
);
alter table public.certificates enable row level security;
create policy "certificates admin all" on public.certificates for all
  using (public.is_admin()) with check (public.is_admin());
create policy "certificates owner read" on public.certificates for select
  using (exists (select 1 from public.students s where s.id = certificates.student_id and s.user_id = auth.uid()));

-- cumulative GPA from published results (A=4 B=3 C=2 D=1 F=0 by final mark)
create or replace function public.student_gpa(p_student_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select round(coalesce(avg(
    case when r.final >= 80 then 4 when r.final >= 70 then 3
         when r.final >= 60 then 2 when r.final >= 50 then 1 else 0 end), 0), 2)
  from public.enrolments e join public.results r on r.enrolment_id = e.id
  where e.student_id = p_student_id and r.published;
$$;

-- derived clearance for a student (admin, or the student themselves)
create or replace function public.graduation_clearance(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_open numeric; v_fin boolean; v_lib boolean; v_gpa numeric;
begin
  if not public.is_admin() and not exists (
    select 1 from public.students s where s.id = p_student_id and s.user_id = auth.uid()
  ) then raise exception 'not authorized'; end if;

  select coalesce(sum(balance), 0) into v_open from public.invoices where student_id = p_student_id;
  v_fin := v_open <= 0;
  v_lib := not exists (select 1 from public.holds
                       where student_id = p_student_id and active and type = 'library');
  v_gpa := public.student_gpa(p_student_id);

  return jsonb_build_object(
    'finance', v_fin, 'library', v_lib, 'academic', v_gpa >= 2,
    'gpa', v_gpa, 'balance', v_open, 'cleared', v_fin and v_lib and (v_gpa >= 2));
end $$;
grant execute on function public.graduation_clearance(uuid) to authenticated;

-- issue a certificate — only when cleared. Idempotent. Admin/registrar only.
create or replace function public.issue_certificate(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cl jsonb; v_no text;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  v_cl := public.graduation_clearance(p_student_id);
  if not (v_cl->>'cleared')::boolean then
    return jsonb_build_object('ok', false, 'code', 'not_cleared', 'clearance', v_cl,
      'message', 'Student is not cleared to graduate — resolve outstanding clearance first.');
  end if;

  select cert_no into v_no from public.certificates where student_id = p_student_id;
  if v_no is not null then
    return jsonb_build_object('ok', true, 'code', 'already', 'cert_no', v_no,
      'message', 'Certificate ' || v_no || ' was already issued.');
  end if;

  v_no := 'CERT-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random() * 9999))::int::text, 4, '0');
  insert into public.certificates (student_id, cert_no, gpa, issued_by)
  values (p_student_id, v_no, (v_cl->>'gpa')::numeric, auth.uid());
  update public.students set status = 'graduated' where id = p_student_id;

  return jsonb_build_object('ok', true, 'code', 'issued', 'cert_no', v_no,
    'message', 'Certificate ' || v_no || ' issued.');
end $$;
grant execute on function public.issue_certificate(uuid) to authenticated;
