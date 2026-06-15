import React, { useState } from 'react';
import { ArrowLeft, User, MapPin, Users as UsersIcon, Gift, FileText, Plus, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../index.css';

interface BeneficiaryDetail {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  gender: string;
  contact: string;
  barangay: string;
  purok: string;
  category: string;
  householdSize: number;
  status: string;
  cases: { id: string; program: string; status: string; date: string; amount?: string }[];
  interventions: { id: string; type: string; description: string; date: string }[];
}

export function BeneficiaryViewPage() {
  const navigate = useNavigate();
  const [b] = useState<BeneficiaryDetail>({
    id: 'BEN-001',
    name: 'Maria Santos',
    age: 45,
    birthDate: '1979-03-15',
    gender: 'Female',
    contact: '+63 912 345 6789',
    barangay: 'Bigte',
    purok: 'Purok 3',
    category: 'PWD',
    householdSize: 5,
    status: 'active',
    cases: [
      { id: 'KAP-2024-0003', program: 'Ayuda', status: 'approved', date: '2024-01-13', amount: '₱5,000' },
      { id: 'KAP-2024-0001', program: 'AKAP', status: 'disbursed', date: '2024-01-15', amount: '₱3,000' },
    ],
    interventions: [
      { id: 'INT-002', type: 'Cash Aid', description: '₱5,000 disbursed', date: '2024-01-19' },
    ],
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      approved: { bg: '#D4EDDA', color: '#155724', label: 'Approved' },
      disbursed: { bg: '#E2E3E5', color: '#383D41', label: 'Disbursed' },
      pending: { bg: '#FFF3CD', color: '#856404', label: 'Pending' },
      active: { bg: '#D4EDDA', color: '#155724', label: 'Active' },
      inactive: { bg: '#F5F5F5', color: '#707070', label: 'Inactive' },
    };
    const s = map[status] || map.pending;
    return <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>;
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button className="text-sm text-[#2E5C8A] hover:underline flex items-center gap-1" onClick={() => navigate('/beneficiaries')}>
          <ArrowLeft size={16} /> Back to Beneficiaries
        </button>
      </div>

      {/* Header Card */}
      <div className="card mb-4" style={{ borderRadius: '12px' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#E8F0F7] flex items-center justify-center">
              <User size={28} className="text-[#2E5C8A]" />
            </div>
            <div>
              <h2 className="page-title" style={{ fontSize: '20px', marginBottom: '4px' }}>{b.name}</h2>
              <p className="text-style-body" style={{ color: '#707070' }}>ID: {b.id} | {b.category}</p>
              <div className="flex items-center gap-3 mt-2">
                {statusBadge(b.status)}
                <span className="text-style-body" style={{ fontSize: '13px', color: '#707070' }}>
                  <MapPin size={14} className="inline mr-1" /> {b.barangay}, {b.purok}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary">
              <Edit size={16} /> Edit
            </button>
            <button className="btn btn-danger" style={{ background: '#DC3545', color: 'white' }}>
              <Trash2 size={16} /> Deactivate
            </button>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card" style={{ padding: '12px' }}>
          <span className="text-style-label">Age / Birth Date</span>
          <p className="text-style-body" style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>{b.age} years ({b.birthDate})</p>
        </div>
        <div className="card" style={{ padding: '12px' }}>
          <span className="text-style-label">Gender</span>
          <p className="text-style-body" style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>{b.gender}</p>
        </div>
        <div className="card" style={{ padding: '12px' }}>
          <span className="text-style-label">Contact</span>
          <p className="text-style-body" style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>{b.contact}</p>
        </div>
        <div className="card" style={{ padding: '12px' }}>
          <span className="text-style-label">Household Size</span>
          <p className="text-style-body" style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>
            <UsersIcon size={16} className="inline mr-1" /> {b.householdSize} members
          </p>
        </div>
        <div className="card" style={{ padding: '12px' }}>
          <span className="text-style-label">Barangay</span>
          <p className="text-style-body" style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>{b.barangay}</p>
        </div>
        <div className="card" style={{ padding: '12px' }}>
          <span className="text-style-label">Category</span>
          <p className="text-style-body" style={{ fontSize: '16px', fontWeight: 600, marginTop: '4px' }}>
            <Gift size={16} className="inline mr-1" /> {b.category}
          </p>
        </div>
      </div>

      {/* Cases Section */}
      <div className="card mb-4" style={{ borderRadius: '8px' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-style-heading" style={{ fontSize: '16px' }}>Cases ({b.cases.length})</h3>
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Plus size={14} /> New Case
          </button>
        </div>
        <table className="table" style={{ margin: '-16px', width: 'calc(100% + 32px)' }}>
          <thead>
            <tr>
              <th className="text-style-label">Case ID</th>
              <th className="text-style-label">Program</th>
              <th className="text-style-label">Status</th>
              <th className="text-style-label">Amount</th>
              <th className="text-style-label">Date</th>
              <th className="text-style-label">Actions</th>
            </tr>
          </thead>
          <tbody>
            {b.cases.map(c => (
              <tr key={c.id}>
                <td className="text-style-body" style={{ color: '#707070' }}>{c.id}</td>
                <td><span className="badge-category">{c.program}</span></td>
                <td>{statusBadge(c.status)}</td>
                <td className="text-style-body">{c.amount || '-'}</td>
                <td className="text-style-body" style={{ color: '#707070' }}>{c.date}</td>
                <td><button className="text-sm text-[#2E5C8A]">View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Interventions Section */}
      <div className="card" style={{ borderRadius: '8px' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-style-heading" style={{ fontSize: '16px' }}>Interventions ({b.interventions.length})</h3>
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
            <Plus size={14} /> Log Intervention
          </button>
        </div>
        <table className="table" style={{ margin: '-16px', width: 'calc(100% + 32px)' }}>
          <thead>
            <tr>
              <th className="text-style-label">ID</th>
              <th className="text-style-label">Type</th>
              <th className="text-style-label">Description</th>
              <th className="text-style-label">Date</th>
            </tr>
          </thead>
          <tbody>
            {b.interventions.map(i => (
              <tr key={i.id}>
                <td className="text-style-body" style={{ color: '#707070' }}>{i.id}</td>
                <td><span className="badge-category">{i.type}</span></td>
                <td className="text-style-body">{i.description}</td>
                <td className="text-style-body" style={{ color: '#707070' }}>{i.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
