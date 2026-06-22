import { useState, useEffect } from 'react';
import { getCases, requestReview, disburseCase, closeCase, overrideCaseStatus } from '../lib/api';
import { Search, SlidersHorizontal, Download, AlertTriangle } from 'lucide-react';
import { isOnline } from '../lib/sync';
import { queueFsmTransition } from '../lib/offline-queue';
import '../index.css';

interface CaseRow {
  id: string;
  no: number;
  surname: string;
  first: string;
  middle: string;
  gender: string;
  ageRange: string;
  category: string;
  barangay: string;
  remarks: string;
  date: string;
  status: string;
  controlNo: string;
  slaOverdue?: boolean;
}

const STATUS_BADGES: Record<string, string> = {
  pending_assessment: 'badge-pending',
  in_review: 'badge-review',
  approved: 'badge-approved',
  disbursed: 'badge-disbursed',
  closed: 'badge-closed',
};

const STATUS_LABELS: Record<string, string> = {
  pending_assessment: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  disbursed: 'Disbursed',
  closed: 'Closed',
};

export function CasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState({ barangay: false, status: false, category: false });

  const role = localStorage.getItem('kapwa_role') || '';

  useEffect(() => {
    const controller = new AbortController();
    loadCases();
    return () => controller.abort();
  }, []);

  async function loadCases() {
    try {
      const data = await getCases();
      const mapped: CaseRow[] = (data || []).map((c: Record<string, unknown>, i: number) => {
        const ben = c.beneficiary as Record<string, unknown> || {};
        const dob = ben.dob as string;
        const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
        return {
          id: c.id as string,
          no: i + 1,
          surname: ben.surname as string || '',
          first: ben.firstName as string || '',
          middle: ben.middleName as string || '',
          gender: ben.gender as string || '',
          ageRange: dob ? (age < 18 ? '0-17' : age > 59 ? '60+' : '18-59') : '',
          category: (c.serviceRequested as string[])?.join(', ') || '',
          barangay: (ben.address as string || '')?.split(',').pop()?.trim() || '',
          remarks: c.remarks as string || '',
          date: c.updatedAt ? new Date(c.updatedAt as string).toLocaleString() : '',
          status: c.status as string || 'pending_assessment',
          controlNo: c.controlNo as string || '',
          slaOverdue: c.slaOverdue as boolean || false,
        };
      });
      setCases(mapped);
    } catch {
      setCases([]);
    }
    setLoading(false);
  }

  async function handleAction(action: string, caseId: string) {
    setActionLoading(caseId);
    try {
      switch (action) {
        case 'request-review':
          if (isOnline()) {
            await requestReview(caseId);
          } else {
            // D-04: pending→in_review allowed offline
            await queueFsmTransition(caseId, 'in_review');
            alert('Review request queued — will sync when online.');
          }
          break;
        case 'disburse':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await disburseCase(caseId);
          break;
        case 'close':
          if (!isOnline()) {
            alert('This action requires an internet connection.');
            setActionLoading(null);
            return;
          }
          await closeCase(caseId);
          break;
      }
      await loadCases();
    } catch (err) {
      console.error(`Action ${action} failed:`, err);
      alert(`Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setActionLoading(null);
  }

  const toggleFilter = (key: keyof typeof filters) =>
    setFilters({ ...filters, [key]: !filters[key] });

  const filteredCases = cases.filter(c => {
    if (search && !c.surname.toLowerCase().includes(search.toLowerCase()) && !c.first.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.barangay && !c.barangay) return false;
    if (filters.category && !c.category) return false;
    return true;
  });

  function exportCSV() {
    const headers = ['No.','Surname','First','Middle','Gender','Age Range','Category','Status','SLA','Barangay','Remarks','Date'];
    const rows = filteredCases.map(c => [c.no, c.surname, c.first, c.middle, c.gender, c.ageRange, c.category, STATUS_LABELS[c.status] || c.status, c.slaOverdue ? 'OVERDUE' : '', c.barangay, c.remarks, c.date]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url; a.download = 'cases-export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function renderActions(c: CaseRow) {
    const buttons: { action: string; label: string }[] = [];

    if (c.status === 'pending_assessment' && role === 'social_worker') {
      buttons.push({ action: 'request-review', label: 'Request Review' });
    }
    if (c.status === 'in_review' && role === 'admin') {
      // Approve button links to the existing approve flow — handled separately
    }
    if (c.status === 'approved' && role === 'admin') {
      buttons.push({ action: 'disburse', label: 'Disburse' });
    }
    if (c.status === 'disbursed' && (role === 'admin' || role === 'social_worker')) {
      buttons.push({ action: 'close', label: 'Close' });
    }

    if (buttons.length === 0) return <span className="text-gray-400 text-xs">—</span>;

    return (
      <div className="flex gap-1">
        {buttons.map(b => (
          <button
            key={b.action}
            className="btn btn-sm"
            disabled={actionLoading === c.id}
            onClick={() => handleAction(b.action, c.id)}
          >
            {actionLoading === c.id ? '...' : b.label}
          </button>
        ))}
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-style-body">Loading cases...</div>;

  const uniqueBarangays = [...new Set(cases.map(c => c.barangay).filter(Boolean))];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Case Tracker</h2>
        <p className="page-desc">Real-time view of processed interventions and logs.</p>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-secondary" aria-label="Filter cases">
            <SlidersHorizontal size={16} />
            Filter
          </button>
          <button className="btn btn-primary" onClick={exportCSV} aria-label="Export CSV">
            <Download size={16} />
            Export CSV
          </button>
        </div>
        <div className="toolbar-right">
          <div className="search-bar">
            <Search className="search-icon" size={20} stroke="#6B7280" />
            <input type="text" aria-label="Search cases" className="search-input" placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="filter-pills">
        <button className={`filter-pill ${filters.barangay ? 'active' : ''}`} onClick={() => toggleFilter('barangay')} aria-label="Filter by barangay">
          By Barangay {filters.barangay && `(${uniqueBarangays.length})`}
        </button>
        <button className={`filter-pill ${filters.category ? 'active' : ''}`} onClick={() => toggleFilter('category')} aria-label="Filter by category">
          By Category
        </button>
        {Object.values(filters).some(Boolean) && (
          <button className="filter-pill clear" onClick={() => setFilters({ barangay: false, status: false, category: false })} aria-label="Clear filters">
            Clear
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-12">No.</th>
              <th className="text-style-label">Surname</th>
              <th className="text-style-label">First</th>
              <th className="text-style-label">Middle</th>
              <th className="text-style-label">Gender</th>
              <th className="text-style-label">Age Range</th>
              <th className="text-style-label">Category</th>
              <th className="text-style-label">Status</th>
              <th className="text-style-label">SLA</th>
              <th className="text-style-label">Barangay</th>
              <th className="text-style-label">Intervention/Remarks</th>
              <th className="min-w-[140px]">Date</th>
              <th className="text-style-label">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.map(c => (
              <tr key={c.no}>
                <td className="text-gray-500">{c.no}</td>
                <td className="text-gray-900 font-medium">{c.surname}</td>
                <td className="text-style-body">{c.first}</td>
                <td className="text-gray-500">{c.middle}</td>
                <td className="text-style-body">{c.gender}</td>
                <td><span className="badge-age">{c.ageRange}</span></td>
                <td><span className="badge-category">{c.category}</span></td>
                <td>
                  <span className={STATUS_BADGES[c.status] || 'badge-pending'}>
                    {STATUS_LABELS[c.status] || c.status}
                  </span>
                </td>
                <td>
                  {c.slaOverdue ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      <AlertTriangle size={12} />
                      OVERDUE
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="text-style-body">{c.barangay}</td>
                <td className="text-xs">{c.remarks}</td>
                <td className="text-xs text-gray-500 min-w-[140px]">{c.date}</td>
                <td>{renderActions(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>Showing {filteredCases.length} cases</span>
      </div>
    </div>
  );
}
