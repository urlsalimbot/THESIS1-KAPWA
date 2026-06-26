import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw, Clock, DollarSign } from 'lucide-react';
import '../index.css';
import { getDashboard } from '../lib/api';

interface Stat { label: string; value: string; change: string; icon: React.ElementType; iconClass: string; }
interface CaseRow { id: string; name: string; category: string; barangay: string; remarks: string; date: string; status: string; }

const StatusBadge = React.memo(({ status }: { status: string }) => {
  const map: Record<string, { className: string; label: string }> = {
    approved: { className: 'bg-green-100 text-green-800', label: 'Approved' },
    pending_assessment: { className: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    in_review: { className: 'bg-blue-100 text-blue-800', label: 'In Review' },
    disbursed: { className: 'bg-gray-200 text-gray-700', label: 'Disbursed' },
    closed: { className: 'bg-gray-100 text-gray-500', label: 'Closed' },
  };
  const s = map[status] || map.pending_assessment;
  return <span className={`badge ${s.className}`}>{s.label}</span>;
});

const StatCard = React.memo(({ stat }: { stat: Stat }) => {
  const Icon = stat.icon;
  return (
    <div className="rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-gray-500 text-xs uppercase tracking-wide">{stat.label}</span>
        <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center ${stat.iconClass}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
      <div className="text-xs mt-1">{stat.change}</div>
    </div>
  );
});

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stat[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    loadData();
      return () => controller.abort();
  }, []);

  async function loadData(signal?: AbortSignal) {
    try {
      const data = await getDashboard();
      setStats([
        { label: 'Served Today', value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} from yesterday`, icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
        { label: 'Sync Status', value: 'All Synced', change: `Last sync: ${data.lastSync || '2m ago'}`, icon: RefreshCw, iconClass: 'bg-blue-50 text-cyan-600' },
        { label: 'Pending Review', value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} urgent`, icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
        { label: 'Disbursed This Month', value: `₱${data.disbursedMonth || 0}`, change: `${data.beneficiaryCount || 0} beneficiaries`, icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
      ]);
      setCases(data.recentCases || []);
    } catch {
      setStats([
        { label: 'Served Today', value: '0', change: 'N/A', icon: TrendingUp, iconClass: 'bg-blue-50 text-blue-700' },
        { label: 'Sync Status', value: 'Offline', change: 'Check connection', icon: RefreshCw, iconClass: 'bg-blue-50 text-cyan-600' },
        { label: 'Pending Review', value: '0', change: 'N/A', icon: Clock, iconClass: 'bg-yellow-100 text-yellow-800' },
        { label: 'Disbursed This Month', value: '₱0', change: 'N/A', icon: DollarSign, iconClass: 'bg-green-100 text-green-800' },
      ]);
    }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center p-12">
    <div className="text-center">
      <div className="spinner mx-auto mb-3" />
      <p className="text-text-secondary text-sm">Loading dashboard...</p>
    </div>
  </div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-desc">Overview of social welfare operations and metrics.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => <StatCard key={s.label} stat={s} />)}
      </div>

      <div className="mb-4">
        <h3 className="text-lg mb-3">Recent Cases</h3>
      </div>

      <div className="rounded-lg">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="w-30">Case ID</th>
                <th className="text-style-label">Name</th>
                <th className="text-style-label">Category</th>
                <th className="text-style-label">Barangay</th>
                <th className="text-style-label">Intervention/Remarks</th>
                <th className="text-style-label">Status</th>
                <th className="min-w-[140px]">Date</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id}>
                  <td className="text-gray-500">{c.id}</td>
                  <td className="font-medium text-gray-900">{c.name}</td>
                  <td><span className="badge-category">{c.category}</span></td>
                  <td className="text-text-secondary">{c.barangay}</td>
                  <td className="text-xs">{c.remarks}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-xs text-gray-500 min-w-[140px]">{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>Showing {cases.length} recent cases</span>
          <button className="px-3 py-1.5 text-xs" onClick={() => navigate("/cases")} aria-label="View All Cases">View All Cases</button>
        </div>
      </div>
    </div>
  );
}
