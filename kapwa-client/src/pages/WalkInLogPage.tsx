import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Search, Plus, Play, CheckCircle2, ExternalLink, Link2, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BARANGAYS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { humanizeError } from '@/lib/errors';
import {
  WALK_IN_PURPOSES, WALK_IN_STATUSES, walkInPurposeLabel, walkInStatusClass, walkInStatusLabel,
} from '@/lib/walk-in';

interface WalkInLog {
  id: string; queueNo: number; visitedAt: string; timeIn: string; completedAt?: string | null;
  clientName: string; firstName?: string | null; middleName?: string | null; lastName?: string | null;
  extension?: string | null; personId?: string | null; caseId?: string | null; pendingIntakeId?: string | null;
  referralId?: string | null; barangay?: string | null; sex?: string | null; dateOfBirth?: string | null;
  ageBand?: string | null; contactNumber?: string | null; purposeCode: string; purposeText?: string | null;
  isNewClient?: boolean | null; status: string; outcome?: string | null; outcomeNotes?: string | null;
  waitingMinutes?: number | null; serviceMinutes?: number | null;
}
interface ListResponse { data: WalkInLog[]; total: number; page: number; limit: number }
interface LinkOption {
  personId: string; firstName?: string; middleName?: string; lastName?: string; extension?: string;
  sex?: string; dob?: string; barangay?: string; caseId?: string; controlNo?: string;
}
interface ReferralOption { id: string; reason: string; createdAt: string; agencyName?: string }
interface Summary {
  range: { from: string; to: string }; visits: number; statuses: Record<string, number>;
  purposes: Record<string, number>; barangays: Record<string, number>; sex: Record<string, number>;
  ageBands: Record<string, number>; outcomes: Record<string, number>; newClients: number; returningClients: number;
  conversions: { toCase: number; toPendingIntake: number; rate: number };
  waitingMinutes: number; serviceMinutes: number;
  referrals: Array<{ id: string; agencyName?: string; reason: string; visits: number }>;
  daily: Array<{ date: string; count: number }>; monthly: Array<{ month: string; count: number }>;
}
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const monthStart = () => `${today().slice(0, 7)}-01`;

function clientSearch(q: string) {
  return api.get<LinkOption[]>(`/walk-in-logs/link-options?q=${encodeURIComponent(q)}`);
}

function ClientSearch({ onPick }: { onPick: (option: LinkOption) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LinkOption[]>([]);
  const [searching, setSearching] = useState(false);
  async function search() {
    if (query.trim().length < 2) return;
    setSearching(true);
    try { setResults(await clientSearch(query.trim())); }
    catch { toast.error('Could not search client records'); }
    finally { setSearching(false); }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search existing person by name or phone" aria-label="Search existing client" />
        <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
          <Search size={14} className="mr-1" /> {searching ? 'Searching…' : 'Search'}
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded border p-2">
          {results.map((r) => (
            <li key={r.personId}>
              <button type="button" className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => { onPick(r); setResults([]); setQuery(''); }}>
                <span className="font-medium">{[r.lastName, r.firstName, r.middleName].filter(Boolean).join(', ')}</span>
                <span className="ml-2 text-xs text-muted-foreground">{[r.barangay, r.controlNo].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WalkInLogPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'logbook' | 'reports'>('logbook');
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('all');
  const [purpose, setPurpose] = useState('all');
  const [q, setQ] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<LinkOption | null>(null);
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', extension: '', sex: '', dateOfBirth: '',
    barangay: '', contactNumber: '', purposeCode: 'inquiry', purposeText: '', isNewClient: '' as '' | 'new' | 'returning',
    personId: '', caseId: '',
  });
  const listKey = ['walkInLogs', page, date, status, purpose, q] as const;
  const { data: list, mutate: mutateList } = useSWR<ListResponse>(listKey, () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (date) params.set('date', date);
    if (status !== 'all') params.set('status', status);
    if (purpose !== 'all') params.set('purposeCode', purpose);
    if (q.trim()) params.set('q', q.trim());
    return api.get<ListResponse>(`/walk-in-logs?${params}`);
  });
  const [closeTarget, setCloseTarget] = useState<WalkInLog | null>(null);
  const [linkTarget, setLinkTarget] = useState<WalkInLog | null>(null);
  const [closeStatus, setCloseStatus] = useState('completed');
  const [outcome, setOutcome] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [referralId, setReferralId] = useState('');
  const [referralOptions, setReferralOptions] = useState<ReferralOption[]>([]);

  function pick(option: LinkOption) {
    setSelected(option);
    setForm((f) => ({
      ...f,
      firstName: option.firstName ?? f.firstName,
      middleName: option.middleName ?? f.middleName,
      lastName: option.lastName ?? f.lastName,
      extension: option.extension ?? f.extension,
      sex: option.sex === 'Male' || option.sex === 'Female' ? option.sex : f.sex,
      dateOfBirth: option.dob ?? f.dateOfBirth,
      barangay: option.barangay ?? f.barangay,
      personId: option.personId,
      caseId: option.caseId ?? '',
    }));
  }

  async function addVisit() {
    setSubmitting(true);
    try {
      const created = await api.post<WalkInLog>('/walk-in-logs', {
        firstName: form.firstName || undefined,
        middleName: form.middleName || undefined,
        lastName: form.lastName || undefined,
        extension: form.extension || undefined,
        sex: form.sex || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        barangay: form.barangay || undefined,
        contactNumber: form.contactNumber || undefined,
        purposeCode: form.purposeCode,
        purposeText: form.purposeText || undefined,
        isNewClient: form.isNewClient === '' ? undefined : form.isNewClient === 'new',
        personId: form.personId || undefined,
        caseId: form.caseId || undefined,
      });
      toast.success(`Walk-in logged — queue #${created.queueNo}`);
      setForm({ firstName: '', middleName: '', lastName: '', extension: '', sex: '', dateOfBirth: '', barangay: '', contactNumber: '', purposeCode: 'inquiry', purposeText: '', isNewClient: '', personId: '', caseId: '' });
      setSelected(null);
      setDate(today());
      await mutateList();
    } catch (e) {
      toast.error('Could not log this walk-in', { description: humanizeError(e) });
    } finally { setSubmitting(false); }
  }

  async function patch(id: string, body: Record<string, unknown>, message?: string) {
    try {
      await api.patch(`/walk-in-logs/${id}`, body);
      if (message) toast.success(message);
      await mutateList();
    } catch (e) {
      toast.error('Could not update the visit', { description: humanizeError(e) });
    }
  }

  async function openClose(log: WalkInLog) {
    setCloseTarget(log);
    setCloseStatus(log.status === 'in_service' ? 'completed' : log.status === 'waiting' ? 'completed' : log.status);
    setOutcome(log.outcome ?? '');
    setOutcomeNotes(log.outcomeNotes ?? '');
    setReferralId(log.referralId ?? '');
    setReferralOptions([]);
    if (log.caseId) {
      try { setReferralOptions(await api.get<ReferralOption[]>(`/walk-in-logs/referrals?caseId=${log.caseId}`)); } catch { /* optional */ }
    }
  }

  async function saveClose() {
    if (!closeTarget) return;
    await patch(closeTarget.id, {
      status: closeStatus,
      outcome: outcome || undefined,
      outcomeNotes: outcomeNotes || undefined,
      referralId: closeStatus === 'referred' && referralId ? referralId : undefined,
    }, 'Visit closed out');
    setCloseTarget(null);
  }

  async function startService(log: WalkInLog) {
    await patch(log.id, { status: 'in_service' }, 'Service started');
  }

  function startIntake(log: WalkInLog) {
    void patch(log.id, { status: 'in_service' });
    navigate('/intake', {
      state: {
        walkInLogId: log.id,
        prefill: {
          firstName: log.firstName ?? undefined, middleName: log.middleName ?? undefined,
          lastName: log.lastName ?? undefined, extension: log.extension ?? undefined,
          gender: log.sex === 'Male' || log.sex === 'Female' ? log.sex : undefined,
          dob: log.dateOfBirth ?? undefined, cellularNumber: log.contactNumber ?? undefined,
          currentAddress: log.barangay ? { barangay: log.barangay } : undefined,
        },
      },
    });
  }

  const pageCount = Math.max(1, Math.ceil((list?.total ?? 0) / 20));

  return (
    <PageShell title="Walk-in Log" description="Information-desk client visits, queue, outcomes and reports.">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList aria-label="Walk-in log views">
          <TabsTrigger value="logbook">Logbook</TabsTrigger>
          <TabsTrigger value="reports"><BarChart3 size={14} className="mr-1" /> Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="logbook" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick add walk-in</CardTitle>
              <CardDescription>Record the client and purpose at the information desk. Linking a person/case is optional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ClientSearch onPick={pick} />
              {selected && (
                <p className="text-xs text-primary">Linked to <strong>{selected.lastName}, {selected.firstName}</strong>{selected.controlNo ? ` · ${selected.controlNo}` : ''}</p>
              )}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div><Label htmlFor="wi-last">Last name</Label><Input id="wi-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
                <div><Label htmlFor="wi-first">First name</Label><Input id="wi-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div><Label htmlFor="wi-middle">Middle name</Label><Input id="wi-middle" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} /></div>
                <div><Label htmlFor="wi-ext">Extension</Label><Input id="wi-ext" value={form.extension} onChange={(e) => setForm({ ...form, extension: e.target.value })} placeholder="Jr., III" /></div>
                <div>
                  <Label>Sex</Label>
                  <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v })}>
                    <SelectTrigger aria-label="Sex"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{['Male', 'Female', 'Other'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="wi-dob">Date of birth</Label><Input id="wi-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
                <div>
                  <Label>Barangay</Label>
                  <Select value={form.barangay} onValueChange={(v) => setForm({ ...form, barangay: v })}>
                    <SelectTrigger aria-label="Barangay"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{BARANGAYS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="wi-contact">Contact number</Label><Input id="wi-contact" value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} placeholder="09XX XXX XXXX" /></div>
                <div>
                  <Label>Purpose</Label>
                  <Select value={form.purposeCode} onValueChange={(v) => setForm({ ...form, purposeCode: v })}>
                    <SelectTrigger aria-label="Purpose"><SelectValue /></SelectTrigger>
                    <SelectContent>{WALK_IN_PURPOSES.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label htmlFor="wi-purpose">Purpose details</Label><Input id="wi-purpose" value={form.purposeText} onChange={(e) => setForm({ ...form, purposeText: e.target.value })} placeholder="Optional details" /></div>
                <div>
                  <Label>Client type</Label>
                  <Select value={form.isNewClient} onValueChange={(v) => setForm({ ...form, isNewClient: v as typeof form.isNewClient })}>
                    <SelectTrigger aria-label="Client type"><SelectValue placeholder="Not specified" /></SelectTrigger>
                    <SelectContent><SelectItem value="new">New client</SelectItem><SelectItem value="returning">Returning client</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-end"><Button className="w-full" onClick={() => void addVisit()} disabled={submitting}><Plus size={14} className="mr-1" /> {submitting ? 'Saving…' : 'Log visit'}</Button></div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-end gap-2">
            <div><Label htmlFor="wi-filter-date">Date</Label><Input id="wi-filter-date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} /></div>
            <div><Label>Status</Label><Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}><SelectTrigger className="w-44" aria-label="Status filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{WALK_IN_STATUSES.map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Purpose</Label><Select value={purpose} onValueChange={(v) => { setPurpose(v); setPage(1); }}><SelectTrigger className="w-52" aria-label="Purpose filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All purposes</SelectItem>{WALK_IN_PURPOSES.map((p) => <SelectItem key={p.code} value={p.code}>{p.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="min-w-48 flex-1"><Label htmlFor="wi-search">Search</Label><Input id="wi-search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name, purpose, contact" /></div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Time</TableHead><TableHead>Client</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead><TableHead>Wait / service</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {(list?.data ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.queueNo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(log.visitedAt)}<br />{new Date(log.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                    <TableCell><div className="font-medium">{log.clientName || 'Unnamed inquiry'}</div><div className="text-xs text-muted-foreground">{log.barangay ?? '—'}{log.caseId ? ' · linked case' : log.personId ? ' · linked person' : ''}</div></TableCell>
                    <TableCell><div className="text-sm">{walkInPurposeLabel(log.purposeCode)}</div>{log.purposeText && <div className="text-xs text-muted-foreground">{log.purposeText}</div>}</TableCell>
                    <TableCell><Badge variant="outline" className={walkInStatusClass(log.status)}>{walkInStatusLabel(log.status)}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.waitingMinutes ?? 0} min wait{log.serviceMinutes != null ? ` · ${log.serviceMinutes} min service` : ''}</TableCell>
                    <TableCell><div className="flex justify-end gap-1">
                      {log.status === 'waiting' && <Button size="sm" variant="outline" onClick={() => void startService(log)}><Play size={13} className="mr-1" /> Start</Button>}
                      {!['completed', 'referred', 'incomplete', 'no_service'].includes(log.status) && <Button size="sm" variant="outline" onClick={() => void openClose(log)}><CheckCircle2 size={13} className="mr-1" /> Close</Button>}
                      <Button size="sm" variant="ghost" onClick={() => startIntake(log)}><ExternalLink size={13} className="mr-1" /> Intake</Button>
                      {!log.personId && <Button size="sm" variant="ghost" onClick={() => setLinkTarget(log)}><Link2 size={13} className="mr-1" /> Link</Button>}
                    </div></TableCell>
                  </TableRow>
                ))}
                {!list?.data?.length && <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No visits for this filter.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{list?.total ?? 0} visit{(list?.total ?? 0) === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><span>Page {page} of {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
          </div>
        </TabsContent>

        <TabsContent value="reports"><WalkInReports /></TabsContent>
      </Tabs>

      <Dialog open={!!closeTarget} onOpenChange={(open) => { if (!open) setCloseTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Close out visit</DialogTitle><DialogDescription>Record what happened at the desk. This is the outcome used by reports.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Outcome status</Label><Select value={closeStatus} onValueChange={setCloseStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{WALK_IN_STATUSES.filter((s) => !['waiting', 'in_service'].includes(s.code)).map((s) => <SelectItem key={s.code} value={s.code}>{s.label}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="wi-outcome">Outcome</Label><Input id="wi-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. Served, referred to RHU, incomplete documents" /></div>
            {closeStatus === 'referred' && referralOptions.length > 0 && <div><Label>Referral record</Label><Select value={referralId} onValueChange={setReferralId}><SelectTrigger><SelectValue placeholder="Select referral" /></SelectTrigger><SelectContent>{referralOptions.map((r) => <SelectItem key={r.id} value={r.id}>{[r.agencyName, r.reason].filter(Boolean).join(' — ')}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label htmlFor="wi-outcome-notes">Notes</Label><Textarea id="wi-outcome-notes" value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCloseTarget(null)}>Cancel</Button><Button onClick={() => void saveClose()}>Save outcome</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkTarget} onOpenChange={(open) => { if (!open) setLinkTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link existing client</DialogTitle><DialogDescription>Search the person/case registry and attach it to this visit.</DialogDescription></DialogHeader>
          <ClientSearch onPick={async (option) => {
            if (!linkTarget) return;
            await patch(linkTarget.id, {
              personId: option.personId, caseId: option.caseId || undefined,
              firstName: option.firstName, middleName: option.middleName, lastName: option.lastName,
              extension: option.extension, sex: option.sex === 'Male' || option.sex === 'Female' ? option.sex : undefined,
              dateOfBirth: option.dob, barangay: option.barangay,
            }, 'Client linked');
            setLinkTarget(null);
          }} />
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function WalkInReports() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const { data } = useSWR<Summary>(['walkInSummary', from, to], () => api.get<Summary>(`/walk-in-logs/summary?from=${from}&to=${to}`));
  const total = data?.visits ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div><Label htmlFor="wi-from">From</Label><Input id="wi-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label htmlFor="wi-to">To</Label><Input id="wi-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Visits" value={total} />
        <Stat label="Waiting" value={data?.statuses.waiting ?? 0} />
        <Stat label="Completed" value={data?.statuses.completed ?? 0} />
        <Stat label="Avg wait" value={`${data?.waitingMinutes ?? 0} min`} />
        <Stat label="Visit → case" value={`${data?.conversions.rate ?? 0}%`} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Breakdown title="By purpose" data={data?.purposes} labels={walkInPurposeLabel} />
        <Breakdown title="By barangay" data={data?.barangays} />
        <Breakdown title="By sex" data={data?.sex} />
        <Breakdown title="By age band" data={data?.ageBands} />
        <Breakdown title="Outcomes" data={data?.outcomes} />
        <Breakdown title="Daily visits" data={Object.fromEntries((data?.daily ?? []).map((d) => [d.date, d.count]))} />
        <Breakdown title="Monthly visits" data={Object.fromEntries((data?.monthly ?? []).map((d) => [d.month, d.count]))} />
        <Breakdown title="Referral outcomes" data={Object.fromEntries((data?.referrals ?? []).map((r) => [r.agencyName ?? 'Referral', r.visits]))} />
      </div>
      <p className="text-xs text-muted-foreground">Conversion: {data?.conversions.toCase ?? 0} visits linked to a case · {data?.conversions.toPendingIntake ?? 0} linked to a pending intake. New clients: {data?.newClients ?? 0}; returning: {data?.returningClients ?? 0}.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>;
}

function Breakdown({ title, data, labels }: { title: string; data?: Record<string, number>; labels?: (k: string) => string }) {
  const entries = Object.entries(data ?? {}).sort(([, a], [, b]) => b - a);
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent>{entries.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> : <ul className="space-y-1 text-sm">{entries.map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span className="text-muted-foreground">{labels ? labels(k) : k}</span><span className="font-medium">{v}</span></li>)}</ul>}</CardContent></Card>;
}
