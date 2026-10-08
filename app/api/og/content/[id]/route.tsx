import { ImageResponse } from 'next/og'
import { serviceClient } from '@/lib/visits'

export const runtime = 'nodejs'

/**
 * Kartu gambar untuk kanal sosial Homy.
 * - Draf konten SMM (kind=content_draft): poster EDUKASI AGEN — tema, tujuan, poin, logo resmi.
 * - Aset desain (kind=design_asset): poster dengan palet warna dari tim Visual.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const px = (n: number) => `${Math.round(n * s)}px`

  const origin = (() => {
    try { return new URL(request.url).origin } catch { return process.env.NEXT_PUBLIC_SITE_URL || 'https://homyproperty.id' }
  })()
  const logoUrl = `${origin}/logo-homy-light.png`
  const site = (origin.replace(/^https?:\/\//, '').replace(/\/$/, '')) || 'homyproperty.id'

  const slot = String(payload.slot ?? '').toLowerCase() === 'sore' ? 'sore' : payload.slot ? 'pagi' : ''
  const theme = String(payload.theme ?? '').trim()
  const goal = String(payload.goal ?? '').trim()
  const points = Array.isArray(payload.points) ? (payload.points as unknown[]).map(String).filter(Boolean).slice(0, 4) : []

  const headline = String((isDesign ? payload.headline : payload.hook) ?? data?.title ?? 'Tips properti dari Homy').slice(0, 130)
  const body = String((isDesign ? payload.subheadline : payload.body) ?? '').slice(0, 320)
  const cta = payload.cta ? String(payload.cta).slice(0, 80) : 'Kunjungi homyproperty.id'
  const hashtags = !isDesign && Array.isArray(payload.hashtags) ? (payload.hashtags as unknown[]).map(String).slice(0, 8).join('  ') : ''

  const pal = isDesign && Array.isArray(payload.palette) && (payload.palette as unknown[]).length
    ? (payload.palette as unknown[]).map(String)
    : ['#0b3d2e', '#0f4d3a', '#08291c', '#e8d9b5', '#f6f3ea']
  const bg0 = pal[0] ?? '#0b3d2e'
  const bg1 = pal[1] ?? '#0f4d3a'
  const bg2 = pal[2] ?? '#08291c'
  const accent = pal[3] ?? '#e8d9b5'
  const ink = pal[4] ?? '#f6f3ea'
  const soft = isDesign ? ink : '#d7e6dd'
  const glow = slot === 'sore' ? 'rgba(240,170,90,0.34)' : slot === 'pagi' ? 'rgba(255,214,120,0.32)' : 'rgba(255,214,120,0.18)'
  const chipText = slot === 'sore' ? 'SESI SORE' : slot === 'pagi' ? 'SESI PAGI' : 'EDUKASI AGEN'

  // Poster edukasi agen (draf konten): tata letak kuat — logo, badge tema, poin, tujuan.
  if (!isDesign && theme) {
    return new ImageResponse(
      (
        <div
          style={{
            width: px(w), height: px(h), display: 'flex', flexDirection: 'column', position: 'relative',
            background: `linear-gradient(150deg, ${bg1} 0%, ${bg0} 52%, ${bg2} 100%)`,
            color: ink, padding: px(66), fontFamily: 'sans-serif', overflow: 'hidden',
          }}
        >
          {/* aksen dekoratif */}
          <div style={{ position: 'absolute', top: px(-170), right: px(-140), width: px(560), height: px(560), borderRadius: '999px', background: `radial-gradient(circle, ${glow} 0%, rgba(0,0,0,0) 68%)`, display: 'flex' }} />
          <div style={{ position: 'absolute', bottom: px(-220), left: px(-160), width: px(620), height: px(620), borderRadius: '999px', background: 'radial-gradient(circle, rgba(232,217,181,0.16) 0%, rgba(0,0,0,0) 70%)', display: 'flex' }} />

          {/* header: logo resmi + chip sesi */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} width={Math.round(232 * s)} height={Math.round(69 * s)} style={{ objectFit: 'contain' }} alt="Homy Property" />
            <div style={{ display: 'flex', alignItems: 'center', gap: px(12), background: accent, color: bg2, padding: `${px(12)} ${px(26)}`, borderRadius: '999px', fontSize: px(26), fontWeight: 800, letterSpacing: '1px' }}>{chipText}</div>
          </div>

          {/* badan */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: px(26), position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: px(14), color: accent, fontSize: px(26), fontWeight: 700, letterSpacing: '3px' }}>EDUKASI AGEN PROPERTI</div>
            <div style={{ fontSize: px(62), fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px' }}>{theme.length > 74 ? theme.slice(0, 74) : theme}</div>
            {goal ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: px(6) }}>
                <div style={{ fontSize: px(24), color: accent, fontWeight: 700, letterSpacing: '1px' }}>TUJUAN</div>
                <div style={{ fontSize: px(30), color: soft, lineHeight: 1.35 }}>{goal}</div>
              </div>
            ) : null}

            {points.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: px(16), marginTop: px(6) }}>
                {points.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: px(18) }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: px(46), height: px(46), borderRadius: '999px', background: accent, color: bg2, fontSize: px(26), fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontSize: px(29), color: ink, lineHeight: 1.3 }}>{String(t).slice(0, 96)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: px(30), color: soft, lineHeight: 1.45 }}>{headline}</div>
            )}
          </div>

          {/* footer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: px(18), position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignSelf: 'flex-start', background: accent, color: bg2, fontSize: px(28), fontWeight: 800, padding: `${px(16)} ${px(32)}`, borderRadius: '999px' }}>{cta}</div>
              <div style={{ fontSize: px(28), fontWeight: 700, color: accent }}>{site}</div>
            </div>
            {hashtags ? <div style={{ fontSize: px(23), color: soft }}>{hashtags}</div> : null}
            {body ? <div style={{ fontSize: px(22), color: soft, opacity: 0.82 }}>{body.length > 150 ? `${body.slice(0, 150)}…` : body}</div> : null}
          </div>
        </div>
      ),
      { width: w, height: h },
    )
  }

  // Kartu umum / aset desain (Vino) & draf lama tanpa tema.
  return new ImageResponse(
    (
      <div
        style={{
          width: `${w}px`, height: `${h}px`, display: 'flex', flexDirection: 'column', position: 'relative',
          background: `linear-gradient(160deg, ${bg0} 0%, ${bg1} 55%, ${bg2} 100%)`,
          color: ink, padding: `${Math.round(72 * s)}px`, fontFamily: 'sans-serif', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: px(-160), right: px(-140), width: px(540), height: px(540), borderRadius: '999px', background: `radial-gradient(circle, ${glow} 0%, rgba(0,0,0,0) 68%)`, display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} width={Math.round(232 * s)} height={Math.round(69 * s)} style={{ objectFit: 'contain' }} alt="Homy Property" />
          <div style={{ fontSize: `${Math.round(22 * s)}px`, color: accent }}>{site}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: `${Math.round(28 * s)}px`, position: 'relative' }}>
          <div style={{ fontSize: `${Math.round(58 * s)}px`, fontWeight: 800, lineHeight: 1.15 }}>{headline}</div>
          {body ? <div style={{ fontSize: `${Math.round(30 * s)}px`, lineHeight: 1.5, color: soft }}>{body}</div> : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: `${Math.round(16 * s)}px`, position: 'relative' }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: accent, color: bg0, fontSize: `${Math.round(28 * s)}px`, fontWeight: 700, padding: `${Math.round(16 * s)}px ${Math.round(30 * s)}px`, borderRadius: '999px' }}>{cta}</div>
          {hashtags ? <div style={{ fontSize: `${Math.round(24 * s)}px`, color: accent }}>{hashtags}</div> : null}
        </div>
      </div>
    ),
    { width: w, height: h },
  )
}
