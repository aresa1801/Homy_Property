import { notFound } from 'next/navigation'
import { DashboardSection, type SectionRole } from '@/components/dashboard/dashboard-section'

const VALID: Record<SectionRole, string[]> = {
  agent: ['listings', 'leads', 'analytics', 'billing', 'schedule', 'calendar', 'availability', 'conversations', 'agreement', 'list', 'ai'],
  'property-owner': ['properties', 'inquiries', 'schedule', 'calendar', 'availability', 'conversations', 'agreement', 'list', 'ai'],
  admin: ['moderation', 'users', 'billing', 'reports', 'ai'],
  'super-admin': ['roles', 'billing', 'audit', 'system', 'flags', 'partnership'],
}

export function generateStaticParams() {
  return Object.entries(VALID).flatMap(([role, sections]) => sections.map((section) => ({ role, section })))
}

export default async function DashboardSectionPage({ params }: { params: Promise<{ role: string; section: string }> }) {
  const { role, section } = await params
  const sections = VALID[role as SectionRole]
  if (!sections || !sections.includes(section)) notFound()
  return <DashboardSection role={role as SectionRole} section={section} />
}
