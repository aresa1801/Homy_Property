import { AdminOverviewBoard } from '@/components/dashboard/boards-admin'
import { DashboardShell } from '@/components/dashboard-shell'

export default function AdminDashboard() {
  return (
    <DashboardShell role="Admin" showSummary={false}>
      <AdminOverviewBoard type="admin" />
    </DashboardShell>
  )
}
