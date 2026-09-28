import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/PageShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsFilters, rangeToDates, type AnalyticsFilterValue } from '@/components/analytics/AnalyticsFilters';
import { DemographicsTab } from '@/components/analytics/DemographicsTab';
import { ClusteringTab } from '@/components/analytics/ClusteringTab';
import { ConcentrationTab } from '@/components/analytics/ConcentrationTab';
import { EquityTab } from '@/components/analytics/EquityTab';
import { InequalityTab } from '@/components/analytics/InequalityTab';
import { ForecastTab } from '@/components/analytics/ForecastTab';
import { AssociationsTab } from '@/components/analytics/AssociationsTab';

export function AnalyticsPage() {
  const { t } = useTranslation();
  const [filterValue, setFilterValue] = useState<AnalyticsFilterValue>({ range: '1y', barangay: '' });

  const dates = rangeToDates(filterValue.range);
  const filters: Record<string, unknown> = {
    ...dates,
    ...(filterValue.barangay ? { barangay: filterValue.barangay } : {}),
  };

  return (
    <PageShell
      title={t('analytics.title', 'Analytics')}
      description={t('analytics.description', 'Demographics, clustering, inequality, forecast, concentration, equity, and associations')}
    >
      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <AnalyticsFilters value={filterValue} onChange={setFilterValue} />
      </div>
      <Tabs defaultValue="demographics" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="demographics">{t('analytics.tabs.demographics', 'Demographics')}</TabsTrigger>
          <TabsTrigger value="clustering">{t('analytics.tabs.clustering', 'Clustering')}</TabsTrigger>
          <TabsTrigger value="concentration">{t('analytics.tabs.concentration', 'Concentration')}</TabsTrigger>
          <TabsTrigger value="equity">{t('analytics.tabs.equity', 'Equity')}</TabsTrigger>
          <TabsTrigger value="inequality">{t('analytics.tabs.inequality', 'Inequality')}</TabsTrigger>
          <TabsTrigger value="forecast">{t('analytics.tabs.forecast', 'Forecast')}</TabsTrigger>
          <TabsTrigger value="associations">{t('analytics.tabs.associations', 'Associations')}</TabsTrigger>
        </TabsList>
        <TabsContent value="demographics" className="mt-4"><DemographicsTab filters={filters} /></TabsContent>
        <TabsContent value="clustering" className="mt-4"><ClusteringTab filters={filters} /></TabsContent>
        <TabsContent value="concentration" className="mt-4"><ConcentrationTab filters={filters} /></TabsContent>
        <TabsContent value="equity" className="mt-4"><EquityTab filters={filters} /></TabsContent>
        <TabsContent value="inequality" className="mt-4"><InequalityTab filters={filters} /></TabsContent>
        <TabsContent value="forecast" className="mt-4"><ForecastTab filters={filters} /></TabsContent>
        <TabsContent value="associations" className="mt-4"><AssociationsTab filters={filters} /></TabsContent>
      </Tabs>
    </PageShell>
  );
}
