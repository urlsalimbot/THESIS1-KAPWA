import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, Search } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Document {
  id: string; fileName: string; originalName: string; mimeType: string;
  fileSize: number; caseId: string; beneficiaryId: string; category: string;
  notes: string; uploadedBy: string; createdAt: string;
}

export function FilingPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadDocs(undefined, controller.signal);
    return () => controller.abort();
  }, []);

  async function loadDocs(category?: string, signal?: AbortSignal) {
    setLoading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const q = category ? `?category=${category}` : '';
      const res = await fetch(`${API_URL}/filing${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDocs(await res.json());
      setLastSync(Date.now());
    } catch (e) { console.error("FilingPage:", e); } finally { setLoading(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('kapwa_token');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'general');
      const res = await fetch(`${API_URL}/filing/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) loadDocs();
    } catch (e) { console.error("FilingPage:", e); } finally { setUploading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      const token = localStorage.getItem('kapwa_token');
      await fetch(`${API_URL}/filing/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      loadDocs();
    } catch (e) { console.error("FilingPage:", e); }
  }

  async function handleDownload(doc: Document) {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(`${API_URL}/filing/${doc.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = doc.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("FilingPage:", e); }
  }

  const filtered = docs.filter(d => !search || d.originalName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageShell
      title="Digital Filing"
      description="Upload and manage case documents, signatures, and attachments"
      cachedAt={lastSync ?? undefined}
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload Document'}
          <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
        </label>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
          <Input
            type="text"
            aria-label="Search documents"
            placeholder="Search documents..."
            className="w-full pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState variant={search ? 'no-results' : 'no-data'} />
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded bg-blue-50 p-2 text-blue-600 text-xs font-bold uppercase">
                    {d.mimeType?.split('/')[1] || 'FILE'}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.originalName}</p>
                    <p className="text-xs text-muted-foreground">{(d.fileSize / 1024).toFixed(1)} KB · {d.category} · {new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(d)} title="Download" aria-label="Download">
                    <Download size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} title="Delete" aria-label="Delete">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
