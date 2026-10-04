import { notFound } from 'next/navigation'
import { DashboardSection, type SectionRole } from '@/components/dashboard/dashboard-section'

const VALID: Record<SectionRole, string[]> = {
  agent: ['listings', 'leads', 'analytics', 'billing', 'referral', 'schedule', 'calendar', 'availability', 'conversations', 'agreement', 'owner-agreement', 'verification', 'list', 'ai'],
  admin: ['moderation', 'verifications', 'users', 'billing', 'referral', 'reports', 'ai', 'sanctions', 'ai-admin', 'workforce'],
  'super-admin': ['roles', 'verifications', 'billing', 'referral', 'audit', 'system', 'flags', 'partnership', 'sanctions', 'ai-admin', 'workforce'],
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
