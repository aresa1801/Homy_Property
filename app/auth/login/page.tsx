'use client'

import { useState } from 'react'
import { Home, ArrowRight, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInWithGoogle() {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const redirectTo = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (authError) {
      setError('Google sign in is currently unavailable. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f7f3ec] lg:grid-cols-2">
      <section className="hidden bg-[#0b3d2e] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <a href="/" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#c9a961] text-[#0b3d2e]"><Home /></span><span className="font-serif text-2xl font-bold">Homy<span className="text-[#c9a961]">.</span></span></a>
        <div className="max-w-md"><p className="mb-4 text-sm font-semibold uppercase tracking-[.18em] text-[#c9a961]">Welcome home</p><h1 className="font-serif text-6xl leading-tight">Your next chapter starts here.</h1><p className="mt-6 text-lg leading-8 text-white/70">Sign in to save homes, message agents, and manage your property journey in one place.</p></div>
        <p className="text-sm text-white/50">Trusted property discovery for Indonesia.</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10"><div className="w-full max-w-md"><a href="/" className="mb-12 flex items-center gap-3 lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-[#0b3d2e] text-[#c9a961]"><Home /></span><span className="font-serif text-2xl font-bold text-[#0b3d2e]">Homy<span className="text-[#c9a961]">.</span></span></a><p className="text-sm font-semibold uppercase tracking-[.18em] text-[#c09b54]">Your home journey</p><h2 className="mt-3 font-serif text-5xl text-[#0b3d2e]">Sign in to Homy.</h2><p className="mt-4 leading-7 text-[#65706c]">Continue with your Google account to access personalized property tools.</p><Button onClick={signInWithGoogle} disabled={loading} className="mt-9 h-14 w-full rounded-xl bg-[#0b3d2e] text-base text-white hover:bg-[#14553f]"><span className="grid size-7 place-items-center rounded-full bg-white text-sm font-bold text-[#4285f4]">G</span>{loading ? 'Connecting...' : 'Continue with Google'}<ArrowRight data-icon="inline-end" /></Button>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-8 flex gap-3 rounded-xl border border-[#e8dfd3] bg-white p-4 text-sm leading-6 text-[#65706c]"><ShieldCheck className="mt-0.5 shrink-0 text-[#0b3d2e]" /> Your account is protected by Supabase Auth. We never store your Google password.</div><p className="mt-8 text-center text-sm text-[#65706c]">By continuing, you agree to our <a href="/" className="font-semibold text-[#0b3d2e]">Terms</a> and <a href="/" className="font-semibold text-[#0b3d2e]">Privacy Policy</a>.</p></div></section>
    </main>
  )
}
