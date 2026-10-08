import { serviceClient } from '@/lib/visits'

/** Versi Graph API — v21.0 masih aktif (diverifikasi 05 Okt 2026). */
export const GRAPH_VERSION = 'v21.0'
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`
export const THREADS_GRAPH = 'https://graph.threads.net'
export const THREADS_VERSION = 'v1.0'

export type Channel = 'instagram' | 'threads' | 'facebook'

export const IG_SCOPES = ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'business_management']
/** Facebook Page: butuh pages_manage_posts agar bisa menerbitkan ke feed Halaman. */
export const FB_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management', 'instagram_basic', 'instagram_content_publish']
export const THREADS_SCOPES = ['threads_basic', 'threads_content_publish']

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://homyproperty.id').replace(/\/+$/, '')
}
export function redirectUri(): string {
  return `${siteUrl()}/api/admin/meta/callback`
}

export function appCredentials(channel: Channel): { id: string; secret: string } {
  if (channel !== 'threads') {
    return { id: process.env.META_APP_ID || '', secret: process.env.META_APP_SECRET || '' }
  }
  return { id: process.env.THREADS_APP_ID || '', secret: process.env.THREADS_APP_SECRET || '' }
}
export function configured(channel: Channel): boolean {
  const c = appCredentials(channel)
  return Boolean(c.id && c.secret)
}

/** URL dialog OAuth untuk memulai koneksi. */
export function authorizeUrl(channel: Channel, state: string): string | null {
  const { id } = appCredentials(channel)
  if (!id) return null
  const redirect = encodeURIComponent(redirectUri())
  if (channel !== 'threads') {
    const scope = encodeURIComponent((channel === 'facebook' ? FB_SCOPES : IG_SCOPES).join(','))
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?client_id=${id}&redirect_uri=${redirect}&state=${state}&response_type=code&scope=${scope}`
  }
  const scope = encodeURIComponent(THREADS_SCOPES.join(','))
  return `https://threads.net/oauth/authorize?client_id=${id}&redirect_uri=${redirect}&state=${state}&response_type=code&scope=${scope}`
}

type Json = Record<string, unknown>

async function jsonFetch(url: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const text = await res.text()
  let data: Json = {}
  try { data = text ? (JSON.parse(text) as Json) : {} } catch { data = { raw: text } }
  if (!res.ok) {
    const err = data.error as { message?: string } | undefined
    throw new Error(err?.message || (data.error_description as string) || (data.raw as string) || `HTTP ${res.status}`)
  }
  return data
}

/* ---------- Token exchange ---------- */

export async function exchangeCode(channel: Channel, code: string): Promise<{ token: string; expiresIn: number }> {
  const { id, secret } = appCredentials(channel)
  if (channel !== 'threads') {
    const url = `${GRAPH}/oauth/access_token?client_id=${id}&redirect_uri=${encodeURIComponent(redirectUri())}&client_secret=${secret}&code=${encodeURIComponent(code)}`
    const d = await jsonFetch(url)
    return { token: String(d.access_token || ''), expiresIn: Number(d.expires_in || 0) }
  }
  const body = new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirectUri(), code })
  const d = await jsonFetch(`${THREADS_GRAPH}/oauth/access_token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  return { token: String(d.access_token || ''), expiresIn: Number(d.expires_in || 0) }
}

export async function longLived(channel: Channel, shortToken: string): Promise<{ token: string; expiresIn: number }> {
  const { id, secret } = appCredentials(channel)
  if (channel !== 'threads') {
    const url = `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${id}&client_secret=${secret}&fb_exchange_token=${encodeURIComponent(shortToken)}`
    const d = await jsonFetch(url)
    return { token: String(d.access_token || shortToken), expiresIn: Number(d.expires_in || 0) }
  }
  const url = `${THREADS_GRAPH}/access_token?grant_type=th_exchange_token&client_secret=${secret}&access_token=${encodeURIComponent(shortToken)}`
  const d = await jsonFetch(url)
  return { token: String(d.access_token || shortToken), expiresIn: Number(d.expires_in || 0) }
}

export type IgResolved = { igId: string; username: string; pageId: string; pageName: string; pageToken: string }

/** Cari Facebook Page yang punya akun Instagram Business tertaut. */
export async function resolveInstagram(userToken: string): Promise<IgResolved> {
  const d = await jsonFetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`)
  const pages = Array.isArray(d.data) ? (d.data as Json[]) : []
  const linked = pages.find((p) => (p.instagram_business_account as Json | undefined)?.id && p.access_token)
  if (!linked) throw new Error('Tidak ada Facebook Page yang tertaut ke akun Instagram Business pada akun ini. Pastikan IG-nya Business/Creator & sudah dihubungkan ke Page.')
  const ig = linked.instagram_business_account as Json
  return {
    pageId: String(linked.id), pageName: String(linked.name || ''),
    igId: String(ig.id), username: ig.username ? String(ig.username) : '',
    pageToken: String(linked.access_token),
  }
}

export async function threadsProfile(token: string): Promise<{ id: string; username: string }> {
  const d = await jsonFetch(`${THREADS_GRAPH}/${THREADS_VERSION}/me?fields=id,username&access_token=${encodeURIComponent(token)}`)
  return { id: String(d.id), username: d.username ? String(d.username) : '' }
}

export type PageResolved = { pageId: string; pageName: string; pageToken: string }

/** Ambil Facebook Page pertama yang bisa dikelola akun ini (untuk terbit ke feed Halaman). */
export async function resolvePage(userToken: string): Promise<PageResolved> {
  const d = await jsonFetch(`${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`)
  const pages = Array.isArray(d.data) ? (d.data as Json[]) : []
  const page = pages.find((p) => p.id && p.access_token)
  if (!page) throw new Error('Tidak ada Facebook Page yang bisa dikelola akun ini. Pastikan kamu admin Halaman tersebut.')
  return { pageId: String(page.id), pageName: String(page.name || ''), pageToken: String(page.access_token) }
}

/* ---------- Store koneksi ---------- */

export type Connection = {
  channel: Channel
  accountId: string | null
  username: string | null
  pageId: string | null
  pageName: string | null
  status: string
  expiresAt: string | null
  scopes: string | null
  connectedAt: string | null
  lastError: string | null
}

type Row = {
  channel: string; account_id: string | null; username: string | null; page_id: string | null; page_name: string | null
  status: string; token_expires_at: string | null; scopes: string | null; connected_at: string | null; last_error: string | null
}

function mapRow(r: Row): Connection {
  return {
    channel: r.channel as Channel, accountId: r.account_id, username: r.username, pageId: r.page_id, pageName: r.page_name,
    status: r.status, expiresAt: r.token_expires_at, scopes: r.scopes, connectedAt: r.connected_at, lastError: r.last_error,
  }
}

/** Daftar koneksi TANPA token (aman dikirim ke UI). */
export async function listConnections(): Promise<Connection[]> {
  const sb = serviceClient()
  if (!sb) return []
  const { data, error } = await sb.from('meta_connections')
    .select('channel,account_id,username,page_id,page_name,status,token_expires_at,scopes,connected_at,last_error')
  if (error || !Array.isArray(data)) return []
  return (data as Row[]).map(mapRow)
}

export type SaveInput = {
  channel: Channel; accountId: string; username: string; accessToken: string
  pageId?: string | null; pageName?: string | null; expiresAt?: string | null
  scopes?: string | null; connectedBy?: string | null; status?: string
}

export async function saveConnection(input: SaveInput): Promise<boolean> {
  const sb = serviceClient()
  if (!sb) return false
  const row = {
    channel: input.channel, account_id: input.accountId, username: input.username,
    page_id: input.pageId ?? null, page_name: input.pageName ?? null,
    access_token: input.accessToken, token_expires_at: input.expiresAt ?? null,
    scopes: input.scopes ?? null, status: input.status ?? 'connected', last_error: null,
    connected_by: input.connectedBy ?? null, updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('meta_connections').upsert(row, { onConflict: 'channel' })
  if (error) { console.error('[meta:save]', error.message); return false }
  return true
}

export async function removeConnection(channel: Channel): Promise<boolean> {
  const sb = serviceClient()
  if (!sb) return false
  const { error } = await sb.from('meta_connections').delete().eq('channel', channel)
  return !error
}

export async function markConnectionError(channel: Channel, message: string): Promise<void> {
  const sb = serviceClient()
  if (!sb) return
  await sb.from('meta_connections').update({ status: 'error', last_error: message.slice(0, 400), updated_at: new Date().toISOString() }).eq('channel', channel)
}

/** URL dashboard Meta App (untuk panduan perbaikan izin/koneksi). */
export function metaAppDashboard(): string {
  const id = process.env.META_APP_ID || process.env.NEXT_PUBLIC_FB_APP_ID || ''
  return id ? `https://developers.facebook.com/apps/${id}/` : 'https://developers.facebook.com/apps/'
}

/** Terjemahkan error mentah Graph API menjadi pesan Indonesia + langkah perbaikan. */
export function friendlyMetaError(raw: string): string {
  const m = String(raw || '').toLowerCase()
  if (m.includes('api access blocked')) {
    return 'Akses API Meta diblokir untuk App ini ("API access blocked"). Ini masalah konfigurasi Meta App (bukan kode aplikasi): buka Meta Developer Console → selesaikan Verifikasi Bisnis, aktifkan App Mode = Live, dan pastikan izin pages_show_list / pages_read_engagement / pages_manage_posts / instagram_content_publish / threads_content_publish mendapat Advanced Access.'
  }
  if (m.includes('impersonating a user') || m.includes('pages_read_engagement') || m.includes('pages_manage_metadata') || m.includes('pages_manage_ads')) {
    return 'Izin Page belum diberikan ke App. Aktifkan izin pages_show_list, pages_read_engagement, dan pages_manage_posts (Advanced Access) di App Review Meta, lalu hubungkan ulang akun di tab Koneksi Sosial.'
  }
  if (m.includes('cannot parse access token') || m.includes('invalid oauth') || m.includes('session has expired') || m.includes('expired')) {
    return 'Token akses tidak valid atau kedaluwarsa. Hubungkan ulang akun di tab Koneksi Sosial.'
  }
  if (m.includes('permission')) {
    return `Izin Meta kurang untuk aksi ini. Periksa App Review Meta. (${raw.slice(0, 160)})`
  }
  return raw
}

/** True bila error berasal dari pemblokiran/izin App-level Meta (bukan bug kode). */
export function isMetaBlocked(raw: string): boolean {
  const m = String(raw || '').toLowerCase()
  return m.includes('api access blocked') || m.includes('impersonating a user') || m.includes('pages_read_engagement') || m.includes('pages_manage_metadata')
}

/** Ambil token mentah (server-only). */
export async function getConnectionSecret(channel: Channel): Promise<{ token: string; accountId: string } | null> {
  const sb = serviceClient()
  if (!sb) return null
  const { data } = await sb.from('meta_connections').select('access_token,account_id,status').eq('channel', channel).maybeSingle()
  if (!data) return null
  const row = data as { access_token: string; account_id: string | null; status: string }
  if (row.status === 'revoked') return null
  return { token: row.access_token, accountId: row.account_id || '' }
}

/* ---------- Publish ---------- */

export async function publishInstagram(imageUrl: string, caption: string): Promise<{ id: string; containerId: string }> {
  const conn = await getConnectionSecret('instagram')
  if (!conn?.token) throw new Error('Instagram belum terhubung.')
  if (!conn.accountId) throw new Error('ID akun Instagram tidak ditemukan.')
  const create = await jsonFetch(`${GRAPH}/${conn.accountId}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ image_url: imageUrl, caption, access_token: conn.token }),
  })
  const containerId = String(create.id || '')
  if (!containerId) throw new Error('Gagal membuat media container Instagram.')
  // IG butuh waktu memproses gambar.
  for (let i = 0; i < 10; i += 1) {
    await new Promise((r) => setTimeout(r, 2500))
    const st = await jsonFetch(`${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(conn.token)}`)
    if (st.status_code === 'FINISHED') break
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`Instagram gagal memproses media (${st.status_code}).`)
  }
  const pub = await jsonFetch(`${GRAPH}/${conn.accountId}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: containerId, access_token: conn.token }),
  })
  return { id: String(pub.id || ''), containerId }
}

export async function publishThreads(text: string, imageUrl?: string): Promise<{ id: string }> {
  const conn = await getConnectionSecret('threads')
  if (!conn?.token) throw new Error('Threads belum terhubung.')
  if (!conn.accountId) throw new Error('ID akun Threads tidak ditemukan.')
  const body = new URLSearchParams({ media_type: imageUrl ? 'IMAGE' : 'TEXT', text: text.slice(0, 500), access_token: conn.token })
  if (imageUrl) body.set('image_url', imageUrl)
  const create = await jsonFetch(`${THREADS_GRAPH}/${THREADS_VERSION}/${conn.accountId}/threads`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  })
  const containerId = String(create.id || '')
  if (!containerId) throw new Error('Gagal membuat container Threads.')
  await new Promise((r) => setTimeout(r, 2000))
  const pub = await jsonFetch(`${THREADS_GRAPH}/${THREADS_VERSION}/${conn.accountId}/threads_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: containerId, access_token: conn.token }),
  })
  return { id: String(pub.id || '') }
}

/** Terbit ke facebook Page: dengan gambar → /photos, teks saja → /feed. */
export async function publishFacebook(message: string, imageUrl?: string): Promise<{ id: string }> {
  const conn = await getConnectionSecret('facebook')
  if (!conn?.token) throw new Error('Facebook belum terhubung.')
  const pageId = conn.accountId
  if (!pageId) throw new Error('ID Halaman Facebook tidak ditemukan.')
  if (imageUrl) {
    const r = await jsonFetch(`${GRAPH}/${pageId}/photos`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: imageUrl, caption: message, access_token: conn.token }),
    })
    return { id: String(r.post_id || r.id || '') }
  }
  const r = await jsonFetch(`${GRAPH}/${pageId}/feed`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, access_token: conn.token }),
  })
  return { id: String(r.id || '') }
}
