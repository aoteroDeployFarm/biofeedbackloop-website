import AuthGuard from "@/components/auth/AuthGuard";
import LogDashboard from "@/components/dashboard/LogDashboard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <LogDashboard />
    </AuthGuard>
  );
}
