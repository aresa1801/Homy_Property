'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSignature,
  Home,
  ImagePlus,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { MAX_PHOTOS, squareCompressPhoto } from '@/lib/image-utils'

const steps = ['Jenis listing', 'Detail properti', 'Lokasi', 'Harga', 'Media', 'Pratinjau']

const PROPERTY_TYPES = [
  { value: 'house', label: 'Rumah' },
  { value: 'apartment', label: 'Apartemen' },
  { value: 'villa', label: 'Vila' },
  { value: 'land', label: 'Tanah' },
  { value: 'shopHouse', label: 'Ruko' },
  { value: 'boardingHouse', label: 'Kost' },
]

type PhotoItem = { file: File; url: string; name: string }

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
  const [listingKind, setListingKind] = useState<'sale' | 'rent' | 'both'>('sale')

  // Step 1 — details
  const [title, setTitle] = useState('')
  const [propertyType, setPropertyType] = useState('house')
  const [bedrooms, setBedrooms] = useState('')
  const [bathrooms, setBathrooms] = useState('')
  const [buildingArea, setBuildingArea] = useState('')
  const [landArea, setLandArea] = useState('')
  const [furnished, setFurnished] = useState<'furnished' | 'semi_furnished' | 'unfurnished'>('unfurnished')
  const [description, setDescription] = useState('')

  // Step 2 — location
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')

  // Step 3 — price
  const [price, setPrice] = useState('')
  const [negotiable, setNegotiable] = useState('Yes')
  const [deposit, setDeposit] = useState('')
  const [serviceCharge, setServiceCharge] = useState('')

  // Step 4 — media
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)

  const pricePeriod = listingKind === 'rent' ? 'monthly' : 'total'

  const numeric = (value: string) => {
    const clean = value.replace(/[^0-9.]/g, '')
    if (!clean) return null
    const parsed = Number(clean)
    return Number.isFinite(parsed) ? Math.round(parsed) : null
  }

  const canContinue = useMemo(() => {
    if (step === 1) return title.trim().length > 2 && city.trim().length > 0
    if (step === 2) return address.trim().length > 2 && city.trim().length > 0
    if (step === 3) return numeric(price) !== null && numeric(price)! > 0
    return true
  }, [step, title, city, address, price])

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
      const payloads = listingKind === 'both'
        ? ['sale', 'rent']
        : [listingKind]

      const createdIds: string[] = []
      for (const kind of payloads) {
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
            address: address.trim() || null,
            price: numeric(price) ?? 0,
            price_period: kind === 'rent' ? 'monthly' : 'total',
            bedrooms: Number(bedrooms) || 0,
            bathrooms: Number(bathrooms) || 0,
            building_area: numeric(buildingArea),
            land_area: numeric(landArea),
            furnished,
            utilities_included: false,
            deposit_amount: numeric(deposit),
            service_charge: numeric(serviceCharge),
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

      setNotice('Listing berhasil dikirim dan menunggu moderasi admin.')
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
          <a href="/" className="flex items-center gap-3 text-[#0b3d2e]"><span className="grid size-10 place-items-center rounded-xl bg-[#0b3d2e] text-[#c9a961]"><Home /></span><span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span></a>
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
      <header className="border-b border-[#e8dfd3] bg-[#0b3d2e] text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Home /></span>
            <span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span>
          </a>
          <a href="/" className="text-sm text-white/70 hover:text-white">Simpan draf dan keluar</a>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Untuk pemilik dan agen</p>
        <h1 className="mt-2 font-serif text-5xl text-[#0b3d2e]">Pasang properti Anda.</h1>
        <p className="mt-3 text-[#65706c]">Ceritakan properti Anda. Kami akan membantu menampilkannya dengan menarik.</p>

        <form onSubmit={onSubmit} className="mt-10 grid gap-8 lg:grid-cols-[190px_1fr]">
          <aside className="flex gap-2 overflow-auto lg:flex-col">
            {steps.map((name, i) => (
              <button type="button" key={name} onClick={() => setStep(i)} className={`flex shrink-0 items-center gap-3 rounded-lg p-3 text-left text-sm ${step === i ? 'bg-[#0b3d2e] text-white' : 'text-[#65706c] hover:bg-white'}`}>
                <span className={`grid size-7 place-items-center rounded-full text-xs ${step === i ? 'bg-[#c9a961] text-[#0b3d2e]' : 'bg-[#e2eee7] text-[#0b3d2e]'}`}>{i < step ? <Check /> : i + 1}</span>
                {name}
              </button>
            ))}
          </aside>

          <section className="rounded-2xl bg-white p-6 shadow-[0_10px_35px_rgba(20,42,32,.07)] sm:p-10">
            <div className="flex items-center justify-between border-b border-[#e8dfd3] pb-6">
              <div>
                <p className="text-sm text-[#65706c]">Step {step + 1} of {steps.length}</p>
                <h2 className="mt-1 font-serif text-3xl text-[#0b3d2e]">{steps[step]}</h2>
              </div>
              <div className="hidden items-center gap-2 rounded-full bg-[#edf2ed] px-4 py-2 text-sm text-[#0b3d2e] sm:flex"><Sparkles /> AI assistance included</div>
            </div>

            {step === 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {([['sale', 'Jual'], ['rent', 'Sewa'], ['both', 'Jual & Sewa']] as const).map(([value, label]) => (
                  <button type="button" key={value} onClick={() => setListingKind(value)} className={`rounded-xl border-2 p-6 text-left transition ${listingKind === value ? 'border-[#c9a961] bg-[#fbf8f3]' : 'border-[#e8dfd3]'}`}>
                    <Home className="mb-8 text-[#0b3d2e]" />
                    <p className="font-semibold text-[#0b3d2e]">{label}</p>
                    <p className="mt-2 text-sm text-[#65706c]">{value === 'rent' ? 'Temukan penyewa terbaik' : value === 'sale' ? 'Jangkau pembeli berkualitas' : 'Tawarkan keduanya sekaligus'}</p>
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d] sm:col-span-2">Judul listing
                  <input required value={title} onChange={(e) => setTitle(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="Judul yang membuat properti Anda menonjol" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Tipe properti
                  <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal">
                    {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Kondisi perabot
                  <select value={furnished} onChange={(e) => setFurnished(e.target.value as 'furnished' | 'semi_furnished' | 'unfurnished')} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal">
                    <option value="unfurnished">Unfurnished</option>
                    <option value="semi_furnished">Semi furnished</option>
                    <option value="furnished">Fully furnished</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Kamar tidur
                  <input type="number" min={0} value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="3" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Kamar mandi
                  <input type="number" min={0} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="2" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Luas bangunan (m²)
                  <input type="number" min={0} value={buildingArea} onChange={(e) => setBuildingArea(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="180" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Luas tanah (m²)
                  <input type="number" min={0} value={landArea} onChange={(e) => setLandArea(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="200" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d] sm:col-span-2">Deskripsi
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-32 rounded-lg border border-[#e8dfd3] p-4 font-normal" placeholder="Jelaskan keunggulan properti ini..." />
                </label>
              </div>
            )}

            {step === 2 && (
              <div className="mt-8 grid gap-5">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Alamat lengkap
                  <input required value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="Jalan, lingkungan, kota" />
                </label>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Kota
                    <input required value={city} onChange={(e) => setCity(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="Jakarta Selatan" />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Kecamatan / area
                    <input value={district} onChange={(e) => setDistrict(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="SCBD" />
                  </label>
                </div>
                <div className="grid min-h-40 place-items-center rounded-xl border-2 border-dashed border-[#c9a961] bg-[#fbf8f3] p-6 text-center">
                  <MapPin className="text-[#c09b54]" />
                  <p className="mt-3 font-semibold text-[#0b3d2e]">Lokasi akan diverifikasi admin</p>
                  <p className="text-sm text-[#65706c]">Koordinat akan dilengkapi tim kami saat moderasi.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">{listingKind === 'rent' ? 'Sewa per bulan (Rp)' : 'Harga penawaran (Rp)'}
                  <input required inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="1.500.000.000" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Bisa dinegosiasi?
                  <select value={negotiable} onChange={(e) => setNegotiable(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal">
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Deposit (Rp, opsional)
                  <input inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="0" />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-[#33433d]">Biaya layanan (Rp, opsional)
                  <input inputMode="numeric" value={serviceCharge} onChange={(e) => setServiceCharge(e.target.value)} className="h-12 rounded-lg border border-[#e8dfd3] px-4 font-normal" placeholder="0" />
                </label>
                <div className="rounded-xl bg-[#edf2ed] p-5 text-sm text-[#0b3d2e] sm:col-span-2">
                  <Sparkles className="mb-2" />
                  <strong>Saran Harga AI</strong>
                  <p className="mt-1 text-[#65706c]">Lengkapi lokasi dan spesifikasi untuk melihat estimasi kisaran pasar.</p>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#33433d]">Foto properti</p>
                  <span className="text-xs text-[#65706c]">{photos.length}/{MAX_PHOTOS} foto · maks 500 KB · persegi (1:1)</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
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

            {step === 5 && (
              <div className="mt-8 rounded-xl bg-[#fbf8f3] p-6">
                <h3 className="font-serif text-2xl text-[#0b3d2e]">Siap dikirim?</h3>
                <p className="mt-2 text-[#65706c]">Listing Anda akan ditinjau tim moderasi sebelum tayang.</p>
                <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Judul</p><p className="font-semibold text-[#0b3d2e]">{title || '—'}</p></div>
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Lokasi</p><p className="font-semibold text-[#0b3d2e]">{[district, city].filter(Boolean).join(', ') || '—'}</p></div>
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Harga</p><p className="font-semibold text-[#0b3d2e]">{price ? `Rp ${Number(price.replace(/[^0-9]/g, '') || 0).toLocaleString('id-ID')}` : '—'}</p></div>
                  <div className="rounded-lg bg-white p-4"><p className="text-[#65706c]">Foto</p><p className="font-semibold text-[#0b3d2e]">{photos.length} foto</p></div>
                </div>
                {notice && <p role="status" className="mt-6 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]">{notice}</p>}
                {error && <p role="alert" className="mt-6 rounded-xl bg-[#fbe9e7] p-4 text-sm text-[#a3282c]">{error}</p>}
              </div>
            )}

            {notice && step !== 5 && <p role="status" className="mt-6 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]">{notice}</p>}
            {error && step !== 5 && <p role="alert" className="mt-6 rounded-xl bg-[#fbe9e7] p-4 text-sm text-[#a3282c]">{error}</p>}

            <div className="mt-10 flex justify-between border-t border-[#e8dfd3] pt-6">
              <Button type="button" variant="outline" disabled={step === 0 || submitting} onClick={() => setStep(Math.max(0, step - 1))}><ArrowLeft data-icon="inline-start" /> Back</Button>
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
