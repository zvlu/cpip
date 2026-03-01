import { DashboardOverview } from "@/components/dashboard/DashboardOverview";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor creator performance and estimated revenue in real-time</p>
      </div>
      <DashboardOverview campaignId="default" />
    </div>
  );
}
