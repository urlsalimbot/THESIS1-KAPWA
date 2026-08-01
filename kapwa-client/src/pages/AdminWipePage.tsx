import { useState, useEffect } from 'react';
import { Smartphone, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface Device {
  id: string;
  email: string;
  deviceId: string;
}

export function AdminWipePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [confirmWipe, setConfirmWipe] = useState<{ type: 'user' | 'device'; id: string; label: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Device[]>('/admin/wipe/devices');
      setDevices(data || []);
    } catch { setDevices([]); }
    setLoading(false);
  }

  async function handleWipe() {
    if (!confirmWipe) return;
    try {
      if (confirmWipe.type === 'device') {
        await api.post(`/admin/wipe/device/${confirmWipe.id}`);
      } else {
        await api.post(`/admin/wipe/user/${confirmWipe.id}`);
      }
      setMsg(`Remote wipe initiated for ${confirmWipe.label}`);
      setConfirmWipe(null);
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Wipe failed');
    }
  }

  return (
    <PageShell title="Remote Device Wipe" description="FR-26 — Invalidate sessions and unlink devices">
      {msg && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4">{msg}</div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading devices...</div>
      ) : devices.length === 0 ? (
        <div className="rounded-lg border bg-card shadow-sm text-center py-12 text-muted-foreground">
          <Smartphone className="mx-auto mb-2" size={32} />
          <p>No bound devices found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.filter(d => d.deviceId).map(d => (
            <div key={d.id} className="rounded-lg border bg-card shadow-sm p-4 flex items-center justify-between">
              <div>
                <span className="font-semibold">{d.email}</span>
                <span className="ml-3 text-sm text-muted-foreground font-mono">{d.deviceId}</span>
              </div>
              <Button variant="destructive" size="sm"
                onClick={() => setConfirmWipe({ type: 'device', id: d.deviceId, label: d.email })}>
                <AlertTriangle size={14} className="mr-1" /> Wipe Device
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmWipe} onOpenChange={() => setConfirmWipe(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Remote Wipe</DialogTitle>
            <DialogDescription>
              This will invalidate all sessions and unlink the device for <strong>{confirmWipe?.label}</strong>.
              The user will be forced to re-authenticate. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmWipe(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleWipe}>Confirm Wipe</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
