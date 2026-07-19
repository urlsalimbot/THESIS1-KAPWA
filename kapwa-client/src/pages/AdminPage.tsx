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
import { Activity, Database, FileText, Shield, Users, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

interface Program {
  id: string; name: string; category: string; isActive: boolean;
  waitingPeriodDays: number; fundSources: string[];
}

interface SyncEntry {
  id: string; deviceId: string; tableName: string; operation: string;
  status: string; conflictReason: string; createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; icon: typeof CheckCircle2; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  applied: { label: 'Applied', icon: CheckCircle2, variant: 'default' },
  pending: { label: 'Pending', icon: Clock, variant: 'secondary' },
  conflict: { label: 'Conflict', icon: AlertCircle, variant: 'destructive' },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' },
};

function TabIcon({ icon: Icon, active }: { icon: typeof Database; active: boolean }) {
  return <Icon size={16} className={active ? 'text-primary' : 'text-muted-foreground'} />;
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="programs" className="flex items-center gap-2">
            <TabIcon icon={FileText} active={activeTab === 'programs'} /> Programs
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <TabIcon icon={Users} active={activeTab === 'users'} /> Users
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <TabIcon icon={Activity} active={activeTab === 'sync'} /> Sync Queue
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <TabIcon icon={Database} active={activeTab === 'audit'} /> Audit Log
          </TabsTrigger>
          <TabsTrigger value="lcr" className="flex items-center gap-2">
            <TabIcon icon={Database} active={activeTab === 'lcr'} /> LCR Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-4 mt-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-primary/10 p-2">
                    <FileText size={18} className="text-primary" />
                  </div>
                  <CardTitle className="text-sm">Program Configurator</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">{programs.length} program{programs.length !== 1 ? 's' : ''}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : programs.length === 0 ? (
                <div className="py-8">
                  <EmptyState variant="no-data" />
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {programs.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.category}{p.waitingPeriodDays ? ` · ${p.waitingPeriodDays}d waiting` : ''}{p.fundSources?.length ? ` · ${p.fundSources.join(', ')}` : ''}
                        </p>
                      </div>
                      <Badge variant={p.isActive ? 'default' : 'secondary'} className="shrink-0 ml-3">
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-blue-500/10 p-2">
                  <Users size={18} className="text-blue-600" />
                </div>
                <CardTitle className="text-sm">User Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <UsersPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 mt-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-amber-500/10 p-2">
                    <Activity size={18} className="text-amber-600" />
                  </div>
                  <CardTitle className="text-sm">Sync Queue Monitor</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">{syncEntries.length} entr{syncEntries.length !== 1 ? 'ies' : 'y'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={4} />
              ) : syncEntries.length === 0 ? (
                <div className="py-8">
                  <EmptyState variant="no-data" />
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {syncEntries.map(e => {
                    const statusConfig = STATUS_MAP[e.status] || { label: e.status, icon: AlertCircle, variant: 'secondary' as const };
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div key={e.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-foreground">{e.tableName}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-mono text-muted-foreground">{e.operation}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">Device: {e.deviceId.slice(0, 8)}…</p>
                          {e.conflictReason && (
                            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertCircle size={12} />
                              {e.conflictReason}
                            </p>
                          )}
                        </div>
                        <Badge variant={statusConfig.variant} className="shrink-0 ml-3 gap-1">
                          <StatusIcon size={12} />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-slate-500/10 p-2">
                    <Database size={18} className="text-slate-600" />
                  </div>
                  <CardTitle className="text-sm">Audit Log (RA 10173 / COA)</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">{auditLogsArr.length} entr{auditLogsArr.length !== 1 ? 'ies' : 'y'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading audit data...</div>
              ) : auditLogsArr.length === 0 ? (
                <div className="py-8">
                  <EmptyState variant="no-data" />
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {auditLogsArr.map((log: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{log.action}</span>
                          <span className="text-xs text-muted-foreground">on</span>
                          <span className="text-xs font-mono text-muted-foreground">{log.recordId?.slice(0, 8)}…</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {log.data?.type}{log.data?.amount != null ? ` · ₱${Number(log.data.amount).toLocaleString()}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-3">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lcr" className="space-y-4 mt-6">
          <LcrImportTab />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
