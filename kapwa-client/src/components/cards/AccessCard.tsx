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
  return (
    <div className={`access-card ${printable ? 'print-version' : ''}`}>
      <div className="card-header">
        <h1 className="text-lg font-bold text-[#1A1A1A] font-sans">MSWDO Norzagaray — Access Card</h1>
        <div className="card-code font-mono text-sm text-[#2E5C8A] mt-1">
          {beneficiary.accessCardCode}
        </div>
      </div>
      <div className="card-body mt-4 space-y-1 text-sm">
        <p>
          <strong>Name:</strong> {beneficiary.surname}, {beneficiary.firstName}
        </p>
        <p>
          <strong>Barangay:</strong> {beneficiary.barangay}
        </p>
      </div>
      {services.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 italic">No services logged yet</p>
      ) : (
        <table className="service-log w-full mt-4 text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase text-gray-500">
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left py-2 pr-2">Date</th>
              <th className="text-left py-2 pr-2">Service</th>
              <th className="text-left py-2 pr-2">Cost</th>
              <th className="text-left py-2">Agency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {services.map((s, i) => (
              <tr key={s.id} className="hover:bg-gray-50 even:bg-[#F5F5F5]">
                <td className="py-2 pr-2 text-gray-600">{i + 1}</td>
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
