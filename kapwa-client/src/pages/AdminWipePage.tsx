import { useState, useEffect } from 'react';
import { Smartphone, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';

interface Device {
  id: string;
  email: string;
  deviceId: string;
}

export function AdminWipePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Device[]>('/admin/wipe/devices');
      setDevices(data || []);
    } catch { setDevices([]); }
    setLoading(false);
  }

  async function handleWipe(type: 'user' | 'device', id: string, label: string) {
    try {
      if (type === 'device') {
        await api.post(`/admin/wipe/device/${id}`);
      } else {
        await api.post(`/admin/wipe/user/${id}`);
      }
      setMsg(`Remote wipe initiated for ${label}`);
      load();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Wipe failed');
    }
  }

  const [wipeInputs, setWipeInputs] = useState<Record<string, string>>({});
  const [wipeDialogOpen, setWipeDialogOpen] = useState<Record<string, boolean>>({});

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
              <AlertDialog open={wipeDialogOpen[d.id] ?? false} onOpenChange={open => {
                setWipeDialogOpen(prev => ({ ...prev, [d.id]: open }));
                if (!open) setWipeInputs(prev => ({ ...prev, [d.id]: '' }));
              }}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <AlertTriangle size={14} className="mr-1" /> Wipe Device
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Remote Wipe</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will invalidate all sessions and unlink the device for <strong>{d.email}</strong>.
                      The user will be forced to re-authenticate. This action cannot be undone.
                      Type <strong>WIPE</strong> to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Input
                    placeholder='Type "WIPE" to confirm'
                    value={wipeInputs[d.id] ?? ''}
                    onChange={e => setWipeInputs(prev => ({ ...prev, [d.id]: e.target.value }))}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={(wipeInputs[d.id] ?? '') !== 'WIPE'}
                      onClick={async () => {
                        await handleWipe('device', d.deviceId, d.email);
                        setWipeDialogOpen(prev => ({ ...prev, [d.id]: false }));
                        setWipeInputs(prev => ({ ...prev, [d.id]: '' }));
                      }}
                    >
                      Confirm Wipe
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
