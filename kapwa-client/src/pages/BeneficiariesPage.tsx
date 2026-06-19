import { BARANGAYS } from '../lib/constants';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search, Loader2 } from 'lucide-react';
import '../index.css';
import { getBeneficiaries } from '../lib/api';

const CATEGORIES = ['All Categories', 'Senior', 'PWD', 'Child', 'Solo Parent', 'Indigenous', 'Others'];

interface Beneficiary { id: string; name: string; age: number; barangay: string; householdSize: number; programs: string[]; status: string; }

export function BeneficiariesPage() {
  const navigate = useNavigate();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  // Debounce search input — 300ms delay before triggering API call
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Fetch beneficiaries when debounced search, category, or barangay changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFetching(true);
      try {
        const params: Record<string, string> = {};
        if (debouncedSearch) params.search = debouncedSearch;
        if (categoryFilter) params.category = categoryFilter;
        if (barangayFilter && barangayFilter !== 'all') params.barangay = barangayFilter;

        const hasParams = Object.keys(params).length > 0;
        const data = await getBeneficiaries(hasParams ? params : undefined);
        if (cancelled) return;
        const mapped: Beneficiary[] = (data || []).map((b: Record<string, unknown>) => ({
          id: b.id as string,
          name: `${b.firstName as string || ''} ${b.surname as string || ''}`.trim(),
          age: b.dob ? new Date().getFullYear() - new Date(b.dob as string).getFullYear() : 0,
          barangay: ((b.address as string) || '')?.split(',').pop()?.trim() || '',
          householdSize: ((b.household as Record<string, unknown>)?.familyMembers as Array<unknown>)?.length || 1,
          programs: b.programs as string[] || [],
          status: b.consentStatus as string || 'active',
        }));
        setBeneficiaries(mapped);
      } catch {
        if (!cancelled) setBeneficiaries([]);
      }
      if (!cancelled) {
        setLoading(false);
        setFetching(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [debouncedSearch, categoryFilter, barangayFilter]);

  if (loading) return <div className="p-8 text-center text-style-body">Loading beneficiaries...</div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Beneficiaries</h2>
        <p className="page-desc">Manage beneficiary records and household data</p>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-primary" aria-label="+ New Beneficiary">+ New Beneficiary</button>
          <button className="btn btn-secondary" aria-label="Import CSV">Import CSV</button>
        </div>
        <div className="toolbar-right flex gap-2 items-center">
          {/* Search input with icon */}
          <div className="relative">
            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search beneficiaries"
              placeholder="Search by name..."
              className="form-input w-48 pl-8"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          {/* Category dropdown */}
          <select
            aria-label="Filter by category"
            className="form-select w-36"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c === 'All Categories' ? '' : c}>{c}</option>
            ))}
          </select>
          {/* Barangay dropdown */}
          <select aria-label="Filter by barangay" className="form-select w-40" value={barangayFilter} onChange={e => setBarangayFilter(e.target.value)}>
            <option value="all">All Barangays</option>
            {BARANGAYS.map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Results count / loading indicator */}
      {!loading && (
        <div className="px-4 py-2 text-sm text-gray-500 flex items-center gap-1">
          {fetching && <Loader2 size={14} className="animate-spin" />}
          {!fetching && beneficiaries.length > 0 && `Showing ${beneficiaries.length} result${beneficiaries.length !== 1 ? 's' : ''}`}
          {!fetching && beneficiaries.length > 0 && debouncedSearch && ` for "${debouncedSearch}"`}
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetching && beneficiaries.length === 0 ? (
        <div className="p-8 text-center text-style-body text-gray-400">
          No beneficiaries found
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Barangay</th>
                <th>Household</th>
                <th>Programs</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map(b => (
                <tr key={b.id}>
                  <td className="font-medium">{b.id}</td>
                  <td>{b.name}</td>
                  <td><span className="badge-age">{b.age}</span></td>
                  <td>{b.barangay}</td>
                  <td>{b.householdSize} members</td>
                  <td className="flex gap-1">{b.programs.map(p => <span key={p} className="badge-category">{p}</span>)}</td>
                  <td><span className={b.status === 'active' ? 'badge-approved' : 'badge-closed'}>{b.status}</span></td>
                  <td>
                    <button className="text-sm text-[#2E5C8A] flex items-center gap-1" onClick={() => navigate(`/beneficiaries/${b.id}`)} aria-label="View Beneficiary">
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
