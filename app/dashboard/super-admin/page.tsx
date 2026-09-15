import { AdminOverviewBoard } from '@/components/dashboard/boards-admin'
import { DashboardShell } from '@/components/dashboard-shell'

export default function SuperAdminDashboard() {
  return (
    <DashboardShell role="Super Admin" showSummary={false}>
      <AdminOverviewBoard type="super-admin" />
    </DashboardShell>
  )
}
