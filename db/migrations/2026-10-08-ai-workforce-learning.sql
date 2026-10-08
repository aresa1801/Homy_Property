-- ==========================================================================
-- Homy AI Workforce — Fase 6: Self-Improvement (Pembelajaran Berkelanjutan)
-- Setiap karyawan AI belajar dari kesalahan (item ditolak Boss, publikasi
-- gagal, konten duplikat) → jadi "pelajaran" yang disuntikkan ke prompt
-- berikutnya, sehingga tidak mengulang kesalahan yang sama dan kinerjanya
-- membaik dari waktu ke waktu.
-- Ditulis 2026-10-08. Idempoten (boleh dijalankan ulang).
-- ==========================================================================

-- 1) Buku pelajaran per karyawan AI
create table if not exists ai_lessons (
  id uuid primary key default gen_random_uuid(),
  employee_slug text,                       -- null = berlaku global (semua karyawan)
  scope text not null default 'global',     -- content / publish / sales / design / coo / global
  title text not null,
  context text not null default '',         -- apa yang terjadi / pemicu
  lesson text not null,                     -- aturan korektif yang wajib dipatuhi
  source text not null default 'auto',      -- reject / publish_fail / duplicate / auto / manual
  severity text not null default 'info',    -- info / warn / critical
  status text not null default 'active',    -- active / retired
  applied_count integer not null default 0, -- berapa kali disuntikkan ke prompt
  source_item_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_lessons_employee_idx on ai_lessons (employee_slug, status, severity);
create index if not exists ai_lessons_scope_idx on ai_lessons (scope, status);
create index if not exists ai_lessons_created_idx on ai_lessons (created_at desc);

alter table ai_lessons enable row level security;

-- 2) Catat kapan terakhir tiap karyawan "belajar" (untuk UI kinerja)
alter table ai_employees add column if not exists last_learned_at timestamptz;
