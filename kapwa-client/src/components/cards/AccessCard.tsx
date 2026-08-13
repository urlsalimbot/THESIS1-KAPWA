import { useTranslation } from 'react-i18next';

interface AccessCardProps {
  beneficiary: {
    id: string;
    surname: string;
    firstName: string;
    barangay: string;
    accessCardCode: string;
  };
  services: Array<{
    id: string;
    serviceDate: string;
    serviceRendered: string;
    cost?: number;
    agency?: string;
    workerNameSign?: string;
  }>;
  printable?: boolean;
}

export function AccessCard({ beneficiary, services, printable = false }: AccessCardProps) {
  const { t } = useTranslation();
  return (
    <div className={`access-card ${printable ? 'print-version' : ''}`}>
      <div className="card-header">
        <h1 className="text-lg font-bold text-text-primary font-sans">{t('cards.accessCardTitle', 'MSWDO Norzagaray — Access Card')}</h1>
        <div className="card-code font-mono text-sm text-primary mt-1">
          {beneficiary.accessCardCode}
        </div>
      </div>
      <div className="card-body mt-4 space-y-1 text-sm">
        <p>
          <strong>{t('cards.name', 'Name:')}</strong> {beneficiary.surname}, {beneficiary.firstName}
        </p>
        <p>
          <strong>{t('cards.barangay', 'Barangay:')}</strong> {beneficiary.barangay}
        </p>
      </div>
      {services.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 italic">{t('cards.noServices', 'No services logged yet')}</p>
      ) : (
        <table className="service-log w-full mt-4 text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-wider text-gray-500">
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left py-2 pr-2">{t('cards.date', 'Date')}</th>
              <th className="text-left py-2 pr-2">{t('cards.service', 'Service')}</th>
              <th className="text-left py-2 pr-2">{t('cards.cost', 'Cost')}</th>
              <th className="text-left py-2">{t('cards.agency', 'Agency')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {services.map((s, i) => (
              <tr key={s.id} className="hover:bg-table-hover even:bg-table-stripe">
                <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-2 pr-2">{new Date(s.serviceDate).toLocaleDateString()}</td>
                <td className="py-2 pr-2">{s.serviceRendered}</td>
                <td className="py-2 pr-2">{s.cost != null ? `₱${s.cost.toLocaleString()}` : '-'}</td>
                <td className="py-2">{s.agency || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
