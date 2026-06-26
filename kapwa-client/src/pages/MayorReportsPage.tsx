import { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Clock, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { getMayorReports } from '../lib/api';

export function MayorReportsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMayorReports()
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading reports...</div>;

  const stats = metrics ? [
    { label: 'Total Cases', value: String(metrics.totalCases || 0), icon: TrendingUp, color: 'bg-blue-50 text-blue-700' },
    { label: 'Unique Households', value: String(metrics.uniqueHouseholds || 0), icon: Users, color: 'bg-green-100 text-green-800' },
    { label: 'Fund Utilization', value: `₱${(metrics.fundUtilization || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-blue-50 text-cyan-600' },
    { label: 'Served Today', value: String(metrics.servedToday || 0), icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
    { label: 'Cases by Status', value: metrics.caseStatusDistribution?.length > 0 ? `${metrics.caseStatusDistribution.length} statuses` : 'N/A', icon: CheckCircle, color: 'bg-purple-50 text-purple-700' },
    { label: 'SLA Compliance', value: metrics.slaCompliance?.slaStatus === 'compliant' ? 'Compliant' : 'Violated', icon: metrics.slaCompliance?.slaStatus === 'compliant' ? CheckCircle : AlertTriangle, color: metrics.slaCompliance?.slaStatus === 'compliant' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' },
  ] : [];

  if (!metrics) {
    return (
      <div>
        <div className="page-header">
          <h2 className="page-title">Reports</h2>
          <p className="page-desc">Municipal program and compliance overview</p>
        </div>
        <div className="p-8 text-center text-gray-400">No data available for the selected period.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Reports</h2>
        <p className="page-desc">Municipal program and compliance overview</p>
      </div>

      <div className="no-print flex gap-2 mb-4">
        <span className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs text-gray-600">
          <Download size={14} /> Export Reports
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-gray-500 text-xs uppercase tracking-wide">{s.label}</span>
                <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center ${s.color}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            </div>
          );
        })}
      </div>

      {metrics.caseStatusDistribution?.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold text-sm text-gray-700 mb-3">Case Status Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {metrics.caseStatusDistribution.map((s: any, i: number) => (
              <div key={i} className="flex justify-between border-b py-1 text-sm">
                <span className="text-gray-600">{s.status}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
