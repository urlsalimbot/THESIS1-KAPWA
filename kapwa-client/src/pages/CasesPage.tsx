import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Download, Search } from 'lucide-react';
import '../index.css';
import { getCases } from '../lib/api';

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

  const [filters, setFilters] = useState({ barangay: false, status: false, category: false } as { barangay: boolean; status: boolean; category: boolean });
  const toggleFilter = (key: keyof typeof filters) => setFilters({ ...filters, [key]: !filters[key] });

  if (loading) return <div className="p-8 text-center text-style-body">Loading cases...</div>;

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
          <button className="btn btn-primary">
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
        <span className="text-style-label" style={{ fontSize: '12px', textTransform: 'uppercase', color: '#707070' }}>FILTERS:</span>
        <button className={`filter-pill ${filters.barangay ? 'bg-[#E8F0F7] border-[#2E5C8A]' : ''}`} onClick={() => toggleFilter('barangay')}>
          Barangay
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
        <button className={`filter-pill ${filters.status ? 'bg-[#E8F0F7] border-[#2E5C8A]' : ''}`} onClick={() => toggleFilter('status')}>
          Status
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
        <button className={`filter-pill ${filters.category ? 'bg-[#E8F0F7] border-[#2E5C8A]' : ''}`} onClick={() => toggleFilter('category')}>
          Category
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </button>
        <button className="clear-btn">Clear Filters</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table className="table">
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
              {cases.filter(c => {
                if (search && !c.surname.toLowerCase().includes(search.toLowerCase()) && !c.first.toLowerCase().includes(search.toLowerCase())) return false;
                return true;
              }).map(c => (
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
          <span>Showing {cases.length} cases</span>
        </div>
      </div>
    </div>
  );
}
