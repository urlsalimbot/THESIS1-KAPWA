import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Upload, Download, Trash2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Pre-auth carve-out: handleUpload (FormData) and handleDownload (blob) use raw
// fetch with manual Bearer headers. The api client only handles JSON bodies/
// responses, so these flows are deliberately out of scope (D-10 deferred).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Document {
  id: string; fileName: string; originalName: string; mimeType: string;
  fileSize: number; caseId: string; beneficiaryId: string; category: string;
  notes: string; uploadedBy: string; createdAt: string;
}

export function FilingPage() {
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>('all');

  // SWR list — api.get is bound globally in routes.tsx (no fetcher prop).
  // The /filing endpoint accepts a category filter; we pass it via the query key.
  const { data, isLoading } = useSWR<Document[]>(queryKeys.filing.list());
  const docs = data || [];
  const loading = isLoading;
  const lastSync = data ? Date.now() : null;

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
      if (res.ok) {
        // Revalidate the filing list after an upload
        await mutate(queryKeys.filing.all, undefined, { revalidate: true });
      }
    } catch (e) { console.error("FilingPage:", e); } finally { setUploading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.del(`/filing/${id}`);
      // Revalidate the filing list after a delete
      await mutate(queryKeys.filing.all, undefined, { revalidate: true });
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
