import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { TrendingUp, RefreshCw, Clock, DollarSign } from 'lucide-react';
import '../index.css';
import { getDashboard } from '../lib/api';

interface Stat { label: string; value: string; change: string; icon: any; color: string; bg: string; }
interface CaseRow { id: string; name: string; category: string; barangay: string; remarks: string; date: string; status: string; }

export function DashboardPage() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await getDashboard();
      setStats([
        { label: 'Served Today', value: String(data.servedToday || 0), change: `${data.servedChange || '+0%'} from yesterday`, icon: TrendingUp, color: '#2E5C8A', bg: '#E8F0F7' },
        { label: 'Sync Status', value: 'All Synced', change: `Last sync: ${data.lastSync || '2m ago'}`, icon: RefreshCw, color: '#17A2B8', bg: '#E8F0F7' },
        { label: 'Pending Review', value: String(data.pendingReview || 0), change: `${data.urgentCount || 0} urgent`, icon: Clock, color: '#856404', bg: '#FFF3CD' },
        { label: 'Disbursed This Month', value: `₱${data.disbursedMonth || 0}`, change: `${data.beneficiaryCount || 0} beneficiaries`, icon: DollarSign, color: '#155724', bg: '#D4EDDA' },
      ]);
      setCases(data.recentCases || []);
    } catch {
      setStats([
        { label: 'Served Today', value: '0', change: 'N/A', icon: TrendingUp, color: '#2E5C8A', bg: '#E8F0F7' },
        { label: 'Sync Status', value: 'Offline', change: 'Check connection', icon: RefreshCw, color: '#17A2B8', bg: '#E8F0F7' },
        { label: 'Pending Review', value: '0', change: 'N/A', icon: Clock, color: '#856404', bg: '#FFF3CD' },
        { label: 'Disbursed This Month', value: '₱0', change: 'N/A', icon: DollarSign, color: '#155724', bg: '#D4EDDA' },
      ]);
    }
    setLoading(false);
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      approved: { bg: '#D4EDDA', color: '#155724', label: 'Approved' },
      pending_assessment: { bg: '#FFF3CD', color: '#856404', label: 'Pending' },
      disbursed: { bg: '#E2E3E5', color: '#383D41', label: 'Disbursed' },
      closed: { bg: '#F5F5F5', color: '#707070', label: 'Closed' },
    };
    const s = map[status] || map.pending_assessment;
    return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
  };

  if (loading) return <div className="p-8 text-center text-style-body">Loading dashboard...</div>;

  const navigate = useNavigate();
  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-desc">Overview of social welfare operations and metrics.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card" style={{ borderRadius: '12px', padding: '16px' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-style-label" style={{ color: '#707070', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
                <div className="ml-auto" style={{ background: s.bg, borderRadius: '9999px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={s.color} />
                </div>
              </div>
              <div className="stat-value" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#1A1A1A' }}>{s.value}</div>
              <div className="text-style-body" style={{ fontSize: '13px', color: s.color, marginTop: '4px' }}>{s.change}</div>
            </div>
          );
        })}
      </div>

      <div className="mb-4">
        <h3 className="text-style-heading" style={{ fontSize: '18px', marginBottom: '12px' }}>Recent Cases</h3>
      </div>

      <div className="table-container" style={{ borderRadius: '8px' }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th className="text-style-label" style={{ width: '120px' }}>Case ID</th>
                <th className="text-style-label">Name</th>
                <th className="text-style-label">Category</th>
                <th className="text-style-label">Barangay</th>
                <th className="text-style-label">Intervention/Remarks</th>
                <th className="text-style-label">Status</th>
                <th className="text-style-label frozen-col" style={{ minWidth: '140px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id}>
                  <td className="text-style-body" style={{ color: '#707070' }}>{c.id}</td>
                  <td className="text-style-body" style={{ fontWeight: 500, color: '#1A1A1A' }}>{c.name}</td>
                  <td><span className="badge-category">{c.category}</span></td>
                  <td className="text-style-body">{c.barangay}</td>
                  <td className="text-style-body" style={{ fontSize: '13px' }}>{c.remarks}</td>
                  <td>{statusBadge(c.status)}</td>
                  <td className="text-style-body frozen-col" style={{ fontSize: '13px', color: '#707070', minWidth: '140px' }}>{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>Showing {cases.length} recent cases</span>
          <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "13px" }} onClick={() => navigate("/cases")}>View All Cases</button>
        </div>
      </div>
    </div>
  );
}
