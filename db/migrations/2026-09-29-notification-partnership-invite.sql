-- Homy — izinkan jenis notifikasi 'partnership.invite' (undangan pengguna menjadi Agen Properti).
-- Idempoten: drop & add CHECK.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (kind = ANY (ARRAY[
  'inquiry.new','inquiry.reply','visit.new','visit.confirmed','visit.cancelled','visit.completed',
  'listing.approved','listing.rejected','listing.match','alert.saved','system',
  'interest.new','interest.updated',
  'verification.submitted','verification.approved','verification.rejected','verification.reminder',
  'partnership.updated','partnership.invite',
  'notary.request','notary.recommended',
  'sanction.warning','sanction.suspended','sanction.blocked','sanction.lifted',
  'ai.analysis','ai.message',
  'referral.joined','referral.commission','referral.payout'
]));
