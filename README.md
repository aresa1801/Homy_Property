# Homy Property — `homyproperty.id`

Marketplace properti Indonesia untuk **jual & sewa**, dengan **asisten AI**, **verifikasi mitra berlapis**, dan **dasbor multi-peran**. Dibangun di atas Next.js 16 (App Router) + Supabase + Vercel.

> Dokumen ini adalah README resmi repo `Homy_Property` (menggantikan README bawaan v0).

---

## 1. Ringkasan Produk

Homy menghubungkan pembeli/penyewa dengan **jaringan mitra terverifikasi** dalam satu alur:

| Pihak | Kebutuhan | Yang disediakan Homy |
|---|---|---|
| **Pembeli / Penyewa** (`user`) | Menemukan properti yang tepat, cepat | Pencarian berbasis AI, rekomendasi personal, tanya-jawab AI (Homy AI & HOMY CHAT), favorit, simpan pencarian (alert), ajukan kunjungan, notaris/PPAT pendamping |
| **Agen** (`agent`) | Mendapat prospek siap beli | Dasbor prospek (CRM), minat terkonfirmasi + skor AI, jadwal kunjungan, balasan AI, laporan transaksi & **komisi 0,5%**, perjanjian agen↔pemilik, program bonus referral |
| **Mitra institusi** (agensi/broker, institusi korporat, notaris/PPAT) | Menyalurkan inventaris atau layanan legal | Halaman mitra publik, feed listing terpusat, integrasi API/CSV (rencana), profil mitra legal & referensi timbal balik |

Prinsip yang dipegang di seluruh sistem:

1. **Data-driven** — setiap minat/prospek diberi skor dan sinyal AI, bukan sekadar daftar pesan.
2. **Privasi listing** — alamat detail disembunyikan pada tampilan publik (lihat `hideDetailAddress()` di `lib/property-format.ts`).
3. **Satu sumber kebenaran** — semua data di Supabase (Postgres + RLS), bukan mock.
4. **Tanpa kunci rahasia di klien** — `service_role` hanya dipakai di route server.
5. **Dijalankan seperti perusahaan** — operasional harian dijalankan "Kantor AI" (karyawan AI + COO orchestrator) dengan **persetujuan manusia** untuk setiap aksi keluar (§3.7).

---

## 2. Lingkungan Produksi

| Item | Nilai |
|---|---|
| Domain utama | **https://homyproperty.id** |
| Alias deploy | `homy-coral.vercel.app`, `v0-homy-property.vercel.app` |
| Repo | `github.com/aresa1801/Homy_Property` (private, branch `main`) |
| Vercel project | `homy` — `prj_EtZvyt9GUvu1w87nlWaxFrF9pD66` (team `rahadhyan-5960s-projects`) |
| Supabase project | `brdkcmidmeqdmbgtyqym` (`aws-0-ap-northeast-2`, pooler port 5432) |
| Email transaksional | Resend (sender: `support@homyproperty.id`) |
| AI | DeepSeek (`deepseek-chat`, model dapat diubah dari `platform_settings.ai_model`) |

---

## 3. Fitur Utama

### 3.1 Pencarian & Listing
- Beranda dengan pencarian properti berbasis AI + **carousel rekomendasi personal** (`components/recommendation-carousel.tsx`, `GET /api/properties/recommendations`).
- Filter listing: tipe properti, jenis (jual/sewa), provinsi/kota/kecamatan, harga, kamar, luas, sertifikat, perabot, dsb.
- Halaman `/buy`, `/rent`, `/property/[id]`, `/list` (pasang properti), `/listing/[id]/edit`.
- **Media properti** di bucket `property-media` (`/api/listings/[id]/photos`), dengan kompresi & validasi (`lib/image-utils.ts`).
- Halaman programmatic SEO per kota: **`/jual` & `/jual/[kota]`**, **`/sewa` & `/sewa/[kota]`** (lihat §3.10).
- Halaman legal: `/privacy`, `/terms`; SEO: `sitemap.ts`, `robots.ts`, gambar OG dinamis (`/api/og`).

### 3.2 Kecerdasan Buatan (Homy AI)
| Fitur | Endpoint | Catatan |
|---|---|---|
| Asisten tanya-jawab properti (publik & detail) | `POST /api/ai/chat` | Menjawab calon pembeli; percakapan tersimpan di `ai_conversations` |
| Nota percakapan | `/api/ai/conversations` | Dasar agregasi **prospek AI** di CRM mitra |
| Kurasi listing otomatis | `/api/ai/curate` | Ringkasan & kelengkapan listing (`ai_summary`, `ai_facts`) |
| Penulis deskripsi | `/api/ai/describe` | Bantu mitra menulis deskripsi |
| Saran harga | `/api/ai/price-suggest` | Rata-rata listing per kecamatan/kota — flag `price_suggestion` |
| Balasan otomatis prospek | flag `ai_auto_reply` | Draf balasan untuk pertanyaan calon pembeli di dasbor mitra |
| **HOMY CHAT** — asisten bantuan platform | `POST /api/ai/homy-chat` | Membantu pengguna **memakai platform** (alur, langkah, menu dasbor Pengguna/Agen) — berbeda dari Homy AI yang menjawab soal listing/pasar. Logika di `lib/homy-chat.ts`. |

AI dijalankan **di server** memakai `DEEPSEEK_API_KEY` dan hanya diberi data listing yang sudah dibersihkan (lihat `lib/market.ts` → `safeText()` / `hideDetailAddress()`).

### 3.3 Keterlibatan Pembeli
- **Favorit** — `favorites` + `components/favorite-button.tsx`, `GET/POST /api/favorites`, rekap di Dasbor Pengguna.
- **Pertanyaan/prospek** — `inquiries` (+ `source: form | ai`), `POST /api/inquiries`.
- **Minat terkonfirmasi** — `interest_confirmations`: intent, kesiapan, budget, timeline, pembiayaan, prioritas, deal-breaker → **skor + verdict AI** (`ai_verdict`, `ai_confidence`, `ai_signals`).
- **Kunjungan** — `visits` (jadwal, hasil, feedback pembeli) dan follow-up otomatis (`/api/visits/follow-up`).
- **Alert listing & simpan pencarian** — `listing_alerts` + `components/save-search-button.tsx` (cocokkan baris baru lewat `fingerprint`).
- **Notifikasi** — lonceng in-app (`notification-bell.tsx`), email, dan **Web Push** (PWA).

### 3.4 Mitra: Onboarding, Verifikasi, Perjanjian
1. **Lamaran peran** — `/dashboard/user/apply`, `role_applications`.
2. **Formulir verifikasi mitra** — `partner_verifications` (52 kolom: identitas KTP, selfie, NPWP, domisili, rekening bank, kontak darurat, ketersediaan) + dokumen privat di bucket `verification-docs`.
3. **Perjanjian kerja sama digital** — `/agreement` → `partner_agreements` (isi perjanjian, komisi, jenis & nomor identitas, **serial tanda tangan**, `signed_ip`, `signed_user_agent`, versi perjanjian) dan **PDF Perjanjian** (`lib/agreement-pdf.ts`, `GET /api/agreement/pdf`, `POST /api/agreement/draft`).
4. **Halaman verifikasi** — `/verify` (`POST /api/verify`, `/api/verify/agreement`) untuk memeriksa status & keaslian.
5. **Pengingat verifikasi mitra** — in-app + email (`/api/admin/verification-reminders`).
6. **Halaman kemitraan publik `/partnership`** + formulir pengajuan → `partner_leads` (`kind`: `agent` · `agency` · `institution` · `notary` · `contact`); metadata bersama di `lib/partnership.ts` (label, badge, komisi, layanan, volume, kanal kontak).
7. **Sanksi mitra** (`partner_sanctions`) — penegakan & jejak pelanggaran mitra dari sisi admin.

> **Catatan peran:** sejak migrasi `2026-09-28-remove-property-owner-role.sql`, peran `property_owner` **dihapus** — semua data dimigrasikan ke `agent`, komisi tunggal **0,5%**. Peran aktif kini: `user` · `agent` · `admin` · `super_admin`.

### 3.5 Operasional Admin
- **Dasbor multi-peran**: `/dashboard/[role]` + `/dashboard/[role]/[section]` (dinamis, lihat `components/dashboard/*`).
  - `user` — favorit, minat, kunjungan, rekomendasi, lamaran peran.
  - `agent` — prospek & minat, kunjungan, listing ("manage"), laporan transaksi, perjanjian.
  - `admin` — antrean moderasi listing, verifikasi mitra, minat, pengaturan, dan tab **Kantor AI** (workforce, §3.7).
  - `super-admin` — kendali penuh (`/dashboard/super-admin/manage`).
- **Moderasi listing** — `properties.status` + `moderation_note`/`moderated_by`, `moderation_reports` + `components/moderation-queue.tsx` (`/api/admin/listings`).
- **Laporan transaksi & komisi mitra** — `transaction_reports` (harga jual, rate komisi, jumlah komisi, status verifikasi).
- **Feature flags** (`feature_flags`) & **pengaturan platform** (`platform_settings`): `commission_rate` (model komisi tunggal **0,5%**), `listing_auto_publish`, `notification_email_from`, `ai_model`. (`commission_rate_owner` lama tetap disimpan untuk kompatibilitas data).
- **Audit log** — `audit_logs` (aktor, aksi, entitas, metadata).
- **Widget embed** — `GET /api/widgets/properti-baru` untuk menampilkan listing terbaru di situs pihak ketiga.

### 3.6 Platform & PWA
- **PWA** — `app/manifest.webmanifest`, registrasi service worker + sinkronisasi (`lib/pwa-sync.ts`), notifikasi Web Push (`lib/push.ts`, `push_subscriptions`, `components/push-opt-in.tsx`, kunci VAPID).
- **Deep link** — `/open` menyelesaikan tautan `web+homy://` ke path internal.
- **File handler** — `/open-file` memakai Launch Queue API: `Invoice-HOMY-*.pdf` → dasbor penagihan (lapor transaksi), `Perjanjian-*.pdf` → halaman perjanjian.
- **Bagikan** — `/share` untuk tautan properti.
- **Vercel Analytics** (`@vercel/analytics`).

---

### 3.7 Kantor AI — AI Workforce (karyawan AI + COO)

Homy menjalankan operasional hariannya lewat **Kantor AI**: sekumpulan "karyawan" AI berkualitas tinggi yang masing-masing punya **job card** (tanggung jawab, standar, guardrail, jalur eskalasi, KPI) + satu **COO Orchestrator** yang merencanakan kerja harian, membagi tugas, memeriksa hasil, dan **hanya mengangkat hal yang butuh keputusan manusia** (uang, kebijakan, konflik). Inti: `lib/ai-workforce.ts`, `lib/ai-skills.ts`, `lib/ai-admin.ts`; API `/api/admin/workforce` (+ `/coo`, `/cron`); UI tab **Kantor AI** di dasbor admin. Akses hanya **admin/super_admin**.

**Roster karyawan AI:**

| Slug | Nama | Peran | Departemen | Otonomi |
|---|---|---|---|---|
| `coo` | Ayana | Chief Operating Officer (orchestrator) | Kantor Pusat | `auto` |
| `analyst` | Rani | Analyst & Compliance | Kontrol & Kepatuhan | `auto` |
| `sales` | Dita | Sales & Customer Success | Penjualan | `approve` |
| `marketing` | Maya | Marketing & Brand | Pemasaran | `approve` |
| `design` | Vino | Visual & Desain Grafis | Kreatif | `approve` |
| `growth` | Bima | Growth & Lead Generation | Pertumbuhan | `approve` |
| `content` | Sari | Social Media Manager | Pemasaran | `approve` |
| `listing` | Tono | Listing Operations | Operasional Listing | `approve` |

**Model otonomi:** `draft` (sekadar draf) · `approve` (butuh persetujuan manusia sebelum keluar) · `auto` (internal & aman — laporan/alert). Setiap tindakan dicatat ke `audit_logs`. Aset desain dari **Vino** keluar dengan status **disetujui Sari** (Social Media Manager), bukan menunggu Boss.

**Siklus otomatis & penjadwalan:** `/api/admin/workforce/cron` (dilindungi `CRON_SECRET`) menjalankan siklus dengan `scope`: `core` · `content` · `extended` · `design` · `publish` · `learn` · `digest` · `all` (plus `slot: pagi|sore`). Siklus berjalan tiap **3 jam (06:00–24:00 WIB)**; karena akun Vercel **Hobby** membatasi 1×/hari per ekspresi cron, jadwal 3-jam dipecah menjadi beberapa cron harian terpisah di `vercel.json` (mis. `scope=all` @:00, `scope=design` @:15 khusus Vino, `scope=publish` @:30, plus `learn` & `digest`).

**Pembelajaran & KPI:** setiap karyawan menyimpan **pelajaran** (`ai_lessons`) dari koreksi/gagal/duplikat; pelajaran aktif disuntikkan ke prompt saat siklus. Ada juga **target/KPI** (`ai_targets`) dan jejak siklus (`ai_runs`, `ai_work_items`, `ai_skills`, `ai_employees`). Item kerja berstatus `awaiting_approval` disetujui/ditolak via `POST /api/admin/workforce` (`action:'decide'`). Ringkasan harian (digest COO) dikirim ke admin.

### 3.8 Direktori Notaris / PPAT & Pendampingan Legal
- Halaman publik **`/notaris`** + `GET /api/notaries` — direktori mitra legal terverifikasi (**rekomendasi** platform, bukan kewajiban; pengguna bebas memakai notaris pilihannya).
- Pengajuan pendampingan: `POST /api/notary-requests` (`notary_requests`, area `notary_areas`).
- Logika domain di `lib/notary.ts`; mitra legal dikelola lewat alur kemitraan (§3.4) dengan jenis `notary`.

### 3.9 Program Bonus Referral (Agen → Agen)
- Aturan di `lib/referral.ts` (versi ketentuan `2026-09-27`, halaman `/referral/ketentuan`): hanya **agen terverifikasi** yang boleh mereferensikan, dan hanya bila pihak yang diajak juga mendaftar sebagai **agen** (agent→agent).
- Bonus **0,1% dari nilai transaksi**, dibatasi (cap) **Rp 2.000.000** per transaksi; dibayar **setelah** transaksi diverifikasi admin dengan **masa tahan 30 hari** (antisipasi batal/refund), lalu transfer manual.
- **Satu level** (tidak berjenjang). Anti-fraud: tanpa self-referral & tanpa identitas/HP/rekening sama; atribusi hanya via tautan resmi kode di `/r/[code]` (cookie 30 hari).
- Tabel: `referrals`, `referral_participants`, `referral_ledger`, `referral_payouts`, `referral_clicks`, `referral_settings`. API `/api/referrals` + `/api/admin/referrals`.

### 3.10 SEO Programmatic & Halaman Lokasi
- **Satu sumber host kanonik** (`lib/seo.ts`, `SITE_URL`) untuk canonical/OG/sitemap/robots; meta per halaman + **JSON-LD** (breadcrumb/ItemList/FAQ).
- Halaman lokasi otomatis (`lib/location-seo.ts` + dataset **514 kabupaten/kota** di `lib/regions-data.ts`): **`/jual/[kota]`** & **`/sewa/[kota]`** dibangun dari listing `published` (murni server-side, aman-gagal).
- `app/sitemap.ts` + `app/robots.ts` menyeluruh; gambar **OG dinamis** `GET /api/og` (+ `/api/og/content`).
- Wilayah: `lib/regions.ts`, `lib/regions-data.ts`; peta: `lib/homy-maps.ts` + `GET /api/maps/resolve`.

### 3.11 Integrasi Meta (Instagram · Threads · Facebook)
- Koneksi kanal via `GET /api/admin/meta/{connect,callback,status}` (`meta_connections`), memakai **Graph API v21.0** (`lib/meta.ts`).
- **Sari (content)** menerbitkan konten ke Instagram/Threads/Facebook Page dengan alur **persetujuan**; penanganan error/blocked yang ramah (`friendlyMetaError`, `isMetaBlocked`). Hanya admin/super_admin yang menghubungkan akun.

---

## 4. Tumpukan Teknologi

| Lapisan | Teknologi |
|---|---|
| Framework | **Next.js 16.3.3** (App Router, server components, route handlers) |
| UI | **React 19.2.4**, TypeScript 5.7.3, **Tailwind CSS v4**, shadcn (`@base-ui/react`), `lucide-react`, `tw-animate-css`, `class-variance-authority` |
| Data | **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) — Postgres + Auth + Storage + RLS |
| Data fetching klien | **SWR** 2.3.6 |
| Email | **Resend** (`lib/email.ts`) |
| AI | **DeepSeek** (`lib/ai.ts`, `lib/inquiry-ai.ts`, `lib/homy-chat.ts`) |
| Kantor AI (workforce) | **DeepSeek** + tool-calling (`lib/ai-workforce.ts`, `lib/ai-skills.ts`, `lib/ai-admin.ts`) |
| Sosial | **Meta Graph API v21.0** + Threads API (`lib/meta.ts`) |
| Notifikasi push | **web-push** (VAPID) |
| PDF | `lib/pdf-lite.ts` (invoice & perjanjian, tanpa dependensi berat) |
| Hosting | **Vercel** + Vercel Analytics |
| Manajer paket | **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) |

---

## 5. Struktur Repositori

```
.
├── app/                      # Next.js App Router (halaman + route handler)
│   ├── api/                  # Seluruh API (lihat §7)
│   ├── dashboard/[role]/     # Dasbor multi-peran (user | agent | admin | super-admin)
│   ├── property/[id]/        # Detail properti
│   ├── jual/  jual/[kota]/    # SEO lokasi — rumah dijual
│   ├── sewa/  sewa/[kota]/    # SEO lokasi — rumah disewa
│   ├── listing/[id]/edit/    # Edit listing
│   ├── notaris/              # Direktori Notaris/PPAT
│   ├── partnership/          # Halaman & formulir kemitraan
│   ├── referral/ketentuan/   # Ketentuan program referral
│   ├── agreement/            # Perjanjian kerja sama mitra (isi + tanda tangan)
│   ├── verify/               # Verifikasi dokumen/perjanjian
│   ├── ai-assistant/         # Halaman Homy AI
│   ├── r/[code]/             # Pelacak tautan referral (redirect)
│   ├── open/  open-file/     # Deep link & file handler (Launch Queue)
│   ├── page.tsx              # Beranda (pencarian AI + rekomendasi)
│   └── layout.tsx globals.css manifest.webmanifest sitemap.ts robots.ts
├── components/
│   ├── dashboard/            # boards-admin / boards-ai / boards-listing / boards-ops / boards-verify / workforce / owner-agreement
│   ├── ai/                   # ai-chat, curate-panel, visit-scheduler
│   └── *.tsx                 # Shell, header/footer, favorit, inbox pesan, dst.
├── lib/
│   ├── supabase/             # client.ts (browser) · server.ts (SSR) · service.ts (admin) · proxy.ts · types.ts
│   ├── market.ts             # Query listing + statistik pasar (dipakai AI)
│   ├── ai.ts inquiry-ai.ts   # Integrasi DeepSeek · homy-chat.ts (bantuan platform)
│   ├── ai-workforce.ts ai-skills.ts ai-admin.ts   # Kantor AI (karyawan AI + COO)
│   ├── meta.ts               # Publikasi IG/Threads/Facebook
│   ├── notary.ts referral.ts partnership.ts       # Logika domain mitra
│   ├── email.ts push.ts notifications.ts user-emails.ts  # Resend + Web Push + notifikasi
│   ├── seo.ts location-seo.ts regions.ts regions-data.ts  # SEO & wilayah
│   ├── agreement-*.ts owner-agreement*.ts partner-agreement.ts  # Perjanjian & PDF
│   ├── pdf-lite.ts           # Generator PDF ringan
│   ├── verification.ts visits.ts interest.ts    # Logika domain
│   ├── dashboard-client.ts   # Data agregat dasbor
│   └── rate-limit.ts         # Pembatas laju sederhana
├── public/                   # Aset statis
├── proxy.ts                  # Middleware/proxy request (sesi & proteksi rute)
├── next.config.mjs  postcss.config.mjs  tsconfig.json
└── package.json  pnpm-lock.yaml
```

---

## 6. Peta Halaman

| Area | Rute |
|---|---|
| Publik | `/`, `/buy`, `/rent`, `/jual`, `/jual/[kota]`, `/sewa`, `/sewa/[kota]`, `/property/[id]`, `/ai-assistant`, `/partnership`, `/notaris`, `/contact`, `/privacy`, `/terms`, `/share` |
| Referral | `/r/[code]` (tautan kode), `/referral/ketentuan` |
| Akun | `/auth/login`, `/auth/error`, `/onboarding`, `/message` |
| Mitra (agen) | `/list`, `/listing/[id]/edit`, `/agreement`, `/verify` |
| Dasbor | `/dashboard/[role]`, `/dashboard/[role]/[section]`, `/dashboard/user/*`, `/dashboard/agent/*`, `/dashboard/admin/*` (termasuk tab **Kantor AI**), `/dashboard/super-admin/*` |
| PWA / Deep link | `/open`, `/open-file`, `/manifest.webmanifest` |

---

## 7. API (Route Handlers)

**Properti & listing**
`GET /api/properties` · `GET /api/properties/recommendations` · `GET/PATCH /api/listings/[id]` · `POST /api/listings/[id]/photos` · `POST /api/listings/[id]/resubmit` · `GET /api/widgets/properti-baru` · `GET /api/maps/resolve`

**Prospek & minat**
`POST /api/inquiries` · `GET/POST /api/leads` · `GET/POST /api/interest` · `GET/POST /api/visits` · `POST /api/visits/follow-up` · `GET/POST /api/favorites` · `GET/POST /api/alerts` · `GET/POST /api/rentals`

**AI**
`POST /api/ai/chat` · `POST /api/ai/homy-chat` (bantuan platform) · `GET /api/ai/conversations` · `POST /api/ai/curate` · `POST /api/ai/describe` · `POST /api/ai/price-suggest`

**Mitra & verifikasi**
`POST /api/verify` · `POST /api/verify/agreement` · `GET/POST /api/agreement/draft` · `GET /api/agreement/pdf` · `GET/POST /api/agent/owner-agreement` (PDF perjanjian agen↔pemilik) · `GET /api/partner/status`

**Notaris & legal**
`GET /api/notaries` · `GET/POST /api/notary-requests`

**Referral**
`GET /r/[code]` (redirect + log klik) · `GET/POST /api/referrals` · `GET/POST /api/admin/referrals`

**Kantor AI (admin)**
`GET/POST /api/admin/workforce` (roster · antrean · `run` · `seed` · `decide` · `toggle` · `lesson` · `target`) · `GET/POST /api/admin/workforce/coo` · `GET /api/admin/workforce/cron` (terjadwal, `CRON_SECRET`)

**Meta (sosial)**
`GET /api/admin/meta/connect` · `GET /api/admin/meta/callback` · `GET /api/admin/meta/status`

**SEO, OG & peta**
`GET /api/og` · `GET /api/og/content` · `GET /api/og/content/[id]` · `GET /api/maps/resolve`

**Admin & operasi**
`GET/PATCH /api/admin/listings` · `GET /api/admin/ai/*` · `POST /api/admin/ops` · `GET /api/admin/verification-doc` · `GET/POST /api/admin/verification-reminders` · `GET /api/admin/meta/*` · `GET/POST /api/dashboard/[role]` · `POST /api/dashboard/actions`

**Notifikasi & sesi**
`GET/POST /api/notifications` · `POST /api/push` · `POST /api/push/test` · `GET /auth/callback`

---

## 8. Basis Data (±40 tabel, skema `public`)

### Identitas & peran
| Tabel | Kegunaan | Kolom kunci |
|---|---|---|
| `profiles` | Profil pengguna (1:1 dengan `auth.users`) | `id`, `full_name`, `phone`, `avatar_url`, `role` (`user`\|`agent`\|`admin`\|`super_admin`) |
| `user_roles` | Riwayat pemberian peran & status | `user_id`, `role`, `status`, `granted_at` |
| `role_applications` | Lamaran menjadi mitra | `applicant_id`, `requested_role`, `status`, `reviewer_note` |
| `user_emails` | Pemetaan email pengguna (notifikasi & pencarian) | `user_id`, `email` |
| `audit_logs` | Jejak audit aksi | `actor_id`, `action`, `entity_type`, `entity_id`, `metadata` |

### Properti
| Tabel | Kegunaan | Kolom kunci |
|---|---|---|
| `properties` | Listing properti (52 kolom) | `owner_id`, `listing_type`, `status`, `price`, `province/city/district`, `latitude/longitude`, `amenities`, `ai_summary`, `ai_facts`, `moderation_note`, `map_url`, `meeting_point*` |
| `property_media` | Media listing | `property_id`, `storage_path`, `media_type`, `sort_order` |
| `favorites` | Favorit pengguna | `user_id`, `property_id` |
| `reviews` | Ulasan properti | `property_id`, `author_id`, `rating`, `body` |

### Permintaan & prospek
| Tabel | Kegunaan | Kolom kunci |
|---|---|---|
| `inquiries` | Pertanyaan calon pembeli (juga prospek AI) | `property_id`, `user_id`, `agent_id`, `status`, `source` (`form`\|`ai`), `reply_message`, `follow_up_note` |
| `interest_confirmations` | Minat terkonfirmasi + penilaian AI | `intent`, `readiness`, `budget`, `timeline`, `financing`, `score`, `ai_verdict`, `ai_confidence`, `ai_signals` |
| `visits` | Jadwal & hasil kunjungan | `scheduled_at`, `status`, `interest`, `buyer_feedback`, `follow_up_sent_at` |
| `listing_alerts` | Simpan pencarian + alert listing baru | `user_id`, `city`, `min_price`, `max_price`, `keywords`, `fingerprint`, `active` |
| `rental_requests` | Permohonan sewa | `property_id`, `renter_id`, `start_date`, `end_date`, `deposit_amount`, `status` |
| `moderation_reports` | Laporan pelanggaran | `reporter_id`, `property_id`, `reason`, `status`, `resolution_note` |

### Mitra & komersial
| Tabel | Kegunaan | Kolom kunci |
|---|---|---|
| `partner_verifications` | Data verifikasi mitra (52 kolom) | identitas/KTP, selfie, NPWP, domisili, bank, kontak darurat, `availability`, `status`, `reviewer_note` |
| `partner_agreements` | Perjanjian kerja sama digital | `role`, `commission_rate`, `agreement_version`, `signature_name`, `signature_serial`, `signed_ip`, `signed_user_agent`, `status` |
| `partner_leads` | Prospek mitra (form kemitraan & prospek AI) | `kind`, `full_name`, `email`, `company`, `city`, `license_no`, `status`, `source`, `metadata` |
| `partner_availability` | Ketersediaan mitra | `user_id`, jadwal/mode |
| `partner_sanctions` | Sanksi/pelanggaran mitra | `user_id`, `reason`, `status`, `applied_at` |
| `partner_agreements` · `owner_agreements` | Perjanjian kerja sama & perjanjian agen↔pemilik | pihak, `commission_rate`, `agreement_version`, tanda tangan, `status` |
| `transaction_reports` | Laporan transaksi mitra + komisi | `sale_price`, `commission_rate`, `commission_amount`, `status`, `verified_by` |
| `payments` | Tagihan (deposit, sewa, dsb.) | `payer_id`, `property_id`, `rental_request_id`, `amount`, `payment_type`, `status`, `provider_reference` |
| `referrals` · `referral_participants` | Program bonus referral (agent→agent) | kode, `referrer_id`, `referred_id`, `status` |
| `referral_ledger` · `referral_payouts` · `referral_clicks` · `referral_settings` | Buku besar, pencairan, klik, & konfigurasi referral | `referral_id`, `amount`, `status`, `code` |

### Platform
| Tabel | Kegunaan |
|---|---|
| `notifications` | Notifikasi in-app (`kind`, `title`, `body`, `href`, `read_at`) |
| `push_subscriptions` | Langganan Web Push (VAPID: `endpoint`, `p256dh`, `auth`) |
| `feature_flags` | Flag fitur (`price_suggestion`, `ai_auto_reply`, `ai_assistant`, `mobile_app_beta`, `owner_email_notifications`) |
| `platform_settings` | Pengaturan platform (komisi, model AI, kontak dukungan) |
| `moderation_reports` | Laporan pelanggaran konten/listing |

### Kantor AI (workforce)
| Tabel | Kegunaan |
|---|---|
| `ai_employees` | Roster karyawan AI (job card, otonomi, status) |
| `ai_skills` | Keterampilan/kapabilitas karyawan |
| `ai_work_items` | Item kerja per siklus (antrean, status, `awaiting_approval`) |
| `ai_runs` | Jejak siklus/eksekusi |
| `ai_lessons` | Pelajaran hasil self-improvement (aktif → disuntik ke prompt) |
| `ai_targets` | Target/KPI karyawan |
| `ai_conversations` · `ai_chat_messages` | Riwayat tanya-jawab AI & pesan chat |
| `ai_analyses` | Analisis AI tersimpan (harga/pasar/listing) |

### Notaris & legal
| Tabel | Kegunaan |
|---|---|
| `notaries` | Direktori mitra Notaris/PPAT |
| `notary_requests` | Permintaan pendampingan legal |
| `notary_areas` | Wilayah layanan notaris |

### Integrasi Meta
| Tabel | Kegunaan |
|---|---|
| `meta_connections` | Koneksi akun IG/Threads/Facebook (token, status) |

### Storage (bucket Supabase)
| Bucket | Akses | Isi |
|---|---|---|
| `property-media` | publik | Foto/berkas listing properti |
| `verification-docs` | **privat** | Dokumen verifikasi mitra (KTP, selfie, NPWP) |

---

## 9. Alur Utama

**A. Pencari properti → transaksi**
```
Cari (AI/filter) → Lihat detail → Tanya Homy AI atau kirim inquiry
   → Simpan favorit / simpan pencarian (alert)
   → Ajukan kunjungan → (agen) catat hasil & follow-up
   → Minat terkonfirmasi (skor + verdict AI) → negosiasi/transaksi
   → Mitra lapor transaksi (transaction_reports) → komisi dihitung
```
Pertanyaan yang masuk lewat Homy AI tetap tercatat sebagai prospek (`inquiries.source = 'ai'`) sehingga muncul di dasbor mitra.

**B. Pemilik/Agen memasang listing**
```
/list → isi data + unggah media (property-media)
   → kurasi AI (opsional) → ajukan → moderasi admin
   → publish (atau tunggu flag listing_auto_publish) → tampil di pencarian
```

**C. Onboarding mitra**
```
Lamaran peran → Formulir verifikasi + dokumen (verification-docs)
   → Tanda tangan perjanjian digital (/agreement, serial tanda tangan)
   → Review admin → peran aktif → dasbor mitra + CRM prospek
```

**D. PWA & berkas**
```
Pasang PWA → aktifkan notifikasi (VAPID) → terima push (listing/badge)
Buka Invoice-HOMY-*.pdf / Perjanjian-*.pdf via "Buka dengan Homy" → /open-file
```

---

## 10. Peran & Hak Akses

| Peran | Ringkasan akses |
|---|---|
| `user` | Cari, favorit, inquiry, jadwal kunjungan, notifikasi, ajukan kunjungan legal, ajukan peran mitra |
| `agent` | Semua di atas + CRM prospek, minat terkonfirmasi, laporan transaksi, perjanjian agen↔pemilik, program referral |
| `admin` | Moderasi listing, verifikasi mitra, pengaturan, antrean minat, tab **Kantor AI** |
| `super_admin` | Kendali penuh termasuk manajemen peran & pengaturan platform |

> Peran `property_owner` **sudah dihapus** (migrasi `2026-09-28`); seluruh data dimigrasikan ke `agent`. Lihat juga jenis kemitraan `agent` · `agency` · `institution` · `notary` (§3.4).

Penegakan akses: **RLS Supabase** sebagai lapisan dasar + pemeriksaan peran di server (route handler/dasbor). Tulis-menulis ke data sensitif dilakukan lewat route server dengan klien admin, bukan dari komponen klien.

---

## 11. Variabel Lingkungan

Buat `.env.local` (jangan pernah commit). Nilai untuk produksi ada di Vercel → Project `homy` → Settings → Environment Variables.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Kunci publik untuk klien |
| `SUPABASE_URL` | ✅ | URL Supabase untuk server |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` | ✅ | **Rahasia** — hanya untuk route/server, jangan pernah ke browser |
| `RESEND_API_KEY` | ✅ | Email transaksional |
| `HOMY_EMAIL_FROM` | ✅ | Alamat pengirim (mis. `support@homyproperty.id`) |
| `HOMY_APP_URL` | ✅ | Base URL aplikasi (tautan dalam email) |
| `DEEPSEEK_API_KEY` | ✅ | AI (chat, kurasi, deskripsi, saran harga) |
| `DEEPSEEK_MODEL` | — | Default `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | — | Override base URL API AI |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | Kunci publik Web Push |
| `VAPID_PRIVATE_KEY` | ✅ | **Rahasia** — kunci privat Web Push |
| `VAPID_SUBJECT` | ✅ | Kontak pemilik kunci (`mailto:` / URL) |
| `CRON_SECRET` | ✅ | **Rahasia** — mengamankan `/api/admin/workforce/cron` (Vercel Cron) |
| `NEXT_PUBLIC_SITE_URL` | — | Host kanonik untuk SEO/canonical/OG (default `homyproperty.id`) |
| `META_APP_ID` / `META_APP_SECRET` | — | Aplikasi Meta (publikasi IG/Threads/Facebook) |
| `NEXT_PUBLIC_FB_APP_ID` | — | App ID Facebook untuk klien |
| `THREADS_APP_ID` / `THREADS_APP_SECRET` | — | Aplikasi Threads (publikasi konten) |
| `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` | — | Redirect OAuth saat pengembangan lokal |

---

## 12. Menjalankan Secara Lokal

**Prasyarat:** Node.js 20+ (disarankan 22/24), pnpm, akses ke project Supabase.

```bash
git clone https://github.com/aresa1801/Homy_Property.git
cd Homy_Property
pnpm install
# buat berkas .env.local lalu isi variabel pada §11 (berkas ini tidak ikut di-commit)
pnpm dev                            # http://localhost:3000
```

Skrip tersedia:

```bash
pnpm dev        # server pengembangan
pnpm build      # build produksi
pnpm start      # jalankan hasil build
```

Checklist Supabase untuk lingkungan baru:
1. Buat project Supabase, salin URL + anon key + service role key.
2. Buat bucket `property-media` (publik) dan `verification-docs` (**privat**).
3. Terapkan skema tabel (§8) beserta policy RLS-nya.
4. Isi `platform_settings` (komisi, model AI, pengirim email) dan `feature_flags` sesuai kebutuhan.

---

## 13. Deployment

Produksi berjalan di Vercel (project `homy`). Pola deploy yang dipakai:

```bash
cd /path/ke/Homy_Property
VERCEL_TOKEN="$(cat /tmp/token_homy.txt)" vercel deploy --prod --yes --force --project homy
```

Aturan penting:

1. **Penulis commit harus anggota tim Vercel.** Untuk project ini gunakan:
   ```bash
   git config user.name  rahadhyan
   git config user.email rahadhyan@gmail.com
   ```
   Commit dengan penulis di luar tim akan ditolak Vercel (`TEAM_ACCESS_REQUIRED` / `BLOCKED`).
2. **Auto-deploy dari GitHub sedang tidak aktif** (repo tanpa webhook). Selama itu, deploy dilakukan manual via CLI di atas. Untuk mengaktifkan kembali: pasang ulang **Vercel GitHub App** pada repo.
3. Jangan pernah menuliskan token Vercel langsung di command line yang terekam log; baca dari file lalu ekspansi ke variabel lingkungan.
4. Setiap perubahan skema harus disertai penyesuaian tipe di `lib/supabase/types.ts`.

---

## 14. Keamanan

- **RLS aktif** di seluruh tabel; akses anonim dibatasi.
- **Kunci `service_role` hanya di server** (route handler / helper server). Tidak ada konsumsi di komponen klien.
- Dokumen identitas mitra disimpan di bucket **privat** (`verification-docs`); akses via signed URL dari route server.
- Alamat detail properti disamarkan pada respons publik (`hideDetailAddress`).
- Perjanjian menyimpan jejak tanda tangan (`signature_serial`, `signed_ip`, `signed_user_agent`) untuk kebutuhan sengketa.
- `lib/rate-limit.ts` dipakai untuk membatasi endpoint sensitif.
- Laporkan temuan keamanan secara privat (jangan buka issue publik).

---

## 15. Konvensi Kontribusi

- Branch utama: `main`. Fitur besar sebaiknya lewat branch + PR.
- **Pesan commit deskriptif** dengan awalan tipe dan konteks, contoh:
  - `feat(favorit): rekap favorit di dasbor pengguna + endpoint /api/favorites`
  - `fix(verifikasi): gate peran dasbor mitra + pengingat verifikasi`
  - `chore(deploy): rapikan konfigurasi environment`
- Sertakan alasan **kenapa**, bukan hanya **apa**.
- Jangan commit `.env.local`, kunci, atau data pengguna nyata.
- Untuk perubahan skema DB: tulis perubahan + alasannya di deskripsi PR dan perbarui tipe Supabase.

---

## 16. Pemecahan Masalah

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Deploy Vercel `BLOCKED` / `TEAM_ACCESS_REQUIRED` | Penulis commit bukan anggota tim | Set identitas git `rahadhyan <rahadhyan@gmail.com>`, amend author, push ulang |
| Push ditolak | Branch lokal tertinggal dari remote | `git push origin HEAD:main` dengan refspec eksplisit |
| Email tidak terkirim | `RESEND_API_KEY` kosong/domain belum terverifikasi | Isi kunci & verifikasi domain pengirim di Resend |
| AI menjawab error | `DEEPSEEK_API_KEY` kosong / model tidak valid | Cek kunci & `platform_settings.ai_model` |
| Notifikasi push tidak muncul | Kunci VAPID belum cocok atau langganan kedaluwarsa | Periksa 3 variabel VAPID & baris `push_subscriptions` |
| Gambar listing gagal upload | Bucket/tipe berkas/ukuran tidak sesuai | Cek bucket `property-media` & validasi `lib/image-utils.ts` |

---

## 17. Kontak

- Produk: **Homy Property** — https://homyproperty.id
- Dukungan mitra: `support@homyproperty.id`
- Pemilik: **Aditya Rahadhyan** (CarbonFi Labs)

> README ini adalah dokumentasi hidup — perbarui setiap kali ada fitur, tabel, endpoint, atau variabel lingkungan baru.
