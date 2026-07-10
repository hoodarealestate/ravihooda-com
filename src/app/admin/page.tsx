// This page serves the full CRM dashboard
// Auth is handled client-side via crm_token cookie + /api/admin
import CRMDashboard from './CRMDashboard'

export const metadata = {
  title: 'CRM Dashboard · The Hooda Team',
}

export default function AdminPage() {
  return <CRMDashboard />
}
