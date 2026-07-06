import useSWR from 'swr';
import { TrendingUp, Users, DollarSign, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { queryKeys } from '@/lib/query-keys';

interface StatusDist {
  status: string;
  count: number;
}

interface MayorData {
  totalCases: number;
  uniqueHouseholds: number;
  fundUtilization: number;
  servedToday: number;
  caseStatusDistribution: StatusDist[];
  slaCompliance?: { slaStatus: string };
}

export function MayorWidgets() {
  const { data, isLoading: loading } = useSWR<MayorData>(queryKeys.dashboard.mayorReports());

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const dataOrEmpty: MayorData = data || { totalCases: 0, uniqueHouseholds: 0, fundUtilization: 0, servedToday: 0, caseStatusDistribution: [] };
  const stats = [
    { label: 'Total Cases', value: String(dataOrEmpty.totalCases || 0), icon: TrendingUp, color: 'bg-blue-50 text-blue-700' },
    { label: 'Unique Households', value: String(dataOrEmpty.uniqueHouseholds || 0), icon: Users, color: 'bg-green-100 text-green-800' },
    { label: 'Fund Utilization', value: `₱${(dataOrEmpty.fundUtilization || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-blue-50 text-cyan-600' },
    { label: 'Served Today', value: String(dataOrEmpty.servedToday || 0), icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
    { label: 'SLA Compliance', icon: CheckCircle, color: 'bg-green-100 text-green-800', value: 'Compliant' },
  ];

  const slaIcon = dataOrEmpty.slaCompliance?.slaStatus === 'compliant' ? CheckCircle : AlertTriangle;
  const slaColor = dataOrEmpty.slaCompliance?.slaStatus === 'compliant' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  stats[stats.length - 1] = {
    label: 'SLA Compliance',
    value: dataOrEmpty.slaCompliance?.slaStatus === 'compliant' ? 'Compliant' : 'Violated',
    icon: slaIcon,
    color: slaColor,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</span>
                  <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center ${s.color}`}>
                    <Icon size={16} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground font-heading">{s.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dataOrEmpty.caseStatusDistribution && dataOrEmpty.caseStatusDistribution.length > 0 && (
        <Card>
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold text-sm text-primary">Case Status Distribution</h3>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {dataOrEmpty.caseStatusDistribution.map((s, i) => (
                <div key={i} className="flex justify-between border-b py-1 text-sm">
                  <span className="text-muted-foreground">{s.status}</span>
                  <span className="font-semibold">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
