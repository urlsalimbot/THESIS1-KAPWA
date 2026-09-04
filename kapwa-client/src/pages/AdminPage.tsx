import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { TableSkeleton } from '@/components/skeletons/TableSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/data-table/DataTable';
import { api } from '../lib/api';
import UsersPanel from '@/components/UsersPanel';
import { Activity, Database, Users, Clock, AlertCircle, CheckCircle2, XCircle, UserPlus, RefreshCw } from 'lucide-react';

interface SyncEntry {
  id: string; deviceId: string; tableName: string; operation: string;
  status: string; conflictReason: string; createdAt: string;
}

const STATUS_MAP: Record<string, { labelKey: string; label: string; icon: typeof CheckCircle2; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  applied: { labelKey: 'admin.syncApplied', label: 'Applied', icon: CheckCircle2, variant: 'default' },
  pending: { labelKey: 'admin.syncPending', label: 'Pending', icon: Clock, variant: 'secondary' },
  conflict: { labelKey: 'admin.syncConflict', label: 'Conflict', icon: AlertCircle, variant: 'destructive' },
  failed: { labelKey: 'admin.syncFailed', label: 'Failed', icon: XCircle, variant: 'destructive' },
};

function TabIcon({ icon: Icon, active }: { icon: typeof Database; active: boolean }) {
  return <Icon size={16} className={active ? 'text-primary' : 'text-muted-foreground'} />;
}

export function AdminPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'users';
  const setActiveTab = (tab: string) => setSearchParams({ tab }, { replace: true });
  const [auditFilter, setAuditFilter] = useState('all');
  const [auditVersion, setAuditVersion] = useState(0);
  const [auditPagination, setAuditPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [auditSorting, setAuditSorting] = useState<SortingState>([]);

  const { data: syncEntriesRaw, isLoading: loadingSync } = useSWR<SyncEntry[]>(
    activeTab === 'sync' ? queryKeys.admin.syncEntries() : null,
  );
  const { data: auditLogs, isLoading: loadingAudit, mutate: revalidateAudit } = useSWR<unknown[]>(
    activeTab === 'audit' ? [...queryKeys.admin.auditLogs(), auditFilter, auditVersion] : null,
    () => {
      const params = new URLSearchParams();
      if (auditFilter !== 'all') params.set('table', auditFilter);
      const qs = params.toString();
      return api.get<unknown[]>(`/audit/logs${qs ? `?${qs}` : ''}`);
    },
  );
  const syncEntries = syncEntriesRaw ?? [];
  const auditLogsArr = auditLogs ?? [];

  const loading =
    (activeTab === 'sync' && loadingSync) ||
    (activeTab === 'audit' && loadingAudit);

  const lastSync = Date.now();

  const auditColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'created_at',
      header: t('audit.dateTime', 'Date / Time'),
      cell: ({ row }) => <span className="text-xs tabular-nums">{new Date(row.original.created_at).toLocaleString()}</span>,
    },
    {
      accessorKey: 'action',
      header: t('audit.action', 'Action'),
      cell: ({ row }) => <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium font-mono">{row.original.action}</span>,
    },
    {
      accessorKey: 'user_name',
      header: t('audit.user', 'User'),
      cell: ({ row }) => row.original.user_name
        ? <span className="text-sm">{row.original.user_name}</span>
        : <span className="text-xs text-muted-foreground italic">system</span>,
    },
    {
      accessorKey: 'user_email',
      header: t('audit.email', 'Email'),
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.user_email || '—'}</span>,
    },
    {
      accessorKey: 'reference_id',
      header: t('audit.record', 'Record'),
      cell: ({ row }) => row.original.reference_id
        ? <span className="text-xs font-mono">{String(row.original.reference_id).slice(0, 12)}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'details',
      header: t('audit.details', 'Details'),
      cell: ({ row }) => {
        const d = row.original.details;
        if (!d) return <span className="text-xs text-muted-foreground">—</span>;
        const s = typeof d === 'string' ? d : JSON.stringify(d);
        return <span className="text-xs text-muted-foreground" title={s}>{s.length > 60 ? `${s.slice(0, 60)}…` : s}</span>;
      },
    },
  ];

  const AUDIT_ACTIONS = ['beneficiary', 'case', 'irf', 'access_card', 'announcement', 'user', 'program'];

  return (
    <PageShell
      title={t('admin.title', 'Admin Panel')}
      description={t('admin.description', 'System configuration, users, and monitoring')}
      cachedAt={lastSync ?? undefined}
    >
      <div className="mx-auto w-full max-w-7xl">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <TabIcon icon={Users} active={activeTab === 'users'} /> {t('admin.users', 'Users')}
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <TabIcon icon={Activity} active={activeTab === 'sync'} /> {t('admin.syncQueue', 'Sync Queue')}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <TabIcon icon={Database} active={activeTab === 'audit'} /> {t('admin.auditLog', 'Audit Log')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-500/10 p-2">
                <Users size={18} className="text-blue-600" />
              </div>
              <h2 className="text-sm font-semibold">{t('admin.userManagement', 'User Management')}</h2>
            </div>
            <Button size="sm" onClick={() => navigate('/admin/users/new')}>
              <UserPlus size={14} className="mr-1.5" /> {t('usersPanel.newUser', 'New User')}
            </Button>
          </div>
          <UsersPanel />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 mt-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-amber-500/10 p-2">
                    <Activity size={18} className="text-amber-600" />
                  </div>
                  <CardTitle className="text-sm">{t('admin.syncQueueMonitor', 'Sync Queue Monitor')}</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">{t('admin.entryCount', '{{count}} entr{{suffix}}', { count: syncEntries.length, suffix: syncEntries.length !== 1 ? 'ies' : 'y' })}</Badge>
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
                    const statusConfig = STATUS_MAP[e.status] || { labelKey: 'admin.syncPending', label: e.status, icon: AlertCircle, variant: 'secondary' as const };
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div key={e.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium text-foreground">{e.tableName}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-mono text-muted-foreground">{e.operation}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t('admin.device', 'Device: {{id}}…', { id: e.deviceId.slice(0, 8) })}</p>
                          {e.conflictReason && (
                            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertCircle size={12} />
                              {e.conflictReason}
                            </p>
                          )}
                        </div>
                        <Badge variant={statusConfig.variant} className="shrink-0 ml-3 gap-1">
                          <StatusIcon size={12} />
                          {t(statusConfig.labelKey, statusConfig.label)}
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
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-slate-500/10 p-2">
                    <Database size={18} className="text-slate-600" />
                  </div>
                  <CardTitle className="text-sm">{t('admin.auditLogTitle', 'Audit Log (RA 10173 / COA)')}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={auditFilter} onValueChange={(v) => { setAuditFilter(v); setAuditVersion(x => x + 1); }}>
                    <SelectTrigger aria-label={t('admin.filterAudit', 'Filter by action')} className="h-8 w-44 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('admin.allActions', 'All actions')}</SelectItem>
                      {AUDIT_ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => revalidateAudit()} aria-label={t('admin.refresh', 'Refresh')}>
                    <RefreshCw size={13} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={5} />
              ) : auditLogsArr.length === 0 ? (
                <div className="py-8">
                  <EmptyState variant="no-data" />
                </div>
              ) : (
                <DataTable columns={auditColumns} data={auditLogsArr} rowCount={auditLogsArr.length} pagination={auditPagination} sorting={auditSorting} onPaginationChange={setAuditPagination} onSortingChange={setAuditSorting} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </PageShell>
  );
}
