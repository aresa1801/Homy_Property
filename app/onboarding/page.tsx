'use client'

import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Check, Home, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

type Role = 'user' | 'agent' | 'property_owner'

export default function OnboardingPage() {
  const [role, setRole] = useState<Role>('user')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const email = data.user?.email?.trim().toLowerCase()
      if (email === 'rahadhyan@gmail.com') {
        window.location.replace('/dashboard/super-admin')
        return
      }
      setName(data.user?.user_metadata?.full_name ?? data.user?.email?.split('@')[0] ?? '')
      setLoading(false)
    })
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { window.location.href = '/auth/login'; return }
    if (userData.user.email?.trim().toLowerCase() === 'rahadhyan@gmail.com') {
      window.location.href = '/dashboard/super-admin'
      return
    }
    const { error: profileError } = await supabase.from('profiles').upsert({ id: userData.user.id, full_name: name, role }, { onConflict: 'id' })
    if (profileError) {
      setMessage('We could not save your role. Please try again.')
      setSubmitting(false)
      return
    }
    if (role === 'user') {
      window.location.href = '/dashboard/user'
      return
    }
    const { error: applicationError } = await (supabase as any).rpc('submit_role_application', { requested_role_input: role, full_name_input: name, phone_input: phone, company_name_input: company || null, identity_number_input: null, reason_input: reason || null })
    if (applicationError) {
      setMessage('Your role was saved, but we could not create the application record. You can continue to your dashboard.')
    }
    window.location.href = role === 'agent' ? '/dashboard/agent' : '/dashboard/property-owner'
    setSubmitting(false)
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f7f3ec] text-[#0b3d2e]">Loading your profile...</main>

  return <main className="min-h-screen bg-[#f7f3ec] px-5 py-10 text-[#1c1c1c] sm:px-8"><div className="mx-auto max-w-3xl"><a href="/" className="flex items-center gap-3 text-[#0b3d2e]"><span className="grid size-10 place-items-center rounded-xl bg-[#0b3d2e] text-[#c9a961]"><Home /></span><span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span></a><div className="mt-16 max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Almost there</p><h1 className="mt-3 font-serif text-5xl leading-tight text-[#0b3d2e] sm:text-6xl">How will you use Homy?</h1><p className="mt-5 max-w-xl text-lg leading-8 text-[#65706c]">Choose your path. You can always apply to become an Agent or Property Owner later.</p></div><form onSubmit={submit} className="mt-12"><div className="grid gap-4 md:grid-cols-3">{([['user','Just exploring','Find and save properties.'],['agent','I am an Agent','Manage clients and listings.'],['property_owner','I own Property','List and manage my property.']] as const).map(([value, title, description]) => <button type="button" key={value} onClick={() => setRole(value)} className={`rounded-2xl border p-5 text-left transition ${role === value ? 'border-[#0b3d2e] bg-[#0b3d2e] text-white shadow-xl' : 'border-[#e8dfd3] bg-white hover:border-[#c9a961]'}`}><span className={`grid size-11 place-items-center rounded-xl ${role === value ? 'bg-[#c9a961] text-[#0b3d2e]' : 'bg-[#edf2ed] text-[#0b3d2e]'}`}>{value === 'user' ? <UserRound /> : <Home />}</span><span className="mt-5 block font-serif text-xl">{title}</span><span className={`mt-2 block text-sm leading-6 ${role === value ? 'text-white/70' : 'text-[#65706c]'}`}>{description}</span>{role === value && <Check className="mt-5 text-[#c9a961]" />}</button>)}</div>{role !== 'user' && <div className="mt-8 grid gap-5 rounded-2xl border border-[#e8dfd3] bg-white p-6 sm:grid-cols-2"><label className="text-sm font-semibold text-[#33433d]">Full name<input required value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" /></label><label className="text-sm font-semibold text-[#33433d]">Phone number<input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" /></label><label className="text-sm font-semibold text-[#33433d] sm:col-span-2">Company or agency <span className="font-normal text-[#65706c]">(optional)</span><input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#ddd3c5] px-4 font-normal outline-none focus:border-[#0b3d2e]" /></label><label className="text-sm font-semibold text-[#33433d] sm:col-span-2">Tell us a little more <span className="font-normal text-[#65706c]">(optional)</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-2 w-full rounded-lg border border-[#ddd3c5] p-4 font-normal outline-none focus:border-[#0b3d2e]" /></label></div>}<div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-[#e8dfd3] pt-6 sm:flex-row sm:items-center"><p className="text-sm text-[#65706c]">You can update your role preferences later.</p><Button disabled={submitting} className="rounded-full bg-[#0b3d2e] px-6 text-white hover:bg-[#14553f]">{submitting ? 'Saving...' : role === 'user' ? 'Continue to Homy' : 'Submit application'} <ArrowRight data-icon="inline-end" /></Button></div>{message && <p role="status" className="mt-5 rounded-xl bg-[#e2eee7] p-4 text-sm text-[#0b3d2e]">{message}</p>}</form></div></main>
}
