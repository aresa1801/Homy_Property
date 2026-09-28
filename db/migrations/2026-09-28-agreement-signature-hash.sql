-- Homy — tandatangan digital perjanjian: simpan sidik jari dokumen (SHA-256).
-- Dipakai pada halaman /verify (langkah "Penandatangan Perjanjian Kerja Sama")
-- dan sertifikat PDF. Nilai 64 heksadesimal uppercase, deterministik dari data inti perjanjian.
alter table public.partner_agreements
  add column if not exists signature_hash text;

comment on column public.partner_agreements.signature_hash is
  'Sidik jari dokumen perjanjian (SHA-256, 64 hex uppercase) — bukti keaslian tanda tangan elektronik.';
