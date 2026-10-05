import { ImageResponse } from 'next/og'
import { serviceClient } from '@/lib/visits'

export const runtime = 'nodejs'

/**
 * Kartu gambar untuk kanal sosial Homy.
 * - Draf konten SMM (kind=content_draft): hook + isi + CTA + hashtag.
 * - Aset desain (kind=design_asset): poster dengan palet warna dari tim Visual.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = serviceClient()
  const { data } = sb
    ? await sb.from('ai_work_items').select('title,payload,kind').eq('id', id).maybeSingle()
    : { data: null }

  const payload = ((data?.payload ?? {}) as Record<string, unknown>)
  const isDesign = String(data?.kind ?? '') === 'design_asset'
  const w = Number(payload.w) || 1080
  const h = Number(payload.h) || 1080
  const s = h >= 1000 ? 1 : 0.58

  const headline = String((isDesign ? payload.headline : payload.hook) ?? data?.title ?? 'Tips properti dari Homy').slice(0, 130)
  const body = String((isDesign ? payload.subheadline : payload.body) ?? '').slice(0, 320)
  const cta = payload.cta ? String(payload.cta).slice(0, 80) : 'Kunjungi homyproperty.id'
  const hashtags = !isDesign && Array.isArray(payload.hashtags) ? (payload.hashtags as unknown[]).map(String).slice(0, 8).join('  ') : ''
  const pal = isDesign && Array.isArray(payload.palette) && (payload.palette as unknown[]).length
    ? (payload.palette as unknown[]).map(String)
    : ['#0b3d2e', '#0f4d3a', '#08301f', '#e8d9b5', '#f6f3ea']
  const bg0 = pal[0] ?? '#0b3d2e'
  const bg1 = pal[1] ?? '#0f4d3a'
  const bg2 = pal[2] ?? '#08301f'
  const accent = pal[3] ?? '#e8d9b5'
  const ink = pal[4] ?? '#f6f3ea'
  const soft = isDesign ? ink : '#d9e6de'

  return new ImageResponse(
    (
      <div
        style={{
          width: `${w}px`, height: `${h}px`, display: 'flex', flexDirection: 'column',
          background: `linear-gradient(160deg, ${bg0} 0%, ${bg1} 55%, ${bg2} 100%)`,
          color: ink, padding: `${Math.round(72 * s)}px`, fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: `${Math.round(18 * s)}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${Math.round(76 * s)}px`, height: `${Math.round(76 * s)}px`, borderRadius: `${Math.round(20 * s)}px`, background: accent, color: bg0, fontSize: `${Math.round(40 * s)}px`, fontWeight: 800 }}>H</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: `${Math.round(30 * s)}px`, fontWeight: 700, letterSpacing: '1px' }}>HOMY PROPERTY</div>
            <div style={{ fontSize: `${Math.round(22 * s)}px`, color: accent }}>homyproperty.id</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: `${Math.round(28 * s)}px` }}>
          <div style={{ fontSize: `${Math.round(58 * s)}px`, fontWeight: 800, lineHeight: 1.15 }}>{headline}</div>
          {body ? <div style={{ fontSize: `${Math.round(30 * s)}px`, lineHeight: 1.5, color: soft }}>{body}</div> : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: `${Math.round(16 * s)}px` }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: accent, color: bg0, fontSize: `${Math.round(28 * s)}px`, fontWeight: 700, padding: `${Math.round(16 * s)}px ${Math.round(30 * s)}px`, borderRadius: '999px' }}>{cta}</div>
          {hashtags ? <div style={{ fontSize: `${Math.round(24 * s)}px`, color: accent }}>{hashtags}</div> : null}
        </div>
      </div>
    ),
    { width: w, height: h },
  )
}
