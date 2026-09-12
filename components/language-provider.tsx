"use client"

import { createContext, useContext, useMemo } from "react"

type Language = "id"

type Dictionary = Record<string, string>

const dictionaries: Record<Language, Dictionary> = {
  id: {
    sale: "Jual",
    rent: "Sewa",
    listProperty: "Pasang Properti",
    signIn: "Masuk",
    dashboard: "Dasbor",
    search: "Cari properti",
    language: "Bahasa",
    english: "English",
    indonesian: "Bahasa Indonesia",
    user: "Pengguna",
    agent: "Agen",
    propertyOwner: "Pemilik Properti",
    overview: "Ringkasan",
    favorites: "Favorit",
    inquiries: "Pertanyaan & Pesan",
    visits: "Jadwal Kunjungan",
    settings: "Pengaturan",
    becomePartner: "Daftar sebagai Agen atau Pemilik",
    save: "Simpan",
    cancel: "Batal",
    continue: "Lanjutkan",
    welcome: "Selamat datang di Homy",
    chooseRole: "Bagaimana Anda akan menggunakan Homy?",
    regularUser: "Pengguna biasa",
    regularUserDescription: "Cari, simpan, dan temukan hunian yang tepat.",
    propertyAgent: "Agen properti",
    propertyAgentDescription: "Kelola listing dan bantu klien menemukan rumah.",
    owner: "Pemilik properti",
    ownerDescription: "Pasarkan properti Anda kepada pembeli dan penyewa.",
    explore: "Jelajahi",
    messages: "Pesan",
    aiPropertySearch: "Pencarian properti berbasis AI",
    findPlace: "Temukan tempat untuk disebut rumah.",
    heroDescription: "Temukan properti pilihan yang sesuai dengan cara hidup Anda.",
    tellUs: "Ceritakan hunian yang Anda cari",
    location: "Lokasi",
    propertyType: "Tipe properti",
    budget: "Anggaran",
    anyType: "Semua tipe",
    anyBudget: "Semua anggaran",
    searchNow: "Cari sekarang",
    curatedForYou: "Pilihan khusus untuk Anda",
    propertiesYouLove: "Properti yang mungkin Anda sukai",
    personalizedPicks: "Pilihan personal berdasarkan kebutuhan Anda.",
    exploreByType: "Jelajahi berdasarkan tipe",
    whatLookingFor: "Apa yang sedang Anda cari?",
    viewAll: "Lihat semua",
    planConfidence: "Rencanakan dengan yakin",
    moveClarity: "Ambil keputusan dengan jelas.",
    kprCalculator: "Kalkulator KPR",
    estimateInstallment: "Perkirakan cicilan bulanan Anda",
    nextChapter: "Babak berikutnya dimulai di sini.",
    talkAssistant: "Bicara dengan asisten AI",
    find: "Cari",
    house: "Rumah",
    apartment: "Apartemen",
    land: "Tanah",
    shopHouse: "Ruko",
    villa: "Vila",
    boardingHouse: "Kost",
  },
  id_only: {
    sale: "Jual",
    rent: "Sewa",
    listProperty: "Pasang Properti",
    signIn: "Masuk",
    dashboard: "Dasbor",
    search: "Cari properti",
    language: "Bahasa",
    english: "Bahasa Inggris",
    indonesian: "Bahasa Indonesia",
    user: "Pengguna",
    agent: "Agen",
    propertyOwner: "Pemilik Properti",
    overview: "Ringkasan",
    favorites: "Favorit",
    inquiries: "Pertanyaan & Pesan",
    visits: "Jadwal Kunjungan",
    settings: "Pengaturan",
    becomePartner: "Daftar sebagai Agen atau Pemilik",
    save: "Simpan",
    cancel: "Batal",
    continue: "Lanjutkan",
    welcome: "Selamat datang di Homy",
    chooseRole: "Bagaimana Anda akan menggunakan Homy?",
    regularUser: "Pengguna biasa",
    regularUserDescription: "Cari, simpan, dan temukan hunian yang tepat.",
    propertyAgent: "Agen properti",
    propertyAgentDescription: "Kelola listing dan bantu klien menemukan hunian.",
    owner: "Pemilik properti",
    ownerDescription: "Pasarkan properti Anda kepada pembeli dan penyewa.",
    explore: "Explore",
    messages: "Messages",
    aiPropertySearch: "AI-powered property search",
    findPlace: "Find a place to call home.",
    heroDescription: "Discover exceptional properties, thoughtfully curated for the way you want to live.",
    tellUs: "Tell us what you are looking for",
    location: "Location",
    propertyType: "Property type",
    budget: "Budget",
    anyType: "Any type",
    anyBudget: "Any budget",
    searchNow: "Search now",
    curatedForYou: "Curated for you",
    propertiesYouLove: "Properties you may love",
    personalizedPicks: "Personalized picks based on what you're looking for.",
    exploreByType: "Explore by type",
    whatLookingFor: "What are you looking for?",
    viewAll: "View all",
    planConfidence: "Plan with confidence",
    moveClarity: "Make your move with clarity.",
    kprCalculator: "KPR calculator",
    estimateInstallment: "Perkirakan cicilan bulanan Anda",
    nextChapter: "Babak berikutnya dimulai di sini.",
    talkAssistant: "Bicara dengan asisten AI",
    find: "Find",
    house: "House",
    apartment: "Apartment",
    land: "Land",
    shopHouse: "Shophouse",
    villa: "Villa",
    boardingHouse: "Boarding house",
  },
}

const copy: Record<string, [string, string]> = {
  "Buy": ["Jual", "Sale"], "Buy property": ["Properti untuk dijual", "Properties for sale"], "Find your forever place.": ["Temukan hunian impian Anda.", "Find your forever place."], "Explore homes curated around your lifestyle and goals.": ["Jelajahi hunian pilihan yang sesuai gaya hidup dan tujuan Anda.", "Explore homes curated around your lifestyle and goals."],
  "Rent with confidence": ["Sewa dengan tenang", "Rent with confidence"], "Find a home for": ["Temukan hunian untuk", "Find a home for"], "your next chapter.": ["tahap hidup Anda berikutnya.", "your next chapter."], "Flexible rentals, transparent costs, and homes ready when you are.": ["Sewa fleksibel, biaya transparan, dan hunian siap saat Anda membutuhkannya.", "Flexible rentals, transparent costs, and homes ready when you are."],
  "List your property.": ["Pasang properti Anda.", "List your property."], "For owners and agents": ["Untuk pemilik dan agen", "For owners and agents"], "Tell us about the place. We'll help you present it beautifully.": ["Ceritakan properti Anda. Kami akan membantu menampilkannya dengan menarik.", "Tell us about the place. We'll help you present it beautifully."], "Save draft and exit": ["Simpan draf dan keluar", "Save draft and exit"],
  "Location": ["Lokasi", "Location"], "Property type": ["Tipe properti", "Property type"], "Duration": ["Durasi", "Duration"], "Move-in date": ["Tanggal mulai tinggal", "Move-in date"], "Map view": ["Tampilan peta", "Map view"], "All property types": ["Semua tipe properti", "All property types"], "City, neighborhood": ["Kota, area", "City, neighborhood"], "City or neighborhood": ["Kota atau area", "City or neighborhood"],
  "Welcome back, Raka": ["Selamat datang kembali, Raka", "Welcome back, Raka"], "Operations center": ["Pusat operasional", "Operations center"], "System command center": ["Pusat kendali sistem", "System command center"], "Everything under control.": ["Semua terkendali.", "Everything under control."], "Keep Homy trusted.": ["Jaga kepercayaan di Homy.", "Keep Homy trusted."], "Your home journey.": ["Perjalanan hunian Anda.", "Your home journey."], "Grow your property business.": ["Kembangkan bisnis properti Anda.", "Grow your property business."],
  "Loading your profile...": ["Memuat profil Anda...", "Loading your profile..."], "Almost there": ["Hampir selesai", "Almost there"], "How will you use Homy?": ["Bagaimana Anda akan menggunakan Homy?", "How will you use Homy?"], "Choose your path. You can always apply to become an Agent or Property Owner later.": ["Pilih kebutuhan Anda. Anda selalu dapat mendaftar sebagai Agen atau Pemilik Properti nanti.", "Choose your path. You can always apply to become an Agent or Property Owner later."], "Just exploring": ["Saya hanya menjelajah", "Just exploring"], "Find and save properties.": ["Cari dan simpan properti.", "Find and save properties."], "I am an Agent": ["Saya seorang Agen", "I am an Agent"], "Manage clients and listings.": ["Kelola klien dan listing.", "Manage clients and listings."], "I own Property": ["Saya Pemilik Properti", "I own Property"], "List and manage my property.": ["Pasang dan kelola properti saya.", "List and manage my property."], "Full name": ["Nama lengkap", "Full name"], "Phone number": ["Nomor telepon", "Phone number"], "Company name": ["Nama perusahaan", "Company name"], "Why are you applying?": ["Mengapa Anda mendaftar?", "Why are you applying?"], "Submit application": ["Kirim pendaftaran", "Submit application"], "Sign in with Google": ["Masuk dengan Google", "Sign in with Google"], "Continue with Google": ["Lanjutkan dengan Google", "Continue with Google"],
  "Active listings": ["Listing aktif", "Active listings"], "New leads": ["Prospek baru", "New leads"], "Conversion rate": ["Tingkat konversi", "Conversion rate"], "Monthly revenue": ["Pendapatan bulanan", "Monthly revenue"], "Pending approvals": ["Persetujuan tertunda", "Pending approvals"], "Active users": ["Pengguna aktif", "Active users"], "Open reports": ["Laporan terbuka", "Open reports"], "System uptime": ["Waktu aktif sistem", "System uptime"], "Active admins": ["Admin aktif", "Active admins"], "Feature flags": ["Feature flag", "Feature flags"], "Last backup": ["Cadangan terakhir", "Last backup"], "Healthy": ["Sehat", "Healthy"], "Pending": ["Tertunda", "Pending"], "Review": ["Tinjau", "Review"], "View all": ["Lihat semua", "View all"], "Manage leads": ["Kelola prospek", "Manage leads"], "Full analytics": ["Analitik lengkap", "Full analytics"], "Properties you may love": ["Properti yang mungkin Anda sukai", "Properties you may love"], "What are you looking for?": ["Apa yang sedang Anda cari?", "What are you looking for?"], "Make your move with clarity.": ["Ambil keputusan dengan jelas.", "Make your move with clarity."], "KPR calculator": ["Kalkulator KPR", "KPR calculator"], "Property price": ["Harga properti", "Property price"], "Down payment": ["Uang muka", "Down payment"], "Loan tenor": ["Tenor pinjaman", "Loan tenor"], "Full simulation": ["Simulasi lengkap", "Full simulation"], "Your next chapter starts here.": ["Babak berikutnya dimulai di sini.", "Your next chapter starts here."], "Talk to our AI assistant": ["Bicara dengan asisten AI", "Talk to our AI assistant"], "Privacy": ["Privasi", "Privacy"], "Terms": ["Ketentuan", "Terms"], "Contact": ["Kontak", "Contact"], "Any type": ["Semua tipe", "Any type"], "Any budget": ["Semua anggaran", "Any budget"], "Under Rp 1B": ["Di bawah Rp 1 M", "Under Rp 1B"], "Rp 1B — Rp 3B": ["Rp 1 M — Rp 3 M", "Rp 1B — Rp 3B"], "Above Rp 3B": ["Di atas Rp 3 M", "Above Rp 3B"], "15 years": ["15 tahun", "15 years"], "10 years": ["10 tahun", "10 years"], "20 years": ["20 tahun", "20 years"], "Jual": ["Jual", "Sale"], "Sale": ["Jual", "Sale"], "Buy": ["Jual", "Sale"], "Rent": ["Sewa", "Rent"], "List Property": ["Pasang Properti", "List Property"], "Messages": ["Pesan", "Messages"], "Sign in": ["Masuk", "Sign in"], "Search": ["Cari", "Search"], "Advanced filters": ["Filter lanjutan", "Advanced filters"], "Compare properties": ["Bandingkan properti", "Compare properties"], "View details": ["Lihat detail", "View details"], "Save": ["Simpan", "Save"], "AI recommendation": ["Rekomendasi AI", "AI recommendation"], "Transparent & personalized": ["Transparan & personal", "Transparent & personalized"], "properties found": ["properti ditemukan", "properties found"], "Price range": ["Rentang harga", "Price range"], "Any price": ["Harga berapa pun", "Any price"], "Under Rp 3B": ["Di bawah Rp 3M", "Under Rp 3B"], "All property types": ["Semua tipe properti", "All property types"], "House": ["Rumah", "House"], "Apartment": ["Apartemen", "Apartment"], "Villa": ["Vila", "Villa"], "Fully furnished": ["Furnished", "Fully furnished"], "Semi furnished": ["Semi-furnished", "Semi furnished"], "Monthly": ["Bulanan", "Monthly"], "Yearly": ["Tahunan", "Yearly"], "Step": ["Langkah", "Step"], "of": ["dari", "of"], "Listing type": ["Jenis listing", "Listing type"], "Property details": ["Detail properti", "Property details"], "Pricing": ["Harga", "Pricing"], "Media": ["Media", "Media"], "Preview": ["Pratinjau", "Preview"], "Add new listing": ["Tambah listing", "Add new listing"], "Performance overview": ["Ringkasan performa", "Performance overview"], "Lead pipeline": ["Alur prospek", "Lead pipeline"], "Moderation queue": ["Antrean moderasi", "Moderation queue"], "Reports to resolve": ["Laporan untuk ditangani", "Reports to resolve"], "System activity": ["Aktivitas sistem", "System activity"], "Platform health": ["Kesehatan platform", "Platform health"], "Audit log": ["Log audit", "Audit log"], "Infrastructure": ["Infrastruktur", "Infrastructure"], "Curated for you": ["Pilihan khusus untuk Anda", "Curated for you"], "Personalized picks based on what you're looking for.": ["Pilihan personal berdasarkan kebutuhan Anda.", "Personalized picks based on what you're looking for."], "Explore by type": ["Jelajahi berdasarkan tipe", "Explore by type"], "Plan with confidence": ["Rencanakan dengan yakin", "Plan with confidence"], "Transparent calculations, no hidden fees": ["Perhitungan transparan tanpa biaya tersembunyi", "Transparent calculations, no hidden fees"], "See what your monthly commitment could look like and take the next step with confidence.": ["Lihat perkiraan cicilan bulanan Anda dan ambil langkah berikutnya dengan yakin.", "See what your monthly commitment could look like and take the next step with confidence."], "AI-powered property search": ["Pencarian properti berbasis AI", "AI-powered property search"], "Tell us what you are looking for": ["Ceritakan hunian yang Anda cari", "Tell us what you are looking for"], "Search": ["Cari", "Search"]
}

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: (key: string) => string } | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language: Language = "id"
  const setLanguage = (_next: Language) => undefined

  const value = useMemo(() => ({ language: 'id' as const, setLanguage, t: (key: string) => dictionaries.id[key] ?? key }), [])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider")
  return context
}

