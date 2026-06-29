import React, { useState, useEffect } from 'react';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Card, CardContent } from '@/components/ui/card';

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
  const [lastSync, setLastSync] = useState<number | null>(null);

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
        setLastSync(Date.now());
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

  if (loading) {
    return (
      <PageShell title="Daily Case Tracker" description="Case Tracker Log — 'God Database' tally">
        <CardGridSkeleton count={2} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Daily Case Tracker"
      description="Case Tracker Log — 'God Database' tally"
      cachedAt={lastSync ?? undefined}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Cases Logged</p>
            <p className="text-2xl font-bold text-primary">{stats.totalCasesLogged}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Today's Entries</p>
            <p className="text-2xl font-bold text-primary">{stats.todayEntries}</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Selector + Add Button */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Date:</label>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} aria-label="Tracker Date" className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
        <button onClick={() => setShowForm(!showForm)} className="ml-auto inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" aria-label="Add Entry">
          {showForm ? 'Cancel' : '+ Add Entry'}
        </button>
      </div>

      {/* Add Entry Form */}
      {showForm && (
        <form onSubmit={handleAddEntry} className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-3 font-semibold text-primary text-sm">New Tracker Entry</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground">Surname</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.surname} onChange={e => setForm({...form, surname: e.target.value})} aria-label="Surname" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">First Name</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} aria-label="First Name" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Middle Name</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.middleName} onChange={e => setForm({...form, middleName: e.target.value})} aria-label="Middle Name" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Gender</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} aria-label="Gender">
                <option value="M">M</option><option value="F">F</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Age Range</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.ageRange} onChange={e => setForm({...form, ageRange: e.target.value})} aria-label="Age Range">
                <option value="">Select</option>
                {AGE_RANGES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Category</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.clientCategory} onChange={e => setForm({...form, clientCategory: e.target.value})} aria-label="Client Category">
                <option value="">Select</option>
                {CLIENT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Barangay</label>
              <select className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.barangay} onChange={e => setForm({...form, barangay: e.target.value})} aria-label="Barangay">
                <option value="">Select</option>
                {BARANGAYS.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">Intervention</label>
              <input className="w-full rounded border border-input bg-background px-2 py-1 text-sm" value={form.interventionRemarks} onChange={e => setForm({...form, interventionRemarks: e.target.value})} placeholder="FA/C/CSR..." aria-label="Intervention" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="mt-3 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 disabled:opacity-50" aria-label="Save Entry">
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      )}

      {/* Entries Table */}
      {!loading && entries.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['#','Surname','First Name','Middle Name','Gender','Age Range','Category','Barangay','Intervention'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-muted/50">
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
      )}
    </PageShell>
  );
}
