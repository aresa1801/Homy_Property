import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatPriceWithPeriod } from '@/lib/property-format'

/**
 * Data untuk Widget Homy (Windows Widgets).
 * Template Adaptive Card: /widgets/homy-properti.json
 * Bentuk balasan: { items: [{ title, price, city, href }] }
 */
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select('id,title,price,price_period,listing_type,city,district')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ items: [] }, { status: 200 })

  const items = (data ?? []).map((property) => ({
    title: property.title,
    price: formatPriceWithPeriod(property.price, property.price_period),
    city: [property.district, property.city].filter(Boolean).join(', ') || 'Lokasi menyusul',
    href: `https://homyproperty.id/property/${property.id}`,
  }))

  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } })
}
