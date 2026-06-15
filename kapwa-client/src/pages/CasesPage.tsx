import React, { useState, useEffect } from 'react';
import { getCases } from '../lib/api';
import { Search, SlidersHorizontal, Download } from 'lucide-react';
import '../index.css';

interface CaseRow {
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
}

export function CasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ barangay: false, status: false, category: false });

  useEffect(() => { loadCases(); }, []);

  async function loadCases() {
    try {
      const data = await getCases();
      const mapped: CaseRow[] = (data || []).map((c: any, i: number) => ({
        no: i + 1,
        surname: c.beneficiary?.surname || '',
        first: c.beneficiary?.firstName || '',
        middle: c.beneficiary?.middleName || '',
        gender: c.beneficiary?.gender || '',
        ageRange: c.beneficiary?.dob ? (new Date().getFullYear() - new Date(c.beneficiary.dob).getFullYear() < 18 ? '0-17' : new Date().getFullYear() - new Date(c.beneficiary.dob).getFullYear() > 59 ? '60+' : '18-59') : '',
        category: c.serviceRequested?.join(', ') || '',
        barangay: c.beneficiary?.address?.split(',').pop()?.trim() || '',
        remarks: c.remarks || '',
        date: c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '',
      }));
      setCases(mapped);
    } catch {
      setCases([]);
    }
    setLoading(false);
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
    const headers = ['No.','Surname','First','Middle','Gender','Age Range','Category','Barangay','Remarks','Date'];
    const rows = filteredCases.map(c => [c.no, c.surname, c.first, c.middle, c.gender, c.ageRange, c.category, c.barangay, c.remarks, c.date]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url; a.download = 'cases-export.csv'; a.click();
    URL.revokeObjectURL(url);
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
          <button className="btn btn-secondary">
            <SlidersHorizontal size={16} />
            Filter
          </button>
          <button className="btn btn-primary" onClick={exportCSV}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
        <div className="toolbar-right">
          <div className="search-bar">
            <Search className="search-icon" size={20} stroke="#6B7280" />
            <input type="text" className="search-input" placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="filter-pills">
        <button className={`filter-pill ${filters.barangay ? 'active' : ''}`} onClick={() => toggleFilter('barangay')}>
          By Barangay {filters.barangay && `(${uniqueBarangays.length})`}
        </button>
        <button className={`filter-pill ${filters.category ? 'active' : ''}`} onClick={() => toggleFilter('category')}>
          By Category
        </button>
        {Object.values(filters).some(Boolean) && (
          <button className="filter-pill clear" onClick={() => setFilters({ barangay: false, status: false, category: false })}>
            Clear
          </button>
        )}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-style-label" style={{ width: '50px' }}>No.</th>
              <th className="text-style-label">Surname</th>
              <th className="text-style-label">First</th>
              <th className="text-style-label">Middle</th>
              <th className="text-style-label">Gender</th>
              <th className="text-style-label">Age Range</th>
              <th className="text-style-label">Category</th>
              <th className="text-style-label">Barangay</th>
              <th className="text-style-label">Intervention/Remarks</th>
              <th className="text-style-label frozen-col" style={{ minWidth: '140px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.map(c => (
              <tr key={c.no}>
                <td className="text-style-body" style={{ color: '#707070' }}>{c.no}</td>
                <td className="text-style-body" style={{ color: '#1A1A1A', fontWeight: 500 }}>{c.surname}</td>
                <td className="text-style-body">{c.first}</td>
                <td className="text-style-body" style={{ color: '#707070' }}>{c.middle}</td>
                <td className="text-style-body">{c.gender}</td>
                <td><span className="badge-age">{c.ageRange}</span></td>
                <td><span className="badge-category">{c.category}</span></td>
                <td className="text-style-body">{c.barangay}</td>
                <td className="text-style-body" style={{ fontSize: '13px' }}>{c.remarks}</td>
                <td className="text-style-body frozen-col" style={{ fontSize: '13px', color: '#707070', minWidth: '140px' }}>{c.date}</td>
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
