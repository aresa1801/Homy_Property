'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { ArrowRight, Briefcase, Check, Home, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/dashboard-shell'
import { ROLE_META, type AppRole } from '@/lib/homy-session'

type Role = 'user' | 'agent' | 'property_owner'

const ROLE_OPTIONS: { value: Role; title: string; description: string; icon: typeof UserRound }[] = [
  { value: 'user', title: 'Menjelajah properti', description: 'Cari dan simpan properti.', icon: UserRound },
  { value: 'agent', title: 'Saya Agen Properti', description: 'Kelola klien dan listing.', icon: Briefcase },
  { value: 'property_owner', title: 'Saya Pemilik Properti', description: 'Pasang dan kelola properti saya.', icon: Home },
]

const PRIORITY: Role[] = ['agent', 'property_owner', 'user']

export default function OnboardingPage() {
  const [selected, setSelected] = useState<Role[]>(['user'])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient() as any
    supabase.auth.getUser().then(({ data }: any) => {
      const user = data?.user
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
      const requestedRole = new URLSearchParams(window.location.search).get('role')
      if (requestedRole === 'agent' || requestedRole === 'property_owner') {
        setSelected((current) => (current.includes(requestedRole as Role) ? current : [...current, requestedRole as Role]))
      }
      setEmail(user?.email ?? '')
      setName(String(meta.full_name ?? meta.name ?? user?.email?.split('@')[0] ?? ''))
      setAvatarUrl(String(meta.avatar_url ?? meta.picture ?? ''))
      setLoading(false)
    })
  }, [])

  const needsApplication = selected.some((role) => role !== 'user')
  const roleLabel = useMemo(() => selected.map((role) => ROLE_META[role as AppRole].label).join(' + '), [selected])

  function toggle(role: Role) {
    setSelected((current) => {
      if (current.includes(role)) {
        if (current.length === 1) return current // keep at least one role
        return current.filter((item) => item !== role)
      }
      return [...current, role]
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected.length) return
    setSubmitting(true)
    setMessage(null)

    const supabase = createClient() as any
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      window.location.replace('/auth/login')
      return
    }
    const user = userData.user
    const requestedRole = new URLSearchParams(window.location.search).get('role')
    const primary: Role = PRIORITY.find((role) => selected.includes(role)) ?? 'user'
    const destination = ROLE_META[primary as AppRole].dashboard

    try {
      await supabase
        .from('profiles')
        .update({ full_name: name, phone, avatar_url: avatarUrl || null, role: primary })
        .eq('id', user.id)

      // Grant every selected role so one account can hold user + agent + property_owner.
      await supabase
        .from('user_roles')
        .upsert(selected.map((role) => ({ user_id: user.id, role, status: 'active' })), { onConflict: 'user_id,role' })

      // Record applications for the professional roles (auto-approved for instant access).
      for (const role of selected) {
        if (role === 'user') continue
        await supabase.from('role_applications').insert({
          applicant_id: user.id,
          requested_role: role,
          full_name: name,
          phone,
          company_name: company || null,
          reason: reason || null,
          status: 'approved',
        })
      }
    } catch (error) {
      setMessage('Pengajuan tersimpan sebagian. Silakan coba lagi.')
    } finally {
      window.location.replace(destination)
    }
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f7f3ec] text-[#0b3d2e]">Memuat profil Anda...</main>

  return (
    <main className="min-h-screen bg-[#f7f3ec] px-5 py-10 text-[#1c1c1c] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <BrandMark className="text-[#0b3d2e]" />
        <div className="mt-12 flex items-center gap-3 rounded-2xl border border-[#e8dfd3] bg-white p-4">
          <UserAvatar name={name} email={email} avatarUrl={avatarUrl} size={48} />
          <div className="min-w-0"><p className="truncate font-semibold text-[#0b3d2e]">{name || 'Akun Google Anda'}</p><p className="truncate text-sm text-[#65706c]">{email || 'Belum masuk'}</p></div>
        </div>
        <div className="mt-10 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Hampir selesai</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight text-[#0b3d2e] sm:text-6xl">Bagaimana Anda akan menggunakan Homy?</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#65706c]">Pilih satu atau beberapa peran sekaligus. Anda bisa menjadi Agen dan Pemilik Properti dalam satu akun — setiap dasbor memakai foto, nama, dan email Google Anda.</p>
        </div>
        <form onSubmit={submit} className="mt-12">
          <div className="grid gap-4 md:grid-cols-3">
            {ROLE_OPTIONS.map(({ value, title, description, icon: Icon }) => {
              const active = selected.includes(value)
              return (
                <button type="button" key={value} onClick={() => toggle(value)} aria-pressed={active} className={`rounded-2xl border p-5 text-left transition ${active ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white shadow-xl' : 'border-[#e8dfd3] bg-white hover:border-[#c9a961]'}`}>
                  <span className={`grid size-11 place-items-center rounded-xl ${active ? 'bg-[#c9a961] text-[#0b3d2e]' : 'bg-[#edf2ed] text-[#0b3d2e]'}`}><Icon /></span>
                  <span className="mt-5 block font-serif text-xl">{title}</span>
                  <span className={`mt-2 block text-sm leading-6 ${active ? 'text-white/70' : 'text-[#65706c]'}`}>{description}</span>
                  {active && <Check className="mt-5 text-[#c9a961]" />}
                </button>
              )
            })}
          </div>
          {needsApplication && (
            <div className="mt-8 grid gap-5 rounded-2xl border border-[#e8dfd3] bg-white p-6 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#33433d]">Full name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" /></label>
              <label className="text-sm font-semibold text-[#33433d]">Phone number<input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" /></label>
              <label className="text-sm font-semibold text-[#33433d] sm:col-span-2">Company or agency <span className="font-normal text-[#65706c]">(optional)</span><input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" /></label>
              <label className="text-sm font-semibold text-[#33433d] sm:col-span-2">Tell us a little more <span className="font-normal text-[#65706c]">(optional)</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-[#ddd3c5] p-4 font-normal outline-none focus:border-[#0b3d2e]" /></label>
            </div>
          )}
          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-[#e8dfd3] pt-6 sm:flex-row sm:items-center">
            <p className="text-sm text-[#65706c]">Peran terpilih: <strong className="text-[#0b3d2e]">{roleLabel}</strong>. Anda dapat menambah atau mengganti peran kapan saja.</p>
            <Button type="submit" disabled={submitting || !selected.length} className="rounded-full bg-[#0b3d2e] px-6 text-white hover:bg-[#14553f]">{submitting ? 'Menyimpan...' : needsApplication ? 'Submit application' : 'Continue to Homy'} <ArrowRight data-icon="inline-end" /></Button>
          </div>
          {message && <p role="status" className="mt-5 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]">{message}</p>}
        </form>
      </div>
    </main>
  )
}
