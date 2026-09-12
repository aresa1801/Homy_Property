"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

type Language = "id" | "en"

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
  },
  en: {
    sale: "Sale",
    rent: "Rent",
    listProperty: "List Property",
    signIn: "Sign in",
    dashboard: "Dashboard",
    search: "Search properties",
    language: "Language",
    english: "English",
    indonesian: "Bahasa Indonesia",
    user: "User",
    agent: "Agent",
    propertyOwner: "Property Owner",
    overview: "Overview",
    favorites: "Favorites",
    inquiries: "Inquiries & Chats",
    visits: "Visits",
    settings: "Settings",
    becomePartner: "Become an Agent or Owner",
    save: "Save",
    cancel: "Cancel",
    continue: "Continue",
    welcome: "Welcome to Homy",
    chooseRole: "How will you use Homy?",
    regularUser: "Regular user",
    regularUserDescription: "Search, save, and find the right home.",
    propertyAgent: "Property agent",
    propertyAgentDescription: "Manage listings and help clients find a home.",
    owner: "Property owner",
    ownerDescription: "Market your property to buyers and renters.",
    explore: "Explore",
    messages: "Messages",
  },
}

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: (key: string) => string } | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("id")

  useEffect(() => {
    const saved = window.localStorage.getItem("homy-language")
    if (saved === "id" || saved === "en") setLanguageState(saved)
  }, [])

  const setLanguage = (next: Language) => {
    setLanguageState(next)
    window.localStorage.setItem("homy-language", next)
  }

  const value = useMemo(() => ({ language, setLanguage, t: (key: string) => dictionaries[language][key] ?? key }), [language])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider")
  return context
}

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()
  return (
    <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 p-1 text-xs backdrop-blur" aria-label="Language selector">
      <button type="button" onClick={() => setLanguage("id")} aria-pressed={language === "id"} className={`rounded-full px-3 py-1.5 font-medium transition ${language === "id" ? "bg-white text-[#0b3d2e]" : "text-white/80 hover:text-white"}`}>ID</button>
      <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`rounded-full px-3 py-1.5 font-medium transition ${language === "en" ? "bg-white text-[#0b3d2e]" : "text-white/80 hover:text-white"}`}>EN</button>
    </div>
  )
}
