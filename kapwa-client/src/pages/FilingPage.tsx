import React, { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Upload, Download, Trash2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Document {
  id: string; fileName: string; originalName: string; mimeType: string;
  fileSize: number; caseId: string; beneficiaryId: string; category: string;
  notes: string; uploadedBy: string; createdAt: string;
}

export function FilingPage() {
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

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
        await mutate(queryKeys.filing.all, undefined, { revalidate: true });
      }
    } catch (e) { console.error("FilingPage:", e); } finally { setUploading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.del(`/filing/${id}`);
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
        <Button asChild variant="default" className="gap-2" disabled={uploading}>
          <label className="cursor-pointer">
            <Upload size={16} />
            {uploading ? 'Uploading...' : 'Upload Document'}
            <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading} />
          </label>
        </Button>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
          <Input
            type="text"
            aria-label="Search documents"
            placeholder="Search documents..."
            className="w-full pl-9 h-9"
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
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-0 divide-y divide-border/60">
            {filtered.map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge variant="outline" className="font-mono text-[11px] uppercase shrink-0 px-2 py-1 rounded-md">
                    {d.mimeType?.split('/')[1] || 'FILE'}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.originalName}</p>
                    <p className="text-xs text-muted-foreground">{(d.fileSize / 1024).toFixed(1)} KB · {d.category} · {new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleDownload(d)} title="Download" aria-label="Download" className="h-8 w-8">
                    <Download size={15} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)} title="Delete" aria-label="Delete" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 size={15} />
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
