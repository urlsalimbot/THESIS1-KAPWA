import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, RefreshCw, ArrowLeft, AlertCircle } from 'lucide-react';
import { PageShell } from '@/components/PageShell';

export function MyAccessCardPage() {
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadCard();
  }, []);

  async function loadCard() {
    try {
      const token = localStorage.getItem('kapwa_token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/beneficiaries/me/access-card`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        if (res.status === 404) setError('No Access Card found. Please contact the MSWDO office.');
        else throw new Error('Failed to load');
        return;
      }
      setCard(await res.json());
    } catch {
      setError('Failed to load Access Card. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Access Card...</div>;

  if (error) {
    return (
      <PageShell
        title="My Access Card"
        description="Your KAPWA Access Card — read-only view"
      >
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => navigate('/my-dashboard')} className="text-blue-600 text-sm underline">Back to Dashboard</button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="My Access Card"
      description="Your KAPWA Access Card — read-only view"
    >

      <div className="no-print flex gap-2 mb-4">
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-dark">
          <Printer size={14} /> Print Card
        </button>
        <button onClick={() => navigate('/my-dashboard')} className="flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>

      <div className="rounded-lg border bg-white p-6 max-w-lg">
        <div className="text-center mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">KAPWA Access Card</p>
          <p className="text-lg font-bold text-primary font-mono">{card?.code}</p>
        </div>
        <div className="border-t pt-4 mb-4">
          <p className="text-sm"><span className="text-gray-500">Name:</span> <span className="font-medium">{card?.beneficiary?.name}</span></p>
          <p className="text-sm"><span className="text-gray-500">Barangay:</span> <span className="font-medium">{card?.beneficiary?.barangay}</span></p>
          <p className="text-sm"><span className="text-gray-500">Remaining Service Slots:</span> <span className="font-medium">{card?.remainingSlots}/18</span></p>
        </div>

        {card?.services?.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-primary mb-2">Service Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="text-left py-1">Date</th>
                    <th className="text-left py-1">Service</th>
                    <th className="text-left py-1">Agency</th>
                  </tr>
                </thead>
                <tbody>
                  {card.services.map((s: any, i: number) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1">{new Date(s.service_date).toLocaleDateString()}</td>
                      <td className="py-1">{s.service_rendered}</td>
                      <td className="py-1">{s.agency || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
