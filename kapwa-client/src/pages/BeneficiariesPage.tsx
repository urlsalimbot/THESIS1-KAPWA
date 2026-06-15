import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import '../index.css';
import { getBeneficiaries } from '../lib/api';

interface Beneficiary { id: string; name: string; age: number; barangay: string; householdSize: number; programs: string[]; status: string; }

export function BeneficiariesPage() {
  const navigate = useNavigate();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await getBeneficiaries();
      const mapped: Beneficiary[] = (data || []).map((b: any) => ({
        id: b.id,
        name: `${b.firstName || ''} ${b.surname || ''}`.trim(),
        age: b.dob ? new Date().getFullYear() - new Date(b.dob).getFullYear() : 0,
        barangay: b.address?.split(',').pop()?.trim() || '',
        householdSize: b.household?.familyMembers?.length || 1,
        programs: b.programs || [],
        status: b.consentStatus || 'active',
      }));
      setBeneficiaries(mapped);
    } catch {
      setBeneficiaries([]);
    }
    setLoading(false);
  }

  const filtered = beneficiaries.filter(b => {
    if (search && !b.name.toLowerCase().includes(search.toLowerCase()) && !b.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (barangayFilter !== 'all' && b.barangay !== barangayFilter) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-center text-style-body">Loading beneficiaries...</div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Beneficiaries</h2>
        <p className="page-desc">Manage beneficiary records and household data</p>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <button className="btn btn-primary">+ New Beneficiary</button>
          <button className="btn btn-secondary">Import CSV</button>
        </div>
        <div className="toolbar-right flex gap-2">
          <input type="text" placeholder="Search..." className="form-input w-48" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-select w-40" value={barangayFilter} onChange={e => setBarangayFilter(e.target.value)}>
            <option value="all">All Barangays</option>
            {['Bigte','Matictic','Partida','San Mateo','Tigbe'].map(b => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>

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
            {filtered.map(b => (
              <tr key={b.id}>
                <td className="font-medium">{b.id}</td>
                <td>{b.name}</td>
                <td><span className="badge-age">{b.age}</span></td>
                <td>{b.barangay}</td>
                <td>{b.householdSize} members</td>
                <td className="flex gap-1">{b.programs.map(p => <span key={p} className="badge-category">{p}</span>)}</td>
                <td><span className={b.status === 'active' ? 'badge-approved' : 'badge-closed'}>{b.status}</span></td>
                <td>
                  <button className="text-sm text-[#2E5C8A] flex items-center gap-1" onClick={() => navigate(`/beneficiaries/${b.id}`)}>
                    <Eye size={14} /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
