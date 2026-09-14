/** Pembatas laju sederhana (best-effort, per instance server). */
const buckets = new Map<string, { count: number; reset: number }>()

export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }
  bucket.count += 1
  if (bucket.count > limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) }
  return { ok: true, retryAfter: 0 }
}

export function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
  return `${scope}:${ip}`
}
