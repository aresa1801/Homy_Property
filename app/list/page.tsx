'use client'

import { SiteHeader } from '@/components/site-header'
import { BrandMark } from '@/components/brand-mark'
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  FileSignature,
  ImagePlus,
  KeyRound,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { MAX_PHOTOS, squareCompressPhoto } from '@/lib/image-utils'

const steps = ['Jenis listing', 'Detail properti', 'Lokasi', 'Fasilitas', 'Harga & sewa', 'Media', 'Pratinjau']

const PROPERTY_TYPES = [
  { value: 'house', label: 'Rumah' },
  { value: 'apartment', label: 'Apartemen' },
  { value: 'villa', label: 'Vila' },
  { value: 'land', label: 'Tanah' },
  { value: 'shopHouse', label: 'Ruko' },
  { value: 'boardingHouse', label: 'Kost' },
  { value: 'office', label: 'Kantor' },
  { value: 'warehouse', label: 'Gudang' },
]

const CERTIFICATES = ['SHM', 'HGB', 'Strata Title', 'AJB', 'PPJB', 'Girik / Lainnya']
const CONDITIONS = [
  { value: 'new', label: 'Baru / Siap huni' },
  { value: 'good', label: 'Baik' },
  { value: 'renovated', label: 'Sudah renovasi' },
  { value: 'needs_renovation', label: 'Perlu renovasi' },
]
const WATER_SOURCES = ['PDAM', 'Sumur bor', 'Sumur gali', 'Air tanah', 'Air pegunungan']
const PAYMENT_TERMS = ['Bulanan', '3 bulanan', '6 bulanan', 'Tahunan', 'Fleksibel']
const OCCUPANCY = [
  { value: 'vacant', label: 'Kosong / siap huni' },
  { value: 'occupied', label: 'Masih terisi' },
]

const AMENITIES = [
  'AC', 'Kolam renang', 'Gym', 'Taman', 'Balkon', 'Dapur set', 'Water heater',
  'Mesin cuci', 'Kulkas', 'WiFi / Internet', 'TV kabel', 'Garasi', 'Parkir mobil',
  'Parkir motor', 'Keamanan 24 jam', 'CCTV', 'Lift', 'Genset', 'Panel surya',
  'Jemuran', 'Pemandangan kota', 'Pemandangan laut', 'Akses difabel', 'Rooftop',
]

const NEARBY = [
  'Sekolah', 'Universitas', 'Mall / pusat belanja', 'Rumah sakit', 'Pasar',
  'Stasiun KRL / MRT', 'Halte bus / TransJakarta', 'Bandara', 'Jalan tol',
  'Taman kota', 'Tempat ibadah', 'Restoran / kafe', 'Pusat bisnis / perkantoran',
]

type PhotoItem = { file: File; url: string; name: string }
type ListingKind = 'sale' | 'rent' | 'both'

const labelCls = 'flex flex-col gap-2 text-sm font-semibold text-[#33433d]'
const inputCls = 'h-12 w-full rounded-lg border border-[#e8dfd3] px-4 font-normal outline-none focus:border-[#0b3d2e]'
const selectCls = 'h-12 w-full rounded-lg border border-[#e8dfd3] px-4 font-normal outline-none focus:border-[#0b3d2e]'

function Fieldset({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#eee5d8] bg-[#fffdfa] p-5 sm:p-6">
      <p className="font-serif text-lg text-[#0b3d2e]">{title}</p>
      {hint && <p className="mt-1 text-xs text-[#65706c]">{hint}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  )
}

export default function ListPage() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Gate: partners must sign the cooperation agreement (PPK) before publishing a listing.
  const [agreementGate, setAgreementGate] = useState<'checking' | 'ok' | 'missing'>('checking')
  const [partnerRole, setPartnerRole] = useState<'agent' | 'property_owner'>('property_owner')

  useEffect(() => {
    let active = true
    const supabase = createClient() as any
    supabase.auth
      .getUser()
      .then(async ({ data }: any) => {
        const user = data?.user
        if (!active) return
        if (!user) {
          window.location.replace('/auth/login?next=/list')
          return
        }
        try {
          const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id)
          const list = Array.isArray(roles) ? roles.map((r: { role: string }) => r.role) : []
          if (list.includes('agent')) setPartnerRole('agent')
          const { data: agreements } = await supabase.from('partner_agreements').select('role').eq('user_id', user.id).eq('status', 'active')
          const signed = Array.isArray(agreements) ? agreements.map((a: { role: string }) => a.role) : []
          if (!active) return
          setAgreementGate(signed.length > 0 ? 'ok' : 'missing')
        } catch {
          if (active) setAgreementGate('missing')
        }
      })
      .catch(() => {
        if (active) setAgreementGate('missing')
      })
    return () => {
      active = false
    }
  }, [])

  // Step 0 — listing kind
  const [listingKind, setListingKind] = useState<ListingKind>('sale')

  // Step 1 — details
  const [title, setTitle] = useState('')
  const [propertyType, setPropertyType] = useState('house')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [buildingArea, setBuildingArea] = useState('')
  const [landArea, setLandArea] = useState('')
  const [floors, setFloors] = useState('')
  const [yearBuilt, setYearBuilt] = useState('')
  const [certificate, setCertificate] = useState('SHM')
  const [propertyCondition, setPropertyCondition] = useState('good')
  const [furnished, setFurnished] = useState<'furnished' | 'semi_furnished' | 'unfurnished'>('unfurnished')
  const [description, setDescription] = useState('')

  // Step 2 — location
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [province, setProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')

  // Step 3 — facilities
  const [amenities, setAmenities] = useState<string[]>([])
  const [nearby, setNearby] = useState<string[]>([])
  const [electricity, setElectricity] = useState('')
  const [waterSource, setWaterSource] = useState('PDAM')
  const [carports, setCarports] = useState('')
  const [extraNotes, setExtraNotes] = useState('')

  // Step 4 — pricing (sale and/or rent)
  const [salePrice, setSalePrice] = useState('')
  const [saleNegotiable, setSaleNegotiable] = useState('Yes')
  const [rentPrice, setRentPrice] = useState('')
  const [minLeaseMonths, setMinLeaseMonths] = useState('')
  const [rentPaymentTerms, setRentPaymentTerms] = useState('Bulanan')
  const [deposit, setDeposit] = useState('')
  const [serviceCharge, setServiceCharge] = useState('')
  const [maintenanceFee, setMaintenanceFee] = useState('')
  const [utilitiesIncluded, setUtilitiesIncluded] = useState(false)
  const [availableFrom, setAvailableFrom] = useState('')
  const [occupancyStatus, setOccupancyStatus] = useState('vacant')

  // Step 5 — media
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)

  const wantsSale = listingKind === 'sale' || listingKind === 'both'
  const wantsRent = listingKind === 'rent' || listingKind === 'both'
  const isLand = propertyType === 'land'
  const isBoarding = propertyType === 'boardingHouse'

  const numeric = (value: string) => {
    const clean = value.replace(/[^0-9.]/g, '')
    if (!clean) return null
    const parsed = Number(clean)
    return Number.isFinite(parsed) ? Math.round(parsed) : null
  }

  const canContinue = useMemo(() => {
    if (step === 1) return title.trim().length > 2
    if (step === 2) return address.trim().length > 2 && city.trim().length > 0
    if (step === 4) {
      const saleOk = !wantsSale || (numeric(salePrice) ?? 0) > 0
      const rentOk = !wantsRent || (numeric(rentPrice) ?? 0) > 0
      return saleOk && rentOk
    }
    return true
  }, [step, title, address, city, wantsSale, wantsRent, salePrice, rentPrice])

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoBusy(true)
    setError(null)
    try {
      const remaining = MAX_PHOTOS - photos.length
      const chosen = Array.from(files).slice(0, Math.max(remaining, 0))
      const next: PhotoItem[] = []
      for (const file of chosen) {
        if (!file.type.startsWith('image/')) continue
        const compressed = await squareCompressPhoto(file)
        next.push({ file: compressed, url: URL.createObjectURL(compressed), name: file.name })
      }
      setPhotos((current) => [...current, ...next].slice(0, MAX_PHOTOS))
    } catch {
      setError('Gagal memproses foto. Pastikan file berupa gambar.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const target = current[index]
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((_, i) => i !== index)
    })
  }

  // Human-readable facts paragraph — this is what the AI assistant reads to answer buyer questions.
  // ===== AI (DeepSeek) =====
  type AiPrice = {
    recommended: number | null
    range_low: number | null
    range_high: number | null
    price_per_m2: number | null
    confidence: string
    rationale: string
    factors: string[]
    tips: string[]
  }
  const [aiPrice, setAiPrice] = useState<AiPrice | null>(null)
  const [aiPriceStats, setAiPriceStats] = useState<{ scope: string; sampleSize: number; median: number | null; avgPerM2: number | null } | null>(null)
  const [aiPriceBusy, setAiPriceBusy] = useState(false)
  const [aiPriceError, setAiPriceError] = useState<string | null>(null)
  const [aiDescBusy, setAiDescBusy] = useState(false)
  const [aiDescError, setAiDescError] = useState<string | null>(null)
  const [aiDescExtra, setAiDescExtra] = useState<{ highlights: string[]; faq: { q: string; a: string }[] } | null>(null)

  const rupiahId = (value?: number | null) => (value == null ? '—' : `Rp ${Number(value).toLocaleString('id-ID')}`)
  const aiType = listingKind === 'rent' ? 'rent' : 'sale'

  async function suggestPrice() {
    setAiPriceBusy(true)
    setAiPriceError(null)
    try {
      const response = await fetch('/api/ai/price-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_type: aiType,
          property_type: propertyType,
          city: city || null,
          district: district || null,
          province: province || null,
          land_area: Number(landArea) || null,
          building_area: Number(buildingArea) || null,
          bedrooms: Number(bedrooms) || null,
          bathrooms: Number(bathrooms) || null,
          furnished,
          property_condition: propertyCondition,
          certificate,
          amenities,
          min_lease_months: Number(minLeaseMonths) || null,
          extra_notes: extraNotes || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'AI gagal menghitung saran harga.')
      setAiPrice(payload.suggestion as AiPrice)
      setAiPriceStats({ scope: payload.scope, sampleSize: payload.sampleSize, median: payload.stats?.median ?? null, avgPerM2: payload.stats?.avgPerM2 ?? null })
    } catch (error) {
      setAiPriceError(error instanceof Error ? error.message : 'Gagal menghubungi AI')
      setAiPrice(null)
      setAiPriceStats(null)
    } finally {
      setAiPriceBusy(false)
    }
  }

  function applyAiPrice() {
    const value = aiPrice?.recommended
    if (!value) return
    const digits = String(Math.round(value))
    if (listingKind !== 'rent') setSalePrice(digits)
    if (listingKind !== 'sale') setRentPrice(digits)
  }

  async function generateDescription() {
    setAiDescBusy(true)
    setAiDescError(null)
    try {
      const response = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          listing_type: aiType,
          property_type: propertyType,
          city: city || null,
          district: district || null,
          province: province || null,
          address: address || null,
          land_area: Number(landArea) || null,
          building_area: Number(buildingArea) || null,
          bedrooms: Number(bedrooms) || null,
          bathrooms: Number(bathrooms) || null,
          furnished,
          property_condition: propertyCondition,
          certificate,
          year_built: Number(yearBuilt) || null,
          floors: Number(floors) || null,
          carports: Number(carports) || null,
          electricity_va: Number(electricity) || null,
          water_source: waterSource || null,
          amenities,
          nearby,
          price: numeric(listingKind === 'rent' ? rentPrice : salePrice),
          price_period: listingKind === 'rent' ? 'month' : 'total',
          negotiable: saleNegotiable === 'Yes',
          min_lease_months: Number(minLeaseMonths) || null,
          rent_payment_terms: rentPaymentTerms || null,
          occupancy_status: occupancyStatus || null,
          utilities_included: utilitiesIncluded,
          available_from: availableFrom || null,
          extra_notes: extraNotes || null,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'AI gagal menulis deskripsi.')
      if (payload.description) setDescription(String(payload.description))
      if (!title && payload.title) setTitle(String(payload.title))
      setAiDescExtra({ highlights: Array.isArray(payload.highlights) ? payload.highlights : [], faq: Array.isArray(payload.faq) ? payload.faq : [] })
    } catch (error) {
      setAiDescError(error instanceof Error ? error.message : 'Gagal menghubungi AI')
    } finally {
      setAiDescBusy(false)
    }
  }

  function buildSummary(kind: 'sale' | 'rent') {
    const typeLabel = PROPERTY_TYPES.find((t) => t.value === propertyType)?.label ?? propertyType
    const bits: string[] = []
    bits.push(`${typeLabel}${isBoarding ? ` dengan ${bedrooms || 0} kamar` : ''}${!isLand && !isBoarding ? ` ${bedrooms || 0} kamar tidur, ${bathrooms || 0} kamar mandi` : ''}`)
    if (buildingArea) bits.push(`luas bangunan ${buildingArea} m²`)
    if (landArea) bits.push(`luas tanah ${landArea} m²`)
    if (floors) bits.push(`${floors} lantai`)
    if (yearBuilt) bits.push(`dibangun sekitar tahun ${yearBuilt}`)
    if (certificate) bits.push(`sertifikat ${certificate}`)
    const condLabel = CONDITIONS.find((c) => c.value === propertyCondition)?.label
    if (condLabel) bits.push(`kondisi ${condLabel.toLowerCase()}`)
    if (!isLand) bits.push(furnished === 'furnished' ? 'fully furnished' : furnished === 'semi_furnished' ? 'semi furnished' : 'unfurnished')
    if (carports) bits.push(`carport ${carports} mobil`)

    const loc = [district, city, province].filter(Boolean).join(', ')
    let text = bits.join(', ') + '.'
    if (loc) text += ` Berlokasi di ${loc}${address ? ` (${address})` : ''}${postalCode ? `, kode pos ${postalCode}` : ''}.`
    if (amenities.length) text += ` Fasilitas: ${amenities.join(', ')}.`
    if (nearby.length) text += ` Dekat dengan: ${nearby.join(', ')}.`
    if (electricity) text += ` Daya listrik ${electricity} VA.`
    if (waterSource) text += ` Sumber air ${waterSource}.`
    if (kind === 'sale') {
      text += ` Dijual dengan harga Rp ${(numeric(salePrice) ?? 0).toLocaleString('id-ID')}${saleNegotiable === 'Yes' ? ' (masih bisa dinegosiasi)' : ''}.`
    } else {
      text += ` Disewakan Rp ${(numeric(rentPrice) ?? 0).toLocaleString('id-ID')} per bulan${minLeaseMonths ? `, minimal sewa ${minLeaseMonths} bulan` : ''}${rentPaymentTerms ? `, pembayaran ${rentPaymentTerms.toLowerCase()}` : ''}.`
      if (deposit) text += ` Deposit Rp ${(numeric(deposit) ?? 0).toLocaleString('id-ID')}.`
      if (serviceCharge) text += ` Biaya layanan Rp ${(numeric(serviceCharge) ?? 0).toLocaleString('id-ID')}.`
      if (maintenanceFee) text += ` Maintenance fee Rp ${(numeric(maintenanceFee) ?? 0).toLocaleString('id-ID')}.`
      text += utilitiesIncluded ? ' Termasuk utilitas (listrik/air).' : ' Utilitas tidak termasuk.'
      if (availableFrom) text += ` Mulai tersedia ${availableFrom}.`
      text += occupancyStatus === 'occupied' ? ' Saat ini masih terisi.' : ' Saat ini kosong dan siap huni.'
    }
    if (extraNotes.trim()) text += ` Catatan tambahan: ${extraNotes.trim()}`
    return text
  }

  function buildFacts(kind: 'sale' | 'rent') {
    return {
      listing_type: kind,
      property_type: propertyType,
      headline: title.trim(),
      summary: buildSummary(kind),
      specs: {
        bedrooms: Number(bedrooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        building_area_m2: numeric(buildingArea),
        land_area_m2: numeric(landArea),
        floors: numeric(floors),
        year_built: numeric(yearBuilt),
        certificate,
        condition: propertyCondition,
        furnished,
        carports: numeric(carports),
        electricity_va: numeric(electricity),
        water_source: waterSource,
      },
      location: {
        address: address.trim() || null,
        district: district.trim() || null,
        city: city.trim(),
        province: province.trim() || null,
        postal_code: postalCode.trim() || null,
      },
      amenities,
      nearby,
      pricing: kind === 'sale'
        ? {
            sale_price: numeric(salePrice),
            negotiable: saleNegotiable === 'Yes',
            ...(listingKind === 'both' ? { also_rent_price_monthly: numeric(rentPrice) } : {}),
          }
        : {
            rent_price_monthly: numeric(rentPrice),
            min_lease_months: numeric(minLeaseMonths),
            rent_payment_terms: rentPaymentTerms,
            deposit: numeric(deposit),
            service_charge: numeric(serviceCharge),
            maintenance_fee: numeric(maintenanceFee),
            utilities_included: utilitiesIncluded,
            available_from: availableFrom || null,
            occupancy_status: occupancyStatus,
            ...(listingKind === 'both' ? { also_sale_price: numeric(salePrice), also_negotiable: saleNegotiable === 'Yes' } : {}),
          },
      notes: extraNotes.trim() || null,
    }
  }

  async function submit() {
    if (agreementGate !== 'ok') {
      window.location.assign(`/agreement?role=${partnerRole}&next=/list`)
      return
    }
    setSubmitting(true)
    setError(null)
    setNotice(null)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      window.location.replace('/auth/login?next=/list')
      return
    }
    const ownerId = userData.user.id

    try {
      const kinds: ('sale' | 'rent')[] = listingKind === 'both' ? ['sale', 'rent'] : [listingKind]

      const createdIds: string[] = []
      for (const kind of kinds) {
        const { data: created, error: insertError } = await supabase
          .from('properties')
          .insert({
            owner_id: ownerId,
            title: title.trim(),
            description: description.trim() || null,
            listing_type: kind,
            status: 'pending',
            property_type: propertyType,
            city: city.trim(),
            district: district.trim() || null,
            province: province.trim() || null,
            postal_code: postalCode.trim() || null,
            address: address.trim() || null,
            price: kind === 'sale' ? numeric(salePrice) ?? 0 : numeric(rentPrice) ?? 0,
            price_period: kind === 'rent' ? 'monthly' : 'total',
            negotiable: kind === 'sale' ? saleNegotiable === 'Yes' : false,
            bedrooms: Number(bedrooms) || 0,
            bathrooms: Number(bathrooms) || 0,
            building_area: numeric(buildingArea),
            land_area: numeric(landArea),
            floors: numeric(floors),
            year_built: numeric(yearBuilt),
            certificate,
            property_condition: propertyCondition,
            furnished,
            carports: numeric(carports),
            electricity_va: numeric(electricity),
            water_source: waterSource,
            amenities,
            nearby,
            utilities_included: kind === 'rent' ? utilitiesIncluded : false,
            deposit_amount: kind === 'rent' ? numeric(deposit) : null,
            service_charge: kind === 'rent' ? numeric(serviceCharge) : null,
            maintenance_fee: kind === 'rent' ? numeric(maintenanceFee) : null,
            min_lease_months: kind === 'rent' ? numeric(minLeaseMonths) : null,
            rent_payment_terms: kind === 'rent' ? rentPaymentTerms : null,
            occupancy_status: kind === 'rent' ? occupancyStatus : null,
            available_from: kind === 'rent' && availableFrom ? availableFrom : null,
            extra_notes: extraNotes.trim() || null,
            ai_summary: buildSummary(kind),
            ai_facts: buildFacts(kind),
          })
          .select('id')
          .single()
        if (insertError || !created) throw insertError ?? new Error('insert failed')
        createdIds.push(created.id)
      }

      // Upload media for every created listing row.
      if (photos.length > 0) {
        for (const propertyId of createdIds) {
          for (let i = 0; i < photos.length; i++) {
            const photo = photos[i]
            const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '-')
            const path = `${ownerId}/${propertyId}/${Date.now()}-${i}-${safeName}`
            const { error: uploadError } = await supabase.storage
              .from('property-media')
              .upload(path, photo.file, { contentType: photo.file.type || 'image/jpeg', upsert: false })
            if (uploadError) continue
            await supabase.from('property_media').insert({
              property_id: propertyId,
              storage_path: path,
              media_type: 'image',
              sort_order: i,
            })
          }
        }
      }

      setNotice(
        listingKind === 'both'
          ? 'Dua listing berhasil dikirim (Jual + Sewa) dan menunggu moderasi admin.'
          : 'Listing berhasil dikirim dan menunggu moderasi admin.',
      )
      setStep(steps.length - 1)
    } catch {
      setError('Gagal menyimpan listing. Silakan coba lagi atau masuk ulang.')
    } finally {
      setSubmitting(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canContinue) return
    if (step === steps.length - 1) {
      void submit()
    } else {
      setStep((current) => Math.min(steps.length - 1, current + 1))
    }
  }

  if (agreementGate === 'checking') {
    return <main className="grid min-h-screen place-items-center bg-[#f7f3ec] text-[#0b3d2e]"><span className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" /> Memeriksa status perjanjian...</span></main>
  }

  if (agreementGate === 'missing') {
    return (
      <main className="min-h-screen bg-[#f7f3ec] px-5 py-16 text-[#1c1c1c]">
        <div className="mx-auto max-w-2xl">
          <BrandMark className="text-[#0b3d2e]" />
          <div className="mt-10 rounded-3xl border border-[#e8dfd3] bg-white p-8 sm:p-10">
            <span className="grid size-14 place-items-center rounded-2xl bg-[#fff7e3] text-[#c09b54]"><FileSignature /></span>
            <h1 className="mt-6 font-serif text-3xl text-[#0b3d2e] sm:text-4xl">Perjanjian kerja sama diperlukan</h1>
            <p className="mt-4 leading-7 text-[#65706c]">
              Sebelum memasang properti, Agen dan Pemilik Properti wajib mendaftar sebagai Mitra Homy, menandatangani
              <strong className="text-[#0b3d2e]"> Surat Perjanjian Kerja Sama</strong>, menyetujui komisi penjualan
              <strong className="text-[#0b3d2e]"> 0,5%</strong> dari harga jual, dan melaporkan setiap transaksi kepada Homy Property.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-[#40584f]">
              <li className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[#4e866d]" /> Isi data Mitra (NIK, kontak, domisili).</li>
              <li className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[#4e866d]" /> Tanda tangani perjanjian secara digital.</li>
              <li className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[#4e866d]" /> Setujui komisi 0,5% dan kewajiban pelaporan transaksi.</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`/agreement?role=${partnerRole}&next=/list`} className="inline-flex items-center gap-2 rounded-full bg-[#0b3d2e] px-6 py-3 text-sm font-semibold text-white hover:bg-[#14553f]">
                <FileSignature className="size-4" /> Buka & tanda tangani perjanjian
              </a>
              <a href="/dashboard/user" className="inline-flex items-center gap-2 rounded-full border border-[#d8ccbb] px-6 py-3 text-sm font-semibold text-[#33433d] hover:border-[#c9a961]">Kembali ke dasbor</a>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f3ec] text-[#1c1c1c]">
      <SiteHeader cta={{ label: 'Simpan draf dan keluar', href: '/' }} />

      <div className="w-full px-5 py-10 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Untuk pemilik dan agen</p>
            <h1 className="mt-2 font-serif text-5xl text-[#0b3d2e]">Pasang properti Anda.</h1>
            <p className="mt-3 text-[#65706c]">Ceritakan properti Anda sedetail mungkin. Data ini akan dipakai AI Homy untuk menjawab pertanyaan calon pembeli & penyewa.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[#edf2ed] px-4 py-2 text-sm text-[#0b3d2e]"><Sparkles className="size-4" /> AI assistance included</div>
        </div>

        <form onSubmit={onSubmit} className="mt-10 grid gap-6 xl:grid-cols-[240px_1fr]">
          <aside className="flex gap-2 overflow-auto xl:flex-col">
            {steps.map((name, i) => (
              <button type="button" key={name} onClick={() => setStep(i)} className={`flex shrink-0 items-center gap-3 rounded-lg p-3 text-left text-sm ${step === i ? 'bg-[#0b3d2e] text-white' : 'text-[#65706c] hover:bg-white'}`}>
                <span className={`grid size-7 place-items-center rounded-full text-xs ${step === i ? 'bg-[#c9a961] text-[#0b3d2e]' : 'bg-[#e2eee7] text-[#0b3d2e]'}`}>{i < step ? <Check /> : i + 1}</span>
                {name}
              </button>
            ))}
          </aside>

          <section className="rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.07)] sm:p-8 xl:p-10">
            <div className="flex items-center justify-between border-b border-[#e8dfd3] pb-6">
              <div>
                <p className="text-sm text-[#65706c]">Step {step + 1} of {steps.length}</p>
                <h2 className="mt-1 font-serif text-3xl text-[#0b3d2e]">{steps[step]}</h2>
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-[#edf2ed] px-4 py-2 text-sm text-[#0b3d2e] lg:flex">
                {listingKind === 'sale' ? <><Tag className="size-4" /> Dijual</> : listingKind === 'rent' ? <><KeyRound className="size-4" /> Disewakan</> : <><Building2 className="size-4" /> Dijual & Disewakan</>}
              </div>
            </div>

            {step === 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {([['sale', 'Jual', 'Jangkau pembeli berkualitas', Tag], ['rent', 'Sewa', 'Temukan penyewa terbaik', KeyRound], ['both', 'Jual & Sewa', 'Tawarkan keduanya sekaligus', Building2]] as const).map(([value, label, hint, Icon]) => (
                  <button type="button" key={value} onClick={() => setListingKind(value)} className={`rounded-xl border-2 p-6 text-left transition ${listingKind === value ? 'border-[#c9a961] bg-[#fbf8f3]' : 'border-[#e8dfd3] hover:border-[#d8ccbb]'}`}>
                    <Icon className="mb-8 text-[#0b3d2e]" />
                    <p className="font-semibold text-[#0b3d2e]">{label}</p>
                    <p className="mt-2 text-sm text-[#65706c]">{hint}</p>
                  </button>
                ))}
                {listingKind === 'both' && (
                  <p className="rounded-xl bg-[#edf2ed] p-4 text-sm text-[#0b3d2e] sm:col-span-3">
                    Sistem akan membuat <strong>2 listing</strong> (satu Jual, satu Sewa) dari data yang sama — Anda cukup mengisi sekali.
                  </p>
                )}
              </div>
            )}

            {step === 1 && (
              <div className="mt-8 space-y-6">
                <Fieldset title="Identitas properti">
                  <label className={`${labelCls} sm:col-span-2 xl:col-span-3`}>Judul listing
                    <input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Contoh: Rumah Tropis Modern 3KT di Kebayoran" />
                  </label>
                  <label className={labelCls}>Tipe properti
                    <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={selectCls}>
                      {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className={labelCls}>Sertifikat
                    <select value={certificate} onChange={(e) => setCertificate(e.target.value)} className={selectCls}>
                      {CERTIFICATES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className={labelCls}>Kondisi properti
                    <select value={propertyCondition} onChange={(e) => setPropertyCondition(e.target.value)} className={selectCls}>
                      {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </label>
                </Fieldset>

                <Fieldset title="Spesifikasi" hint={isLand ? 'Untuk tanah, isi fokus luas tanah & sertifikat.' : 'Isi sesuai kondisi sebenarnya — AI memakai data ini untuk menjawab pertanyaan.'}>
                  {isLand ? (
                    <label className={`${labelCls}`}>Luas tanah (m²)
                      <input type="number" min={0} value={landArea} onChange={(e) => setLandArea(e.target.value)} className={inputCls} placeholder="200" />
                    </label>
                  ) : (
                    <>
                      <label className={labelCls}>{isBoarding ? 'Jumlah kamar kos' : 'Kamar tidur'}
                        <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className={inputCls} placeholder="3" />
                      </label>
                      <label className={labelCls}>Kamar mandi
                        <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className={inputCls} placeholder="2" />
                      </label>
                      <label className={labelCls}>Luas bangunan (m²)
                        <input type="number" min={0} value={buildingArea} onChange={(e) => setBuildingArea(e.target.value)} className={inputCls} placeholder="180" />
                      </label>
                      <label className={labelCls}>Luas tanah (m²)
                        <input type="number" min={0} value={landArea} onChange={(e) => setLandArea(e.target.value)} className={inputCls} placeholder="200" />
                      </label>
                      <label className={labelCls}>Jumlah lantai
                        <input type="number" min={0} value={floors} onChange={(e) => setFloors(e.target.value)} className={inputCls} placeholder="2" />
                      </label>
                      <label className={labelCls}>Kondisi perabot
                        <select value={furnished} onChange={(e) => setFurnished(e.target.value as 'furnished' | 'semi_furnished' | 'unfurnished')} className={selectCls}>
                          <option value="unfurnished">Unfurnished</option>
                          <option value="semi_furnished">Semi furnished</option>
                          <option value="furnished">Fully furnished</option>
                        </select>
                      </label>
                    </>
                  )}
                  <label className={labelCls}>Tahun dibangun
                    <input type="number" min={1900} max={2100} value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} className={inputCls} placeholder="2018" />
                  </label>
                </Fieldset>

                <Fieldset title="Deskripsi & keunggulan">
                  <label className={`${labelCls} sm:col-span-2 xl:col-span-3`}>Deskripsi
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-32 w-full rounded-lg border border-[#e8dfd3] p-4 font-normal outline-none focus:border-[#0b3d2e]" placeholder="Jelaskan keunggulan, keunikan, dan suasana properti ini..." />
                  </label>
                  <div className="sm:col-span-2 xl:col-span-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={generateDescription} disabled={aiDescBusy} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccbb] bg-white px-4 py-2 text-sm font-semibold text-[#0b3d2e] hover:border-[#0b3d2e] disabled:opacity-60">
                        {aiDescBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                        {aiDescBusy ? 'AI sedang menulis…' : 'Tulis deskripsi dengan AI'}
                      </button>
                      <span className="text-xs text-[#65706c]">AI memakai spesifikasi yang sudah Anda isi (tanpa menambah fakta baru).</span>
                    </div>
                    {aiDescError && <p className="mt-2 rounded-lg bg-[#fbeeec] px-3 py-2 text-xs text-[#a3282c]">{aiDescError}</p>}
                    {aiDescExtra && (aiDescExtra.highlights.length > 0 || aiDescExtra.faq.length > 0) && (
                      <div className="mt-3 grid gap-3 rounded-xl bg-[#f7f3ec] p-4 text-sm sm:grid-cols-2">
                        {aiDescExtra.highlights.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Poin unggulan (saran AI)</p>
                            <ul className="mt-2 space-y-1 text-[#33433d]">{aiDescExtra.highlights.map((item) => <li key={item}>• {item}</li>)}</ul>
                          </div>
                        )}
                        {aiDescExtra.faq.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Prediksi pertanyaan calon pembeli</p>
                            <ul className="mt-2 space-y-1 text-[#33433d]">{aiDescExtra.faq.slice(0, 4).map((item) => <li key={item.q}><strong className="font-semibold">{item.q}</strong> — <span className="text-[#65706c]">{item.a}</span></li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Fieldset>
              </div>
            )}

            {step === 2 && (
              <div className="mt-8 space-y-6">
                <Fieldset title="Alamat lengkap">
                  <label className={`${labelCls} sm:col-span-2 xl:col-span-3`}>Alamat lengkap
                    <input required value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Jalan, nomor, RT/RW, kelurahan" />
                  </label>
                  <label className={labelCls}>Kecamatan / area
                    <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls} placeholder="SCBD" />
                  </label>
                  <label className={labelCls}>Kota / Kabupaten
                    <input required value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Jakarta Selatan" />
                  </label>
                  <label className={labelCls}>Provinsi
                    <input value={province} onChange={(e) => setProvince(e.target.value)} className={inputCls} placeholder="DKI Jakarta" />
                  </label>
                  <label className={labelCls}>Kode pos
                    <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputCls} placeholder="12190" />
                  </label>
                </Fieldset>
                <div className="grid min-h-32 place-items-center rounded-xl border-2 border-dashed border-[#c9a961] bg-[#fbf8f3] p-6 text-center">
                  <MapPin className="text-[#c09b54]" />
                  <p className="mt-3 font-semibold text-[#0b3d2e]">Koordinat akan diverifikasi admin</p>
                  <p className="text-sm text-[#65706c]">Titik peta dilengkapi tim Homy saat moderasi listing.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-8 space-y-6">
                <Fieldset title="Fasilitas" hint="Klik semua fasilitas yang tersedia. AI memakai ini untuk menjawab pertanyaan pembeli.">
                  <div className="sm:col-span-2 xl:col-span-3 flex flex-wrap gap-2">
                    {AMENITIES.map((item) => {
                      const active = amenities.includes(item)
                      return (
                        <button type="button" key={item} onClick={() => setAmenities((c) => toggle(c, item))} className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white' : 'border-[#e8dfd3] bg-white text-[#33433d] hover:border-[#c9a961]'}`}>{item}</button>
                      )
                    })}
                  </div>
                  <p className="sm:col-span-2 xl:col-span-3 text-xs text-[#65706c]">{amenities.length} fasilitas dipilih</p>
                </Fieldset>

                <Fieldset title="Lingkungan sekitar" hint="Apa saja yang ada di dekat properti.">
                  <div className="sm:col-span-2 xl:col-span-3 flex flex-wrap gap-2">
                    {NEARBY.map((item) => {
                      const active = nearby.includes(item)
                      return (
                        <button type="button" key={item} onClick={() => setNearby((c) => toggle(c, item))} className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-[#4e866d] bg-[#e2eee7] text-[#0b3d2e]' : 'border-[#e8dfd3] bg-white text-[#33433d] hover:border-[#c9a961]'}`}>{item}</button>
                      )
                    })}
                  </div>
                </Fieldset>

                <Fieldset title="Utilitas">
                  <label className={labelCls}>Daya listrik (VA)
                    <input type="number" min={0} value={electricity} onChange={(e) => setElectricity(e.target.value)} className={inputCls} placeholder="2200" />
                  </label>
                  <label className={labelCls}>Sumber air
                    <select value={waterSource} onChange={(e) => setWaterSource(e.target.value)} className={selectCls}>
                      {WATER_SOURCES.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </label>
                  <label className={labelCls}>Kapasitas carport (mobil)
                    <input type="number" min={0} value={carports} onChange={(e) => setCarports(e.target.value)} className={inputCls} placeholder="1" />
                  </label>
                </Fieldset>

                <Fieldset title="Catatan tambahan">
                  <label className={`${labelCls} sm:col-span-2 xl:col-span-3`}>Info lain yang perlu diketahui calon pembeli/penyewa
                    <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)} className="min-h-24 w-full rounded-lg border border-[#e8dfd3] p-4 font-normal outline-none focus:border-[#0b3d2e]" placeholder="Contoh: bebas banjir, ada jalur jogging, dekat pintu tol, biaya IPL, dsb." />
                  </label>
                </Fieldset>
              </div>
            )}

            {step === 4 && (
              <div className="mt-8 space-y-6">
                {wantsSale && (
                  <Fieldset title="Harga jual" hint="Harga penawaran properti untuk pembelian.">
                    <label className={labelCls}>Harga jual (Rp)
                      <input required inputMode="numeric" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className={inputCls} placeholder="1.500.000.000" />
                    </label>
                    <label className={labelCls}>Bisa dinegosiasi?
                      <select value={saleNegotiable} onChange={(e) => setSaleNegotiable(e.target.value)} className={selectCls}>
                        <option value="Yes">Ya, bisa nego</option>
                        <option value="No">Harga pas</option>
                      </select>
                    </label>
                  </Fieldset>
                )}

                {wantsRent && (
                  <Fieldset title="Sewa" hint="Ketentuan sewa untuk calon penyewa.">
                    <label className={labelCls}>Harga sewa per bulan (Rp)
                      <input required inputMode="numeric" value={rentPrice} onChange={(e) => setRentPrice(e.target.value)} className={inputCls} placeholder="15.000.000" />
                    </label>
                    <label className={labelCls}>Minimal sewa (bulan)
                      <input type="number" min={1} value={minLeaseMonths} onChange={(e) => setMinLeaseMonths(e.target.value)} className={inputCls} placeholder="12" />
                    </label>
                    <label className={labelCls}>Skema pembayaran
                      <select value={rentPaymentTerms} onChange={(e) => setRentPaymentTerms(e.target.value)} className={selectCls}>
                        {PAYMENT_TERMS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </label>
                    <label className={labelCls}>Deposit (Rp)
                      <input inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputCls} placeholder="15.000.000" />
                    </label>
                    <label className={labelCls}>Biaya layanan / IPL (Rp, opsional)
                      <input inputMode="numeric" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} className={inputCls} placeholder="0" />
                    </label>
                    <label className={labelCls}>Maintenance fee (Rp, opsional)
                      <input inputMode="numeric" value={maintenanceFee} onChange={(e) => setMaintenanceFee(e.target.value)} className={inputCls} placeholder="0" />
                    </label>
                    <label className={labelCls}>Tersedia mulai
                      <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={inputCls} />
                    </label>
                    <label className={labelCls}>Status saat ini
                      <select value={occupancyStatus} onChange={(e) => setOccupancyStatus(e.target.value)} className={selectCls}>
                        {OCCUPANCY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-[#e8dfd3] px-4 py-3 text-sm font-normal text-[#33433d]">
                      <input type="checkbox" checked={utilitiesIncluded} onChange={(e) => setUtilitiesIncluded(e.target.checked)} className="size-4" />
                      Termasuk utilitas (listrik & air)
                    </label>
                  </Fieldset>
                )}

                <div className="rounded-xl bg-[#edf2ed] p-5 text-sm text-[#0b3d2e]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Sparkles className="mb-1 size-4" />
                      <strong>Saran Harga AI</strong>
                      <p className="mt-1 text-[#65706c]">Dihitung dari harga rata-rata listing terbit di kecamatan/kota yang sama.</p>
                    </div>
                    <button type="button" onClick={suggestPrice} disabled={aiPriceBusy} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-60">
                      {aiPriceBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {aiPriceBusy ? 'Menghitung…' : 'Hitung saran harga'}
                    </button>
                  </div>
                  {aiPriceError && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-[#a3282c]">{aiPriceError}</p>}
                  {aiPrice && (
                    <div className="mt-4 space-y-3 rounded-xl bg-white p-4">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-xs uppercase tracking-[.14em] text-[#a18a61]">Harga rekomendasi</p>
                          <p className="font-serif text-2xl text-[#0b3d2e]">{rupiahId(aiPrice.recommended)}</p>
                          <p className="text-xs text-[#65706c]">Rentang wajar {rupiahId(aiPrice.range_low)} – {rupiahId(aiPrice.range_high)} · keyakinan {aiPrice.confidence}</p>
                        </div>
                        <button type="button" onClick={applyAiPrice} className="rounded-lg border border-[#0b3d2e] px-3 py-2 text-xs font-semibold text-[#0b3d2e] hover:bg-[#edf2ed]">Pakai harga ini</button>
                      </div>
                      {aiPrice.rationale && <p className="text-[#33433d]">{aiPrice.rationale}</p>}
                      {!!aiPrice.factors?.length && <ul className="space-y-1 text-[#33433d]">{aiPrice.factors.map((item) => <li key={item}>• {item}</li>)}</ul>}
                      {!!aiPrice.tips?.length && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#a18a61]">Saran agar cepat terjual</p>
                          <ul className="mt-1 space-y-1 text-[#33433d]">{aiPrice.tips.map((item) => <li key={item}>• {item}</li>)}</ul>
                        </div>
                      )}
                      {aiPriceStats && <p className="text-xs text-[#8a9a92]">{aiPriceStats.sampleSize} listing pembanding · {aiPriceStats.scope}{aiPriceStats.avgPerM2 ? ` · ${rupiahId(aiPriceStats.avgPerM2)}/m²` : ''} · perkiraan AI, bukan appraisal resmi.</p>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#33433d]">Foto properti</p>
                  <span className="text-xs text-[#65706c]">{photos.length}/{MAX_PHOTOS} foto · maks 500 KB · persegi (1:1)</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {photos.map((photo, index) => (
                    <div key={photo.url} className="group relative overflow-hidden rounded-xl border border-[#e8dfd3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.name} className="aspect-square w-full object-cover" />
                      {index === 0 && <span className="absolute left-2 top-2 rounded-full bg-[#0b3d2e] px-2 py-1 text-[10px] font-semibold text-[#f6e2a8]">Utama</span>}
                      <button type="button" onClick={() => removePhoto(index)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-[#a3282c]" aria-label="Hapus foto"><Trash2 className="size-4" /></button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-[#c9a961] bg-[#fbf8f3] text-center">
                      {photoBusy ? <Loader2 className="animate-spin text-[#c09b54]" /> : <ImagePlus className="text-[#c09b54]" />}
                      <span className="mt-2 px-3 text-xs text-[#65706c]">{photoBusy ? 'Memproses foto...' : 'Tambah foto (otomatis kompres & kotak 1:1)'}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void handleFiles(e.target.files); e.target.value = '' }} />
                    </label>
                  )}
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="mt-8 rounded-xl bg-[#fbf8f3] p-6">
                <h3 className="font-serif text-2xl text-[#0b3d2e]">Siap dikirim?</h3>
                <p className="mt-2 text-[#65706c]">Listing Anda akan ditinjau tim moderasi sebelum tayang. Ringkasan di bawah juga yang dibaca AI Homy.</p>
                <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Jenis</p><p className="font-semibold text-[#0b3d2e]">{listingKind === 'both' ? 'Jual & Sewa' : listingKind === 'sale' ? 'Jual' : 'Sewa'}</p></div>
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Judul</p><p className="font-semibold text-[#0b3d2e]">{title || '—'}</p></div>
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Tipe</p><p className="font-semibold text-[#0b3d2e]">{PROPERTY_TYPES.find((t) => t.value === propertyType)?.label}</p></div>
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Lokasi</p><p className="font-semibold text-[#0b3d2e]">{[district, city, province].filter(Boolean).join(', ') || '—'}</p></div>
                  {wantsSale && <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Harga jual</p><p className="font-semibold text-[#0b3d2e]">{salePrice ? `Rp ${Number(salePrice.replace(/[^0-9]/g, '') || 0).toLocaleString('id-ID')}` : '—'}</p></div>}
                  {wantsRent && <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Sewa / bulan</p><p className="font-semibold text-[#0b3d2e]">{rentPrice ? `Rp ${Number(rentPrice.replace(/[^0-9]/g, '') || 0).toLocaleString('id-ID')}` : '—'}</p></div>}
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Fasilitas</p><p className="font-semibold text-[#0b3d2e]">{amenities.length} item</p></div>
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Foto</p><p className="font-semibold text-[#0b3d2e]">{photos.length} foto</p></div>
                </div>
                <div className="mt-4 rounded-lg border border-[#e8dfd3] bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#c09b54]">Ringkasan yang dibaca AI</p>
                  <p className="mt-2 text-sm leading-6 text-[#40584f]">{buildSummary(wantsRent && !wantsSale ? 'rent' : 'sale')}</p>
                </div>
                {notice && <p role="status" className="mt-6 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]">{notice}</p>}
                {error && <p role="alert" className="mt-6 rounded-xl bg-[#fbe9e7] p-4 text-sm text-[#a3282c]">{error}</p>}
              </div>
            )}

            {notice && step !== 6 && <p role="status" className="mt-6 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]">{notice}</p>}
            {error && step !== 6 && <p role="alert" className="mt-6 rounded-xl bg-[#fbe9e7] p-4 text-sm text-[#a3282c]">{error}</p>}

            <div className="mt-10 flex justify-between border-t border-[#e8dfd3] pt-6">
              <Button type="button" variant="outline" disabled={step === 0 || submitting} onClick={() => setStep(Math.max(0, step - 1))} className="gap-2 border-[#d8ccbb] bg-white px-5 font-semibold text-[#33433d] hover:border-[#c9a961] hover:bg-white hover:text-[#0b3d2e]"><ArrowLeft data-icon="inline-start" /> Back</Button>
              {step === steps.length - 1 ? (
                notice ? (
                  <Button type="button" onClick={() => window.location.assign('/')} className="bg-[#0b3d2e] text-white hover:bg-[#14533f]">Selesai <ArrowRight data-icon="inline-end" /></Button>
                ) : (
                  <Button type="submit" disabled={submitting} className="bg-[#0b3d2e] text-white hover:bg-[#14533f]">{submitting ? 'Menyimpan...' : 'Submit for review'} <ArrowRight data-icon="inline-end" /></Button>
                )
              ) : (
                <Button type="submit" disabled={!canContinue} className="bg-[#0b3d2e] text-white hover:bg-[#14533f]">Continue <ArrowRight data-icon="inline-end" /></Button>
              )}
            </div>
          </section>
        </form>
      </div>
    </main>
  )
}
