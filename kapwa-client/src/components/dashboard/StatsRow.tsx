import { TrendingUp, Clock, DollarSign, Users, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

interface StatCardData {
  label: string;
  value: string;
  change: string;
  icon: React.ElementType;
  urgent?: boolean;
}

function StatCardItem({ stat }: { stat: StatCardData }) {
  const Icon = stat.icon;
  return (
    <Card className={`transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${stat.urgent ? 'ring-1 ring-destructive/30 bg-destructive/5' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</span>
          <div className={`ml-auto rounded-full w-8 h-8 flex items-center justify-center shadow-sm ${stat.urgent ? 'bg-red-100 text-red-700' : 'bg-muted'}`}>
            <Icon size={16} />
          </div>
        </div>
        <div className="text-2xl font-bold text-foreground font-heading tracking-tight tabular-nums mb-0.5">{stat.value}</div>
        <p className={`text-xs ${stat.urgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{stat.change}</p>
      </CardContent>
    </Card>
  );
}

interface StatsRowProps {
  servedToday: number;
  pendingReview: number;
  urgentCount: number;
  disbursedMonth: number;
  beneficiaryCount: number;
  recentInterventions: number;
}

export function StatsRow(data: StatsRowProps) {
  const { t } = useTranslation();
  const stats: StatCardData[] = [
    { label: t('dashboard.servedToday', 'Served Today'), value: String(data.servedToday), change: t('dashboard.fromYesterday', 'from yesterday'), icon: TrendingUp },
    { label: t('dashboard.pendingReview', 'Pending Review'), value: String(data.pendingReview), change: t('dashboard.casesPendingAssessment', 'cases pending assessment'), icon: Clock },
    { label: t('dashboard.overdueSla', 'Overdue SLA'), value: String(data.urgentCount), change: t('dashboard.exceeded72h', 'exceeded 72h window'), icon: AlertTriangle, urgent: data.urgentCount > 0 },
    { label: t('dashboard.disbursedMonth', 'Disbursed Month'), value: `₱${data.disbursedMonth.toLocaleString()}`, change: t('dashboard.households', '{{count}} households', { count: data.beneficiaryCount }), icon: DollarSign },
    { label: t('dashboard.householdsServed', 'Households Served'), value: String(data.beneficiaryCount), change: t('dashboard.uniqueHouseholdsChange', 'unique households'), icon: Users },
    { label: t('dashboard.recentInterventions', 'Recent Interventions'), value: String(data.recentInterventions), change: t('dashboard.last7Days', 'in last 7 days'), icon: Activity },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {stats.map(s => <StatCardItem key={s.label} stat={s} />)}
    </div>
  );
}
