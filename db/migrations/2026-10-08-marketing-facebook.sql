-- Homy Property — Agen Marketing (Maya) + kanal Facebook Page
-- Tanggal: 2026-10-08
--
-- 1) Aktifkan kanal "facebook" pada tabel koneksi sosial (Instagram, Threads, Facebook Page).
-- 2) Baris karyawan "marketing" TIDAK dibuat di sini — dibuat otomatis oleh ensureWorkforce()
--    (idempoten, sinkron dengan WORKFORCE_ROSTER di lib/ai-workforce.ts).
-- 3) "marketing_plan" adalah jenis work item baru; kolom ai_work_items.kind tidak diberi CHECK
--    constraint sehingga tidak perlu ALTER.

alter table public.meta_connections drop constraint if exists meta_connections_channel_check;
alter table public.meta_connections add constraint meta_connections_channel_check
  check (channel in ('instagram', 'threads', 'facebook'));
