import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  exchangeCode, longLived, resolveInstagram, resolvePage, threadsProfile, saveConnection, markConnectionError, friendlyMetaError,
  IG_SCOPES, FB_SCOPES, THREADS_SCOPES, type Channel,
} from '@/lib/meta'

export const runtime = 'nodejs'
export const maxDuration = 60

const WORKFORCE_PATH = '/dashboard/admin/workforce'

type Saved = { state: string; channel: Channel; uid: string }

function isChannel(v: unknown): v is Channel {
  return v === 'instagram' || v === 'threads' || v === 'facebook'
}

function back(url: URL, status: 'ok' | 'error', msg?: string) {
  const target = new URL(WORKFORCE_PATH, url)
  target.searchParams.set('meta', status)
  if (msg) target.searchParams.set('msg', msg.slice(0, 260))
  const res = NextResponse.redirect(target)
  res.cookies.set('meta_oauth', '', { path: '/', maxAge: 0 })
  return res
}

/** Terima balikan OAuth dari Meta/Threads, tukar code → token, simpan koneksi. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const errDesc = url.searchParams.get('error_description') || url.searchParams.get('error')
  if (errDesc) return back(url, 'error', errDesc)

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return back(url, 'error', 'Parameter OAuth tidak lengkap.')

  const store = await cookies()
  const raw = store.get('meta_oauth')?.value
  let saved: Saved | null = null
  try { saved = raw ? (JSON.parse(raw) as Saved) : null } catch { saved = null }

  if (!saved || saved.state !== state || !isChannel(saved.channel)) {
    return back(url, 'error', 'State OAuth tidak cocok. Coba ulangi proses connect.')
  }
  const channel = saved.channel

  try {
    const short = await exchangeCode(channel, code)
    if (!short.token) throw new Error('Tidak menerima access token dari penyedia.')
    const long = await longLived(channel, short.token)
    const token = long.token || short.token
    const expiresAt = long.expiresIn ? new Date(Date.now() + long.expiresIn * 1000).toISOString() : null

    if (channel === 'instagram') {
      const info = await resolveInstagram(token || short.token)
      const ok = await saveConnection({
        channel, accountId: info.igId, username: info.username, pageId: info.pageId, pageName: info.pageName,
        // Page token dari long-lived user token tidak kedaluwarsa → pakai itu untuk publish.
        accessToken: info.pageToken || token, expiresAt: null, scopes: IG_SCOPES.join(' '),
        connectedBy: saved.uid, status: 'connected',
      })
      if (!ok) throw new Error('Gagal menyimpan koneksi Instagram.')
      return back(url, 'ok', `Instagram terhubung: @${info.username || info.igId}`)
    }

    if (channel === 'facebook') {
      const info = await resolvePage(token || short.token)
      const ok = await saveConnection({
        channel, accountId: info.pageId, username: info.pageName, pageId: info.pageId, pageName: info.pageName,
        accessToken: info.pageToken || token, expiresAt: null, scopes: FB_SCOPES.join(' '),
        connectedBy: saved.uid, status: 'connected',
      })
      if (!ok) throw new Error('Gagal menyimpan koneksi Facebook.')
      return back(url, 'ok', `Facebook terhubung: ${info.pageName || info.pageId}`)
    }

    const profile = await threadsProfile(token)
    const ok = await saveConnection({
      channel, accountId: profile.id, username: profile.username,
      accessToken: token, expiresAt, scopes: THREADS_SCOPES.join(' '), connectedBy: saved.uid, status: 'connected',
    })
    if (!ok) throw new Error('Gagal menyimpan koneksi Threads.')
    return back(url, 'ok', `Threads terhubung: @${profile.username || profile.id}`)
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Gagal menyelesaikan koneksi.'
    const msg = friendlyMetaError(raw)
    await markConnectionError(channel, msg)
    return back(url, 'error', msg)
  }
}
