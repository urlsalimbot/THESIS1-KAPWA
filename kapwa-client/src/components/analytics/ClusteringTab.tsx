import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import { Download, Play, Users } from 'lucide-react';
import { api, downloadAnalyticsCsv } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MethodologyNote } from './MethodologyNote';

interface RunSummary {
  id: string;
  status: string;
  params?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  createdAt: string;
}
interface BarangayMixEntry { barangay: string; count: MixCount }
type MixCount = number | { value: number } | { suppressed: true };
interface ClusterProfile { barangay_mix?: BarangayMixEntry[]; [key: string]: unknown }
interface RunDetail {
  run: RunSummary;
  clusters: Array<{ clusterIndex: number; size: number | { suppressed: true }; profile?: ClusterProfile }>;
}
interface MemberRow {
  householdId: string;
  clusterIndex: number;
  distance?: number;
  barangay?: string;
}
interface RunMembers {
  rows: MemberRow[];
  total: number;
}

function cellValueText(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object' && 'suppressed' in (value as object)) return '—';
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num.toLocaleString() : String(value);
}

function CellValue({ value }: { value: unknown }) {
  return <>{cellValueText(value)}</>;
}

/** Server mix counts arrive as raw numbers or suppressed-cell wrappers. */
function mixCountValue(count: MixCount): number | null {
  if (typeof count === 'number') return count;
  return 'value' in count ? count.value : null;
}

/** Compact stacked-list rendering of a cluster's top-3 barangay mix. */
function BarangayMix({ entries }: { entries: BarangayMixEntry[] }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...entries.map(entry => mixCountValue(entry.count) ?? 0));
  return (
    <div className="pt-1">
      <p className="text-[10px] font-medium text-muted-foreground">{t('analytics.clustering.barangayMix', 'Barangay mix')}</p>
      <div className="space-y-0.5">
        {entries.map(entry => {
          const count = mixCountValue(entry.count);
          return (
            <div key={entry.barangay} className="flex items-center gap-1">
              <span className="w-20 truncate text-[10px] text-muted-foreground" title={entry.barangay}>{entry.barangay}</span>
              <span className="h-1.5 flex-1 rounded bg-muted">
                <span
                  className="block h-1.5 rounded bg-primary"
                  style={{ width: `${count != null ? (count / max) * 100 : 0}%` }}
                />
              </span>
              <span className="w-6 text-right text-[10px] font-medium">{count != null ? count : '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClusteringTab({ filters }: { filters: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canRun = user?.role === 'admin' || user?.role === 'social_worker';
  const canDrill = canRun;
  const [kMin, setKMin] = useState(2);
  const [kMax, setKMax] = useState(8);
  const [seed, setSeed] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [memberCluster, setMemberCluster] = useState<number | null>(null);
  const [memberPage, setMemberPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const { data: runs, mutate: mutateRuns } = useSWR<RunSummary[]>(queryKeys.analytics.runs(20));
  const activeRunId = selectedRunId ?? runs?.[0]?.id ?? null;
  const { data: detail } = useSWR<RunDetail>(activeRunId ? queryKeys.analytics.run(activeRunId) : null);
  const { data: members } = useSWR<RunMembers>(
    activeRunId && memberCluster != null ? queryKeys.analytics.runMembers(activeRunId, memberCluster, memberPage) : null,
  );

  const candidates = useMemo(() => {
    const raw = (detail?.run.metrics as { candidates?: Array<{ k: number; inertia: number; silhouette: number }> })?.candidates ?? [];
    return raw.map(c => ({ ...c }));
  }, [detail]);

  async function runClustering() {
    const validK = Number.isInteger(kMin) && Number.isInteger(kMax)
      && kMin >= 2 && kMin <= 10 && kMax >= 2 && kMax <= 10 && kMin <= kMax;
    const trimmedSeed = seed.trim();
    const validSeed = trimmedSeed === '' || /^\d+$/.test(trimmedSeed);
    if (!validK || !validSeed) {
      setError(t('analytics.invalidInput', 'Check the k range (2–10) and seed values.'));
      return;
    }
    setRunning(true);
    setError('');
    try {
      const body: Record<string, unknown> = { kRange: [kMin, kMax], ...filters };
      if (trimmedSeed !== '') body.seed = Number(trimmedSeed);
      await api.post('/analytics/clustering/runs', body);
      await mutateRuns();
    } catch (err) {
      const errorBody = (err as { body?: { code?: string; required?: number; actual?: number } }).body;
      if (errorBody?.code === 'insufficient_data') {
        setError(t('analytics.insufficientData', 'Not enough data (needs {{required}}, found {{actual}})', { required: errorBody.required, actual: errorBody.actual }));
      } else {
        setError(t('analytics.actionFailed', 'Action failed. Please try again.'));
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <MethodologyNote textKey="analytics.methodology.clustering" />
      {canRun && (
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.clustering.runTitle', 'New clustering run')}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="k-min">{t('analytics.clustering.kRange', 'Candidate k range')}</label>
              <div className="flex items-center gap-1">
                <Input id="k-min" type="number" min={2} max={10} className="h-9 w-16" value={kMin} onChange={e => setKMin(Number(e.target.value))} />
                <span className="text-xs">–</span>
                <Input id="k-max" type="number" min={2} max={10} className="h-9 w-16" value={kMax} onChange={e => setKMax(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="seed">{t('analytics.clustering.seed', 'Seed (optional)')}</label>
              <Input id="seed" type="number" className="h-9 w-32" value={seed} onChange={e => setSeed(e.target.value)} placeholder={t('analytics.clustering.seedHint', 'Leave blank for a random seed; runs are reproducible by seed')} />
            </div>
            <Button size="sm" onClick={runClustering} disabled={running}>
              <Play size={14} className="mr-1" />
              {running ? t('analytics.clustering.running', 'Running…') : t('analytics.clustering.run', 'Run clustering')}
            </Button>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.clustering.runs', 'Runs')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(runs ?? []).map(run => (
              <button
                key={run.id}
                type="button"
                onClick={() => { setSelectedRunId(run.id); setMemberCluster(null); setMemberPage(1); }}
                className={`w-full rounded-md border px-2 py-1.5 text-left text-xs ${run.id === activeRunId ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <span className="flex items-center justify-between">
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                  <Badge variant={run.status === 'completed' ? 'default' : 'destructive'} className="text-[10px]">{run.status}</Badge>
                </span>
                <span className="text-muted-foreground">
                  {t('analytics.clustering.chosenK', 'Chosen k')}: {(run.params as { chosen_k?: number })?.chosen_k ?? '—'}
                </span>
              </button>
            ))}
            {(runs ?? []).length === 0 && <p className="text-xs text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-1"><CardTitle className="text-sm">{t('analytics.clustering.candidates', 'k selection (elbow and silhouette)')}</CardTitle></CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('analytics.noData', 'No data for the selected filters')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={candidates}>
                  <XAxis dataKey="k" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line yAxisId="left" dataKey="inertia" name={t('analytics.clustering.inertia', 'Inertia')} stroke="#3b82f6" dot={false} />
                  <Line yAxisId="right" dataKey="silhouette" name={t('analytics.clustering.silhouette', 'Silhouette')} stroke="#10b981" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {detail && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.clusters.map(cluster => {
            const mix = Array.isArray(cluster.profile?.barangay_mix) ? cluster.profile.barangay_mix : [];
            return (
              <Card key={cluster.clusterIndex}>
                <CardHeader className="pb-1">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span>{t('analytics.clustering.clusters', 'Segments')} #{cluster.clusterIndex + 1}</span>
                    <Badge variant="secondary" className="text-[10px]">{cellValueText(cluster.size)}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-xs">
                  {Object.entries(cluster.profile ?? {})
                    .filter(([key]) => key !== 'barangay_mix')
                    .slice(0, 5)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="truncate text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                        <span className="font-medium"><CellValue value={value} /></span>
                      </div>
                    ))}
                  {mix.length > 0 && <BarangayMix entries={mix} />}
                  {canDrill && (
                    <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => { setMemberCluster(cluster.clusterIndex); setMemberPage(1); }}>
                      <Users size={14} className="mr-1" /> {t('analytics.clustering.viewMembers', 'View households')}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => downloadAnalyticsCsv(`/analytics/clustering/runs/${detail.run.id}/export`, `analytics-clusters-${detail.run.id.slice(0, 8)}.csv`)}>
            <Download size={14} className="mr-1" /> {t('analytics.export', 'Export CSV')}
          </Button>
        </div>
      )}

      {canDrill && memberCluster != null && members && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">{t('analytics.clustering.membersTitle', 'Households in segment {{index}}', { index: memberCluster + 1 })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {members.rows.map(row => (
              <div key={row.householdId} className="flex justify-between border-b py-1 last:border-0">
                <span>{row.householdId} · {row.barangay ?? '—'}</span>
                <span className="text-xs text-muted-foreground">{t('analytics.clustering.distance', 'Distance')}: {row.distance ?? '—'}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <Button size="sm" variant="outline" disabled={memberPage <= 1} onClick={() => setMemberPage(p => p - 1)}>‹</Button>
              <span className="text-xs text-muted-foreground">{memberPage} / {Math.max(1, Math.ceil(members.total / 20))}</span>
              <Button size="sm" variant="outline" disabled={memberPage >= Math.ceil(members.total / 20)} onClick={() => setMemberPage(p => p + 1)}>›</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
