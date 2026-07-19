import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, AlertCircle, CreditCard, Hash, ClipboardList } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { queryKeys } from '../lib/query-keys';
import { ApiError } from '../lib/api-error';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

function SectionHeader({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <h2 className="text-sm font-semibold">{title}</h2>
    </div>
  );
}

export function MyAccessCardPage() {
  const navigate = useNavigate();
  const { data: card, error, isLoading } = useSWR(queryKeys.beneficiaries.myAccessCard());

  if (isLoading) {
    return (
      <PageShell title="My Access Card" description="Your KAPWA Access Card — read-only view"
        backTo={{ label: 'Back to Dashboard', onClick: () => navigate('/my-dashboard') }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CreditCard size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Loading Access Card...</p>
        </div>
      </PageShell>
    );
  }

  if (error) {
    const displayError = error instanceof ApiError && error.status === 404
      ? 'No Access Card found. Please contact the MSWDO office.'
      : 'Failed to load Access Card. Please try again.';
    return (
      <PageShell title="My Access Card" description="Your KAPWA Access Card — read-only view"
        backTo={{ label: 'Back to Dashboard', onClick: () => navigate('/my-dashboard') }}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle size={48} className="text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">{displayError}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/my-dashboard')}>
            <ArrowLeft size={14} className="mr-1" /> Back to Dashboard
          </Button>
        </div>
      </PageShell>
    );
  }

  const slotPercentage = card?.remainingSlots != null ? Math.round((card.remainingSlots / 18) * 100) : 0;

  return (
    <PageShell
      title="My Access Card"
      description="Your KAPWA Access Card — read-only view"
      backTo={{ label: 'Back to Dashboard', onClick: () => navigate('/my-dashboard') }}
      actions={
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={14} className="mr-1" /> Print Card
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">

        {/* Card preview — 2/3 */}
        <div className="md:col-span-2 space-y-4">

          {/* Access Card */}
          <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-primary/[0.02]">
            <div className="px-5 py-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">KAPWA Access Card</p>
                  <p className="text-xl font-bold font-mono text-primary tracking-tight">{card?.code}</p>
                </div>
                <CreditCard size={20} className="text-muted-foreground/40" />
              </div>
              <Separator className="mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-muted-foreground">Name</span>
                  <p className="font-medium">{card?.beneficiary?.name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Barangay</span>
                  <p className="font-medium">{card?.beneficiary?.barangay}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Service Log */}
          {card?.services?.length > 0 && (
            <div className="rounded-lg border bg-card">
              <SectionHeader title="Service Log" icon={<ClipboardList size={16} />} />
              <Separator />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-left px-4 py-2 font-medium">Service</th>
                      <th className="text-left px-4 py-2 font-medium">Agency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {card.services.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2">{new Date(s.service_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">{s.service_rendered}</td>
                        <td className="px-4 py-2">{s.agency || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">

          {/* Card Details */}
          <div className="rounded-lg border bg-card">
            <SectionHeader title="Details" icon={<Hash size={16} />} />
            <Separator />
            <div className="px-4 py-3 space-y-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Remaining Slots</span>
                <p className="font-medium">{card?.remainingSlots ?? '—'} / 18</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Utilization</span>
                <p className="font-medium">{slotPercentage}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
