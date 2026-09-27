-- ============================================================================
-- Homy Property — Program Bonus Referral (Agent → Agent)
-- Dibuat: 27 Sep 2026
-- Parameter: 0,1% dari nilai transaksi, cap Rp 2.000.000, 1 level, setelah
--            laporan transaksi diverifikasi admin + masa tahan 30 hari.
-- Idempoten: aman dijalankan ulang.
-- ============================================================================

-- 1) Peserta program (agen yang sudah mengaktifkan kode referralnya) ----------
create table if not exists public.referral_participants (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  code               text unique not null,
  status             text not null default 'active' check (status in ('active','suspended')),
  terms_version      text not null,
  terms_accepted_at  timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- 2) Konfigurasi program ------------------------------------------------------
create table if not exists public.referral_settings (
  id          boolean primary key default true check (id),
  rate        numeric not null default 0.001,
  cap_amount  numeric not null default 2000000,
  hold_days   integer not null default 30,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
insert into public.referral_settings (id) values (true) on conflict (id) do nothing;

-- 3) Klik tautan referral -----------------------------------------------------
create table if not exists public.referral_clicks (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  referrer_id uuid,
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists referral_clicks_code_idx on public.referral_clicks (code, created_at desc);

-- 4) Atribusi: siapa mereferensikan siapa (1 level) ---------------------------
create table if not exists public.referrals (
  id            uuid primary key default gen_random_uuid(),
  referrer_id   uuid not null references public.profiles(id) on delete cascade,
  code          text not null,
  referee_id    uuid unique references public.profiles(id) on delete cascade,
  referee_role  text,
  status        text not null default 'joined' check (status in ('joined','active','rejected','void')),
  source        text,
  cookie_code   text,
  joined_at     timestamptz not null default now(),
  fraud_flag    text,
  fraud_note    text,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint referrals_distinct_users check (referee_id is null or referee_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
create index if not exists referrals_status_idx on public.referrals (status);

-- 5) Buku besar komisi referral ----------------------------------------------
create table if not exists public.referral_ledger (
  id                    uuid primary key default gen_random_uuid(),
  referral_id           uuid not null references public.referrals(id) on delete cascade,
  referrer_id           uuid not null references public.profiles(id) on delete cascade,
  referee_id            uuid not null references public.profiles(id) on delete cascade,
  transaction_report_id uuid unique not null,
  property_id           uuid,
  property_title        text,
  basis_amount          numeric not null,
  rate                  numeric not null,
  amount                numeric not null,
  capped                boolean not null default false,
  status                text not null default 'hold' check (status in ('hold','approved','paid','void')),
  hold_until            timestamptz not null,
  approved_at           timestamptz,
  paid_at               timestamptz,
  payout_id             uuid,
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists referral_ledger_referrer_idx on public.referral_ledger (referrer_id, status);

-- 6) Batch pembayaran (transfer manual oleh admin) ----------------------------
create table if not exists public.referral_payouts (
  id             uuid primary key default gen_random_uuid(),
  referrer_id    uuid not null references public.profiles(id) on delete cascade,
  period         text,
  total_amount   numeric not null default 0,
  entries        integer not null default 0,
  method         text default 'transfer',
  bank_name      text,
  account_name   text,
  account_number text,
  reference      text,
  note           text,
  status         text not null default 'paid' check (status in ('draft','paid','void')),
  created_by     uuid,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);
create index if not exists referral_payouts_referrer_idx on public.referral_payouts (referrer_id, created_at desc);

-- 7) Jenis notifikasi baru ----------------------------------------------------
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'inquiry.new','inquiry.reply','visit.new','visit.confirmed','visit.cancelled','visit.completed',
  'listing.approved','listing.rejected','listing.match','alert.saved','system',
  'interest.new','interest.updated',
  'verification.submitted','verification.approved','verification.rejected','verification.reminder',
  'partnership.updated','notary.request','notary.recommended',
  'sanction.warning','sanction.suspended','sanction.blocked','sanction.lifted',
  'ai.analysis','ai.message',
  'referral.joined','referral.commission','referral.payout'
]));

-- 8) RLS: mitra hanya melihat data miliknya sendiri (admin pakai service role) -
alter table public.referral_participants enable row level security;
alter table public.referral_settings     enable row level security;
alter table public.referral_clicks       enable row level security;
alter table public.referrals             enable row level security;
alter table public.referral_ledger       enable row level security;
alter table public.referral_payouts      enable row level security;

drop policy if exists referral_participants_own on public.referral_participants;
create policy referral_participants_own on public.referral_participants
  for all to public
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists referral_settings_read on public.referral_settings;
create policy referral_settings_read on public.referral_settings
  for select to authenticated using (true);

drop policy if exists referrals_participant_select on public.referrals;
create policy referrals_participant_select on public.referrals
  for select to public
  using ((referrer_id = (select auth.uid())) or (referee_id = (select auth.uid())));

drop policy if exists referral_ledger_referrer_select on public.referral_ledger;
create policy referral_ledger_referrer_select on public.referral_ledger
  for select to public using (referrer_id = (select auth.uid()));

drop policy if exists referral_payouts_referrer_select on public.referral_payouts;
create policy referral_payouts_referrer_select on public.referral_payouts
  for select to public using (referrer_id = (select auth.uid()));

-- referral_clicks: tanpa policy → hanya service role yang bisa baca/tulis.
