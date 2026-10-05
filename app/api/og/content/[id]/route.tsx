import { ImageResponse } from 'next/og'
import { serviceClient } from '@/lib/visits'

export const runtime = 'nodejs'

/** Kartu gambar 1080x1080 untuk feed Instagram — dibuat dari draf konten. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = serviceClient()
  const { data } = sb
    ? await sb.from('ai_work_items').select('title,payload,kind').eq('id', id).maybeSingle()
    : { data: null }

  const payload = ((data?.payload ?? {}) as Record<string, unknown>)
  const hook = String(payload.hook ?? data?.title ?? 'Tips properti dari Homy').slice(0, 120)
  const body = String(payload.body ?? '').slice(0, 320)
  const cta = payload.cta ? String(payload.cta).slice(0, 80) : 'Hubungi tim Homy Property'
  const hashtags = Array.isArray(payload.hashtags) ? (payload.hashtags as unknown[]).map(String).slice(0, 8).join('  ') : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px', height: '1080px', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(160deg, #0b3d2e 0%, #0f4d3a 55%, #08301f 100%)',
          color: '#f6f3ea', padding: '72px', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '76px', height: '76px', borderRadius: '20px', background: '#e8d9b5', color: '#0b3d2e', fontSize: '40px', fontWeight: 800 }}>H</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '1px' }}>HOMY PROPERTY</div>
            <div style={{ fontSize: '22px', color: '#9fc3b3' }}>homyproperty.id</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: '28px' }}>
          <div style={{ fontSize: '58px', fontWeight: 800, lineHeight: 1.15 }}>{hook}</div>
          {body ? <div style={{ fontSize: '30px', lineHeight: 1.5, color: '#d9e6de' }}>{body}</div> : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#e8d9b5', color: '#0b3d2e', fontSize: '28px', fontWeight: 700, padding: '16px 30px', borderRadius: '999px' }}>{cta}</div>
          {hashtags ? <div style={{ fontSize: '24px', color: '#7fae9a' }}>{hashtags}</div> : null}
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  )
}
