import React, { useState, useEffect } from 'react';
import '../index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

import { BARANGAYS, AGE_RANGES, CLIENT_CATEGORIES } from '../lib/constants';

interface TrackerEntry {
  id: string;
  dailySeqNum: number;
  transactionDate: string;
  surname: string;
  firstName: string;
  middleName: string;
  gender: string;
  ageRange: string;
  clientCategory: string;
  barangay: string;
  interventionRemarks: string;
}

export function CaseTrackerPage() {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ totalCasesLogged: 0, todayEntries: 0 });
  const [form, setForm] = useState({
    surname: '', firstName: '', middleName: '', gender: 'M',
    ageRange: '' as string, clientCategory: '' as string,
    barangay: '', interventionRemarks: '',
  });
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    fetchEntries(ac.signal);
    fetchStats(ac.signal);
    return () => ac.abort();
  }, [selectedDate]);

  async function fetchEntries(signal?: AbortSignal) {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/tracker/daily?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (e) { console.error("CaseTracker:", e); } finally {
      setLoading(false);
    }
  }

  async function fetchStats(signal?: AbortSignal) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/tracker/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) { console.error("CaseTracker:", e); }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const payload = {
        transactionDate: selectedDate,
        ...form,
      };
      const res = await fetch(`${API_URL}/tracker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchEntries();
        await fetchStats();
        setForm({ surname: '', firstName: '', middleName: '', gender: 'M', ageRange: '', clientCategory: '', barangay: '', interventionRemarks: '' });
        setShowForm(false);
      }
    } catch (e) { console.error("CaseTracker:", e); }
    finally { setSubmitting(false); }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary font-sans">Daily Case Tracker</h2>
        <p className="text-sm text-gray-500">Case Tracker Log — 'God Database' tally</p>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Cases Logged</p>
          <p className="text-2xl font-bold text-primary">{stats.totalCasesLogged}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Today's Entries</p>
          <p className="text-2xl font-bold text-primary">{stats.todayEntries}</p>
        </div>
      </div>

      {/* Date Selector + Add Button */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Date:</label>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} aria-label="Tracker Date" className="rounded border border-gray-300 px-3 py-1.5 text-sm" />
        <button onClick={() => setShowForm(!showForm)} className="ml-auto rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark" aria-label="Add Entry">
          {showForm ? 'Cancel' : '+ Add Entry'}
        </button>
      </div>

      {/* Add Entry Form */}
      {showForm && (
        <form onSubmit={handleAddEntry} className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 font-semibold text-primary text-sm">New Tracker Entry</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500">Surname</label>
              <input className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.surname} onChange={e => setForm({...form, surname: e.target.value})} aria-label="Surname" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">First Name</label>
              <input className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} aria-label="First Name" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Middle Name</label>
              <input className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.middleName} onChange={e => setForm({...form, middleName: e.target.value})} aria-label="Middle Name" />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Gender</label>
              <select className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} aria-label="Gender">
                <option value="M">M</option><option value="F">F</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Age Range</label>
              <select className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.ageRange} onChange={e => setForm({...form, ageRange: e.target.value})} aria-label="Age Range">
                <option value="">Select</option>
                {AGE_RANGES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Category</label>
              <select className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.clientCategory} onChange={e => setForm({...form, clientCategory: e.target.value})} aria-label="Client Category">
                <option value="">Select</option>
                {CLIENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Barangay</label>
              <select className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.barangay} onChange={e => setForm({...form, barangay: e.target.value})} aria-label="Barangay">
                <option value="">Select</option>
                {BARANGAYS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Intervention</label>
              <input className="w-full rounded border border-gray-300 px-2 py-1 text-sm" value={form.interventionRemarks} onChange={e => setForm({...form, interventionRemarks: e.target.value})} placeholder="FA/C/CSR..." aria-label="Intervention" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="mt-3 rounded bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50" aria-label="Save Entry">
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      )}

      {/* Entries Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['#','Surname','First Name','Middle Name','Gender','Age Range','Category','Barangay','Intervention'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No entries for this date</td></tr>
            ) : entries.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{e.dailySeqNum}</td>
                <td className="px-3 py-2">{e.surname}</td>
                <td className="px-3 py-2">{e.firstName}</td>
                <td className="px-3 py-2">{e.middleName}</td>
                <td className="px-3 py-2">{e.gender}</td>
                <td className="px-3 py-2">{e.ageRange}</td>
                <td className="px-3 py-2">{e.clientCategory}</td>
                <td className="px-3 py-2">{e.barangay}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.interventionRemarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
