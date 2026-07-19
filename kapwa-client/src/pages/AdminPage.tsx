import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import UsersPanel from '@/components/UsersPanel';
import { LcrImportTab } from '@/components/LcrImportTab';

interface Program {
  id: string; name: string; category: string; isActive: boolean;
  waitingPeriodDays: number; fundSources: string[];
}

interface SyncEntry {
  id: string; deviceId: string; tableName: string; operation: string;
  status: string; conflictReason: string; createdAt: string;
}

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'programs';
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  const { data: programsRaw, isLoading: loadingPrograms } = useSWR<Program[]>(
    activeTab === 'programs' ? queryKeys.admin.programs() : null,
  );
  const { data: syncEntriesRaw, isLoading: loadingSync } = useSWR<SyncEntry[]>(
    activeTab === 'sync' ? queryKeys.admin.syncEntries() : null,
  );
  const { data: auditLogs, isLoading: loadingAudit } = useSWR<unknown>(
    activeTab === 'audit' ? queryKeys.admin.auditLogs() : null,
  );
  const programs = programsRaw ?? [];
  const syncEntries = syncEntriesRaw ?? [];
  const auditLogsArr = Array.isArray(auditLogs) ? auditLogs as any[] : [];

  const loading =
    (activeTab === 'programs' && loadingPrograms) ||
    (activeTab === 'sync' && loadingSync) ||
    (activeTab === 'audit' && loadingAudit);

  const lastSync = Date.now();

  return (
    <PageShell
      title="Admin Panel"
      description="System configuration, users, and monitoring"
      cachedAt={lastSync ?? undefined}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="programs">📋 Programs</TabsTrigger>
          <TabsTrigger value="users">👥 Users</TabsTrigger>
          <TabsTrigger value="sync">🔄 Sync Queue</TabsTrigger>
          <TabsTrigger value="audit">📜 Audit Log</TabsTrigger>
          <TabsTrigger value="lcr">📋 LCR Import</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Program Configurator</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : programs.length === 0 ? (
                <EmptyState variant="no-data" />
              ) : (
                <div className="divide-y">
                  {programs.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category} · {p.waitingPeriodDays}d waiting · {p.fundSources?.join(', ')}</p>
                      </div>
                      <Badge variant={p.isActive ? 'default' : 'secondary'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <UsersPanel />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sync Queue Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : syncEntries.length === 0 ? (
                <EmptyState variant="no-data" />
              ) : (
                <div className="divide-y">
                  {syncEntries.map(e => (
                    <div key={e.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-mono">{e.tableName}.{e.operation}</p>
                        <p className="text-xs text-muted-foreground">Device: {e.deviceId.slice(0, 8)}…</p>
                        {e.conflictReason && <p className="text-xs text-amber-600">{e.conflictReason}</p>}
                      </div>
                      <Badge variant={
                        e.status === 'applied' ? 'default' :
                        e.status === 'conflict' ? 'destructive' :
                        'secondary'
                      }>{e.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Audit Log (RA 10173 / COA)</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading audit data...</div>
              ) : auditLogsArr.length === 0 ? (
                <EmptyState variant="no-data" />
              ) : (
                <div className="divide-y">
                  {auditLogsArr.map((log: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-xs font-mono">
                          <span className="font-semibold text-foreground">{log.action}</span>
                          <span className="text-muted-foreground"> on </span>
                          <span className="font-mono text-muted-foreground">{log.recordId?.slice(0, 8)}…</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {log.data?.type} · ₱{Number(log.data?.amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lcr" className="space-y-4">
          <LcrImportTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
