-- 2026-09-28 — Hapus role "Pemilik Properti" (property_owner) dari sistem Homy.
-- Semua data property_owner dimigrasikan ke 'agent', lalu CHECK constraint diperketat
-- sehingga role pemilik properti tidak bisa lagi dipakai. Model komisi tunggal = 0,5%.

begin;

-- 1) Migrasi data lama ke 'agent'.
--   Buang dulu baris property_owner yang usernya sudah punya peran agent (hindari duplikat PK).
delete from public.user_roles po
  where po.role = 'property_owner'
  and exists (select 1 from public.user_roles x where x.user_id = po.user_id and x.role = 'agent');
update public.user_roles set role = 'agent' where role = 'property_owner';
update public.profiles   set role = 'agent' where role = 'property_owner';
update public.role_applications set requested_role = 'agent' where requested_role = 'property_owner';
update public.partner_verifications set requested_role = 'agent' where requested_role = 'property_owner';
update public.partner_agreements set role = 'agent' where role = 'property_owner';
update public.transaction_reports set role = 'agent' where role = 'property_owner';
update public.partner_leads set kind = 'agent' where kind = 'owner';

-- 2) Perketat CHECK constraint (hapus opsi property_owner).
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role = any (array['user','agent','admin','super_admin']));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['user','agent','admin','super_admin']));

alter table public.role_applications drop constraint if exists role_applications_requested_role_check;
alter table public.role_applications add constraint role_applications_requested_role_check
  check (requested_role = any (array['agent']));

alter table public.partner_verifications drop constraint if exists partner_verifications_role_check;
alter table public.partner_verifications add constraint partner_verifications_role_check
  check (requested_role = any (array['agent']));

alter table public.partner_agreements drop constraint if exists partner_agreements_role_check;
alter table public.partner_agreements add constraint partner_agreements_role_check
  check (role = any (array['agent']));

alter table public.transaction_reports drop constraint if exists transaction_reports_role_check;
alter table public.transaction_reports add constraint transaction_reports_role_check
  check (role = any (array['agent']));

commit;
