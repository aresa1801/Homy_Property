-- 2026-09-29 — Audit Homy: perbaikan izin trigger guard + pembersihan sisa 'property_owner'
--
-- TEMUAN (audit write-flow live):
--   Trigger `trg_guard_property_write` (SECURITY INVOKER) memanggil
--   public.is_admin_user(auth.uid()) dan public.has_partner_role(auth.uid()).
--   Kedua fungsi itu SECURITY DEFINER namun EXECUTE-nya hanya diberikan ke
--   postgres + service_role, sehingga saat role `authenticated` menyisipkan/
--   memperbarui properti (alur normal agen lewat app), trigger gagal dengan
--   "permission denied for function is_admin_user" (SQLSTATE 42501).
--   Akibat: SEMUA listing mitra (create/edit) gagal 400. Sudah diperbaiki.
--
-- Terapkan sebagai owner (postgres/migration), bukan lewat app.

-- 1) Beri izin eksekusi helper ke role `authenticated` (dipakai trigger guard).
grant execute on function public.has_partner_role(uuid) to authenticated;
grant execute on function public.is_admin_user(uuid) to authenticated;

-- 2) Rapikan sisa referensi role 'property_owner' (role sudah dihapus 28 Sep).
create or replace function public.has_partner_role(p_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = p_id and r.role = 'agent' and coalesce(r.status, 'active') = 'active'
  )
$fn$;
grant execute on function public.has_partner_role(uuid) to authenticated;

create or replace function public.submit_role_application(
  requested_role_input text, full_name_input text, phone_input text,
  company_name_input text default null, identity_number_input text default null,
  reason_input text default null)
returns public.role_applications language plpgsql set search_path to '' as $fn$
declare result public.role_applications;
begin
  if requested_role_input is distinct from 'agent' then raise exception 'Invalid requested role'; end if;
  insert into public.role_applications (applicant_id, requested_role, full_name, phone, company_name, identity_number, reason)
  values ((select auth.uid()), requested_role_input, full_name_input, phone_input, company_name_input, identity_number_input, reason_input)
  returning * into result;
  return result;
end;
$fn$;
grant execute on function public.submit_role_application(text,text,text,text,text,text) to authenticated;

-- 3) Bersihkan predikat RLS yang masih menyebut 'property_owner'.
alter policy partner_agreements_insert_own on public.partner_agreements
  with check ((user_id = (select auth.uid())) and (role = 'agent')
    and agreed_commission = true and agreed_report_transactions = true and agreed_terms = true);

alter policy partner_verifications_insert_own on public.partner_verifications
  with check ((user_id = (select auth.uid())) and (requested_role = 'agent')
    and (status = any (array['draft','pending'])));

alter policy profiles_update_own on public.profiles
  with check ((id = auth.uid()) and ((role is null) or (role = any (array['user','agent']))
    or (not (role is distinct from private.stored_profile_role(auth.uid())))));
