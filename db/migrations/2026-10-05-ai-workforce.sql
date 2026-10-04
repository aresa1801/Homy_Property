-- ==========================================================================
-- Homy AI Workforce — Fase 1
-- "Kantor" AI: registry karyawan (job card), antrean/jejak pekerjaan, log siklus.
-- Ditulis 2026-10-05. Idempoten (boleh dijalankan ulang).
-- ==========================================================================

-- 1) Karyawan AI (job card)
create table if not exists ai_employees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  role_title text not null,
  department text not null default 'Operations',
  emoji text not null default '🤖',
  mission text not null,
  job_card jsonb not null default '{}'::jsonb,   -- tanggung jawab, standar mutu, batas keputusan
  kpis jsonb not null default '[]'::jsonb,
  autonomy text not null default 'approve',      -- draft | approve | auto
  status text not null default 'active',         -- active | planned | paused
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Pekerjaan & jejak aktivitas karyawan AI
create table if not exists ai_work_items (
  id uuid primary key default gen_random_uuid(),
  employee_slug text not null,
  kind text not null,                              -- briefing | report | alert | reply_draft | task | follow_up
  title text not null,
  summary text,
  status text not null default 'open',             -- open | awaiting_approval | approved | rejected | done | escalated
  priority text not null default 'normal',         -- low | normal | high | urgent
  requires_approval boolean not null default false,
  target_type text,
  target_id uuid,
  payload jsonb not null default '{}'::jsonb,
  run_id uuid,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Log siklus orkestrasi (shift COO)
create table if not exists ai_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null default 'manual',          -- manual | cron | event
  status text not null default 'running',          -- running | ok | error
  summary text,
  items_created integer not null default 0,
  employees jsonb not null default '[]'::jsonb,
  log jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  actor_id uuid
);

create index if not exists ai_work_items_status_idx on ai_work_items (status, created_at desc);
create index if not exists ai_work_items_employee_idx on ai_work_items (employee_slug, created_at desc);
create index if not exists ai_work_items_run_idx on ai_work_items (run_id);
create index if not exists ai_runs_started_idx on ai_runs (started_at desc);

alter table ai_employees enable row level security;
alter table ai_work_items enable row level security;
alter table ai_runs enable row level security;

-- 4) Perluas jenis notifikasi untuk aktivitas workforce
alter table notifications drop constraint if exists notifications_kind_check;
alter table notifications add constraint notifications_kind_check check (kind = any (array[
  'inquiry.new','inquiry.reply',
  'visit.new','visit.confirmed','visit.cancelled','visit.completed',
  'listing.approved','listing.rejected','listing.match',
  'alert.saved','system',
  'interest.new','interest.updated',
  'verification.submitted','verification.approved','verification.rejected','verification.reminder',
  'partnership.updated','partnership.invite',
  'notary.request','notary.recommended',
  'sanction.warning','sanction.suspended','sanction.blocked','sanction.lifted',
  'ai.analysis','ai.message','ai.work',
  'referral.joined','referral.commission','referral.payout'
]));
