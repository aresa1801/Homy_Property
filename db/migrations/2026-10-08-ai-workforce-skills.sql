-- ==========================================================================
-- Homy AI Workforce — Fase 3: Pustaka Skill (Kantor AI)
-- Menyuntikkan paket skill (dari bot Athlas) ke dalam Kantor AI Homy Property
-- agar karyawan AI bekerja dengan standar kelas dunia & makin otonom.
-- Ditulis 2026-10-08. Idempoten (boleh dijalankan ulang).
-- ==========================================================================

-- 1) Pustaka skill (katalog kelas dunia)
create table if not exists ai_skills (
  slug text primary key,
  name text not null,
  category text not null default 'Umum',
  emoji text not null default '✨',
  summary text not null default '',
  body text not null default '',
  source text not null default 'athlas',
  sort_order integer not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_skills_category_idx on ai_skills (category, sort_order);

alter table ai_skills enable row level security;

-- 2) Skill yang dikuasai tiap karyawan AI
alter table ai_employees add column if not exists skills jsonb not null default '[]'::jsonb;

-- 3) Semua karyawan aktif bekerja otonom (Boss: "bisa bekerja autonomous semua").
--    Guardrail uang/aksi keluar tetap berlaku di level prompt & requires_approval.
update ai_employees set autonomy = 'auto', updated_at = now()
 where status = 'active' and autonomy <> 'auto';
