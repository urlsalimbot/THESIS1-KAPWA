import { useState } from 'react';
import useSWR from 'swr';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import UsersPanel from '@/components/UsersPanel';

interface Program {
  id: string; name: string; category: string; isActive: boolean;
  waitingPeriodDays: number; fundSources: string[];
}

interface SyncEntry {
  id: string; deviceId: string; tableName: string; operation: string;
  status: string; conflictReason: string; createdAt: string;
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<string>('programs');

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
                auditLogsArr.map((log, idx) => log && (
                  <div key={idx} className="mb-4 rounded bg-muted p-4 text-xs font-mono text-muted-foreground">
                    {log.generatedAt && (
                      <>
                        <p className="mb-2 font-semibold text-foreground">COA Export Report</p>
                        <p>Generated: {new Date(log.generatedAt).toLocaleString()}</p>
                        <p>Period: {log.period?.startDate} – {log.period?.endDate}</p>
                        <p>Total Interventions: {log.summary?.count || 0}</p>
                        <p>Total Amount: ₱{(log.summary?.totalAmount || 0).toLocaleString()}</p>
                        {log.interventions?.slice(0, 10).map((i: any) => (
                          <p key={i.id} className="pl-4">{i.type} · ₱{Number(i.amount || 0).toLocaleString()} · {i.date ? new Date(i.date).toLocaleDateString() : ''}</p>
                        ))}
                      </>
                    )}
                    {log.valid !== undefined && (
                      <>
                        <p className="mt-2 mb-1 font-semibold text-foreground">Hash Chain Verification</p>
                        <p className={log.valid ? 'text-green-600' : 'text-red-600'}>
                          {log.valid ? '✓ Hash chain integrity verified' : '✗ Hash chain broken!'} {log.brokenAt && `at ${log.brokenAt}`}
                        </p>
                      </>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
