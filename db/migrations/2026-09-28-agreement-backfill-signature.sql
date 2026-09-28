-- Backfill kolom agreement_* di partner_verifications dari partner_agreements.
-- Dibutuhkan untuk mitra yang menandatangani sebelum route menautkan balik ke
-- baris verifikasi (data lama): tanpa ini, langkah "Tinjau & Kirim" menganggap
-- "Perjanjian kerja sama" belum lengkap padahal sudah ditandatangani.
update public.partner_verifications pv
set agreement_id = pa.id,
    agreement_version = coalesce(pv.agreement_version, pa.agreement_version),
    agreement_signed_at = coalesce(pv.agreement_signed_at, pa.signed_at),
    updated_at = now()
from public.partner_agreements pa
where pa.user_id = pv.user_id
  and pa.role = pv.requested_role
  and pa.status = 'active'
  and pv.agreement_id is null;

-- Isi sidik jari SHA-256 yang belum ada (baris lama) akan dihitung ulang oleh
-- GET /api/verify secara deterministik, jadi tidak wajib di-backfill di sini.
