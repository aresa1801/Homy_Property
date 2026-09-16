'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, Loader2, MapPin, Navigation, Save, Star, Trash2, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapEmbedUrl, mapOpenUrl, parseMapPoint } from '@/lib/homy-maps'

const BUCKET = 'property-media'
const MAX_PHOTOS = 12
const MAX_BYTES = 900 * 1024

type Media = { id: string; storage_path: string; media_type?: string | null; sort_order?: number | null }
type Listing = Record<string, unknown> & { id: string; title?: string; status?: string; media?: Media[] }

const LISTING_TYPES: [string, string][] = [
  ['sale', 'Jual'],
  ['rent', 'Sewa'],
]
const PROPERTY_TYPES: [string, string][] = [
  ['house', 'Rumah'],
  ['apartment', 'Apartemen'],
  ['land', 'Tanah'],
  ['villa', 'Villa'],
  ['shophouse', 'Ruko'],
  ['warehouse', 'Gudang'],
  ['office', 'Kantor'],
  ['room', 'Kamar'],
]

function storageUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  if (!base) return ''
  return `${base}/storage/v1/object/public/${BUCKET}/${path.replace(/^\//, '')}`
}

const num = (value: unknown) => (value == null || value === '' ? '' : String(value))

export default function EditListingPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id ?? '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [amenities, setAmenities] = useState<string[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [mapLink, setMapLink] = useState('')
  const fileInput = useRef<HTMLInputElement | null>(null)

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/listings/${id}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage({ tone: 'err', text: payload?.error ?? 'Gagal memuat listing.' })
        return
      }
      const property = payload.property as Listing
      const next: Record<string, string> = {}
      for (const key of ['title', 'description', 'listing_type', 'property_type', 'price', 'price_period', 'bedrooms', 'bathrooms', 'land_area', 'building_area', 'floors', 'year_built', 'carports', 'electricity_va', 'certificate', 'furnished', 'property_condition', 'water_source', 'city', 'district', 'province', 'postal_code', 'address', 'latitude', 'longitude', 'meeting_point', 'meeting_point_lat', 'meeting_point_lng', 'map_url', 'extra_notes', 'min_lease_months', 'rent_payment_terms', 'occupancy_status', 'deposit_amount', 'service_charge', 'maintenance_fee']) {
        next[key] = num(property[key])
      }
      next.negotiable = property.negotiable ? 'true' : 'false'
      next.utilities_included = property.utilities_included ? 'true' : 'false'
      setForm(next)
      setAmenities(Array.isArray(property.amenities) ? (property.amenities as string[]) : [])
      const list = Array.isArray(property.media) ? property.media.slice() : []
      list.sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      setMedia(list)
      setMapLink(String(property.map_url ?? '') || '')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const meetingPoint = useMemo(() => {
    const lat = Number(form.meeting_point_lat)
    const lng = Number(form.meeting_point_lng)
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng }
    const fromForm = parseMapPoint(`${lat},${lng}`)
    return fromForm
  }, [form.meeting_point_lat, form.meeting_point_lng])

  const embed = mapEmbedUrl(form.meeting_point_lat, form.meeting_point_lng)
  const openLink = mapOpenUrl(form.meeting_point_lat, form.meeting_point_lng)

  function applyMapLink(value: string) {
    setMapLink(value)
    const point = parseMapPoint(value)
    if (!point) return
    setForm((current) => ({
      ...current,
      map_url: value,
      meeting_point_lat: String(point.lat),
      meeting_point_lng: String(point.lng),
      latitude: current.latitude || String(point.lat),
      longitude: current.longitude || String(point.lng),
    }))
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage({ tone: 'err', text: 'Perangkat ini tidak mendukung deteksi lokasi. Tempel link Google Maps saja.' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          meeting_point_lat: position.coords.latitude.toFixed(7),
          meeting_point_lng: position.coords.longitude.toFixed(7),
        }))
        setMessage({ tone: 'ok', text: 'Titik temu diisi dari lokasi Anda saat ini. Jangan lupa simpan.' })
      },
      () => setMessage({ tone: 'err', text: 'Izin lokasi ditolak. Isi manual atau tempel link Google Maps.' }),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const body: Record<string, unknown> = { ...form, amenities, map_url: mapLink || form.map_url || null }
      for (const key of ['negotiable', 'utilities_included']) body[key] = form[key] === 'true'
      const response = await fetch(`/api/listings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage({ tone: 'err', text: payload?.error ?? 'Gagal menyimpan.' })
        return
      }
      setMessage({ tone: 'ok', text: 'Perubahan listing tersimpan. 👍' })
    } catch {
      setMessage({ tone: 'err', text: 'Tidak bisa menghubungi server. Coba lagi.' })
    } finally {
      setSaving(false)
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const remaining = Math.max(MAX_PHOTOS - media.length, 0)
    const chosen = Array.from(files).slice(0, remaining)
    if (!chosen.length) {
      setMessage({ tone: 'err', text: `Maksimal ${MAX_PHOTOS} foto per listing.` })
      return
    }
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      window.location.assign('/auth/login')
      return
    }
    setUploading(true)
    setMessage(null)
    try {
      const registered: { storagePath: string; mediaType: string; sortOrder: number }[] = []
      let skipped = 0
      for (let index = 0; index < chosen.length; index++) {
        const file = chosen[index]
        if (file.size > MAX_BYTES) { skipped++; continue }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        const path = `${userData.user.id}/${id}/${Date.now()}-${index}-${safeName}`
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
        if (error) { skipped++; continue }
        registered.push({ storagePath: path, mediaType: 'image', sortOrder: media.length + index })
      }
      if (!registered.length) {
        setMessage({ tone: 'err', text: 'Tidak ada foto yang berhasil diunggah. Ukuran maksimal 900 KB per foto.' })
        return
      }
      const response = await fetch(`/api/listings/${id}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: registered }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage({ tone: 'err', text: payload?.error ?? 'Foto terunggah tapi gagal didaftarkan.' })
        return
      }
      setMedia((current) => [...current, ...((payload.photos ?? []) as Media[])])
      setMessage({ tone: skipped ? 'err' : 'ok', text: `${registered.length} foto ditambahkan.${skipped ? ` ${skipped} foto dilewati (terlalu besar/gagal).` : ''}` })
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function removePhoto(mediaId: string) {
    setMessage(null)
    const response = await fetch(`/api/listings/${id}/photos?mediaId=${mediaId}`, { method: 'DELETE' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage({ tone: 'err', text: payload?.error ?? 'Gagal menghapus foto.' })
      return
    }
    setMedia((current) => current.filter((item) => item.id !== mediaId))
    setMessage({ tone: 'ok', text: 'Foto dihapus.' })
  }

  async function makeCover(mediaId: string) {
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from('property_media').update({ sort_order: 900 + Math.floor(Math.random() * 90) }).eq('property_id', id)
    await supabase.from('property_media').update({ sort_order: 0 }).eq('id', mediaId)
    setMedia((current) => {
      const target = current.find((item) => item.id === mediaId)
      if (!target) return current
      const rest = current.filter((item) => item.id !== mediaId).map((item, index) => ({ ...item, sort_order: index + 1 }))
      return [{ ...target, sort_order: 0 }, ...rest]
    })
    setMessage({ tone: 'ok', text: 'Foto utama diperbarui.' })
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center gap-3 px-4 py-20 text-[#65706c]">
        <Loader2 className="size-5 animate-spin" /> Memuat listing…
      </div>
    )
  }

  const field = 'h-11 w-full rounded-lg border border-[#e8dfd3] px-3 text-base sm:text-sm'
  const label = 'flex flex-col gap-1 text-xs font-semibold text-[#65706c]'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <Link href="/dashboard/agent/listings" className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b3d2e]">
        <ArrowLeft className="size-4" /> Kembali ke daftar listing
      </Link>
      <h1 className="mt-4 font-serif text-2xl text-[#0b3d2e] sm:text-3xl">Edit listing</h1>
      <p className="mt-1 text-sm text-[#718078]">Perbarui data, tambah foto, dan atur titik temu (peta) properti Anda.</p>

      {message && (
        <p className={`mt-5 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ${message.tone === 'ok' ? 'bg-[#edf2ed] text-[#0b3d2e]' : 'bg-[#fbeeec] text-[#b45c50]'}`}>
          {message.tone === 'err' && <TriangleAlert className="mt-0.5 size-4 shrink-0" />}
          <span>{message.text}</span>
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-6">
        <h2 className="font-serif text-xl text-[#0b3d2e]">Informasi dasar</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>Judul listing<input className={field} value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} /></label>
          <label className={label}>Jenis
            <select className={field} value={form.listing_type ?? 'sale'} onChange={(e) => set('listing_type', e.target.value)}>
              {LISTING_TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
          <label className={label}>Tipe properti
            <select className={field} value={form.property_type ?? 'house'} onChange={(e) => set('property_type', e.target.value)}>
              {PROPERTY_TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
          <label className={label}>Harga (Rp)
            <input className={field} inputMode="numeric" value={form.price ?? ''} onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))} />
          </label>
          <label className={label}>Periode harga
            <select className={field} value={form.price_period ?? ''} onChange={(e) => set('price_period', e.target.value)}>
              <option value="">-</option>
              <option value="total">Total (jual)</option>
              <option value="monthly">Per bulan (sewa)</option>
              <option value="yearly">Per tahun</option>
            </select>
          </label>
          <label className={label}>Kamar tidur<input className={field} inputMode="numeric" value={form.bedrooms ?? ''} onChange={(e) => set('bedrooms', e.target.value.replace(/[^\d]/g, ''))} /></label>
          <label className={label}>Kamar mandi<input className={field} inputMode="numeric" value={form.bathrooms ?? ''} onChange={(e) => set('bathrooms', e.target.value.replace(/[^\d]/g, ''))} /></label>
          <label className={label}>Luas tanah (m²)<input className={field} inputMode="numeric" value={form.land_area ?? ''} onChange={(e) => set('land_area', e.target.value.replace(/[^\d]/g, ''))} /></label>
          <label className={label}>Luas bangunan (m²)<input className={field} inputMode="numeric" value={form.building_area ?? ''} onChange={(e) => set('building_area', e.target.value.replace(/[^\d]/g, ''))} /></label>
          <label className={`${label} sm:col-span-2`}>Deskripsi<textarea className="min-h-28 w-full rounded-lg border border-[#e8dfd3] px-3 py-2 text-base sm:text-sm" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></label>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-6">
        <h2 className="font-serif text-xl text-[#0b3d2e]">Foto properti</h2>
        <p className="mt-1 text-sm text-[#718078]">Maksimal {MAX_PHOTOS} foto, ukuran maksimal 900 KB per foto. Foto pertama jadi foto utama.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {media.map((item, index) => (
            <div key={item.id} className="relative overflow-hidden rounded-xl border border-[#e8dfd3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={storageUrl(item.storage_path)} alt={`Foto ${index + 1}`} className="aspect-square w-full object-cover" />
              {index === 0 && <span className="absolute left-2 top-2 rounded-full bg-[#0b3d2e] px-2 py-0.5 text-[10px] font-semibold text-white">Utama</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/45 p-1.5">
                {index !== 0 && (
                  <button type="button" onClick={() => makeCover(item.id)} className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-[#0b3d2e]">
                    <Star className="size-3" /> Utama
                  </button>
                )}
                <button type="button" onClick={() => removePhoto(item.id)} className="ml-auto inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-[#b45c50]">
                  <Trash2 className="size-3" /> Hapus
                </button>
              </div>
            </div>
          ))}
          {media.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-[#d8ccbb] text-[#65706c] hover:border-[#0b3d2e] disabled:opacity-60"
            >
              {uploading ? <Loader2 className="size-6 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs font-semibold"><ImagePlus className="size-6" /> Tambah foto</span>}
            </button>
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void addPhotos(e.target.files)} />
      </section>

      <section className="mt-5 rounded-2xl border border-[#e5dccd] bg-white p-4 sm:p-6">
        <h2 className="font-serif text-xl text-[#0b3d2e]">Lokasi & titik temu (peta)</h2>
        <p className="mt-1 text-sm text-[#718078]">Tempel link Google Maps lokasi/titik temu (mis. link share “meeting point” yang sudah terdaftar). Koordinat diambil otomatis dari link.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>Link Google Maps
            <input className={field} value={mapLink} onChange={(e) => applyMapLink(e.target.value)} placeholder="https://maps.app.goo.gl/… atau https://www.google.com/maps/@-7.795,110.369,17z" />
          </label>
          <label className={label}>Latitude titik temu<input className={field} value={form.meeting_point_lat ?? ''} onChange={(e) => set('meeting_point_lat', e.target.value)} /></label>
          <label className={label}>Longitude titik temu<input className={field} value={form.meeting_point_lng ?? ''} onChange={(e) => set('meeting_point_lng', e.target.value)} /></label>
          <label className={`${label} sm:col-span-2`}>Catatan titik temu
            <input className={field} value={form.meeting_point ?? ''} onChange={(e) => set('meeting_point', e.target.value)} placeholder="Contoh: gerbang utama perumahan, dekat masjid" />
          </label>
          <label className={label}>Kota<input className={field} value={form.city ?? ''} onChange={(e) => set('city', e.target.value)} /></label>
          <label className={label}>Kecamatan<input className={field} value={form.district ?? ''} onChange={(e) => set('district', e.target.value)} /></label>
          <label className={label}>Provinsi<input className={field} value={form.province ?? ''} onChange={(e) => set('province', e.target.value)} /></label>
          <label className={label}>Kode pos<input className={field} value={form.postal_code ?? ''} onChange={(e) => set('postal_code', e.target.value)} /></label>
          <label className={`${label} sm:col-span-2`}>Alamat detail (internal — tidak ditampilkan di halaman Jual/Sewa)
            <input className={field} value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={useCurrentLocation} className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccbb] px-3 py-2 text-xs font-semibold text-[#33433d]">
            <Navigation className="size-3.5" /> Pakai lokasi saya saat ini
          </button>
          {openLink && (
            <a href={openLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#d8ccbb] px-3 py-2 text-xs font-semibold text-[#33433d]">
              <MapPin className="size-3.5" /> Buka di Google Maps
            </a>
          )}
        </div>
        {embed && (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dfd3]">
            <iframe src={embed} title="Pratinjau titik temu" className="h-64 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        )}
        {!embed && meetingPoint && <p className="mt-2 text-xs text-[#718078]">Koordinat terdeteksi: {meetingPoint.lat}, {meetingPoint.lng}</p>}
      </section>

      <div className="sticky bottom-4 mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[#e5dccd] bg-white/95 p-3 backdrop-blur">
        <p className="text-xs text-[#718078]">{form.status === 'published' ? 'Listing tetap tayang setelah disimpan.' : 'Perubahan akan ditinjau ulang bila listing belum tayang.'}</p>
        <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#0b3d2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#14553f] disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {saving ? 'Menyimpan…' : 'Simpan perubahan'}
        </button>
      </div>
    </div>
  )
}
