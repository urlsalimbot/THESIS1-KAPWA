import { useState, useEffect, useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { statusLabel, categoryLabel } from "@/i18n/display";
import { computeAge } from "@/lib/age";
import {
  ArrowLeft,
  User,
  MapPin,
  Users as UsersIcon,
  FileText,
  Plus,
  ChevronDown,
  ChevronRight,
  Shield,
  ClipboardList,
  Phone,
  Calendar,
  Tag,
  Home,
  CreditCard,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { setBreadcrumbLabel } from '@/lib/breadcrumbs';
import { api } from "../lib/api";
import { queryKeys } from "../lib/query-keys";
import { FamilyGraph } from "../components/family/FamilyGraph";
import { RemarksHistoryCard } from "../components/beneficiaries/RemarksHistoryCard";
import { ConsentManager } from "../components/consent/ConsentManager";
import { PageShell } from "@/components/PageShell";
import { CardGridSkeleton } from "@/components/skeletons/CardGridSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addressNames } from "@/lib/psgc";
import { formatDate, personFullName } from '../lib/format';

interface BeneficiaryDetail {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  gender: string;
  contact: string;
  barangay: string;
  purok: string;
  addressLine?: string;
  category: string;
  placeOfBirth: string;
  civilStatus: string;
  householdSize: number;
  status: string;
  accessCardCode?: string;
  nhtsPrId?: string;
  cases: {
    id: string;
    program: string;
    status: string;
    date: string;
    amount?: string;
  }[];
  /** Client category of the latest case — drives program eligibility. */
  latestClientCategory?: string;
  latestControlNo?: string;
  latestCaseStatus?: string;
}

interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  occupation?: string;
  income?: number;
  status?: string;
  statusReason?: string | null;
  isPrimary: boolean;
  // Detailed person fields returned by the family-graph endpoint — used to
  // prefill the intake form's family composition when adding a case.
  surname?: string;
  firstName?: string;
  middleName?: string;
  extension?: string;
  gender?: string;
  dob?: string;
}

/** Reasons offered when a household member is marked inactive. */
const INACTIVE_REASONS: { value: string; key: string; fallback: string }[] = [
  { value: 'Moved out', key: 'beneficiaries.reasonMovedOut', fallback: 'Moved out' },
  { value: 'Deceased', key: 'beneficiaries.reasonDeceased', fallback: 'Deceased' },
  { value: 'Transferred to another household', key: 'beneficiaries.reasonTransferred', fallback: 'Transferred to another household' },
  { value: 'Other', key: 'beneficiaries.reasonOther', fallback: 'Other' },
];

/** A member is inactive only when the status says so (null/'' means active). */
function isInactiveMember(m: FamilyMember): boolean {
  return (m.status ?? '').trim().toLowerCase() === 'inactive';
}

/** One labeled field in a family member's detail grid. */
function FamilyField({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className || ''}`}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-xs text-foreground truncate">{value}</dd>
    </div>
  );
}

const statusBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  enrolled: "outline",
  assessed: "secondary",
  in_review: "secondary",
  active: "default",
  transitioning: "secondary",
  closed: "outline",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant={statusBadgeVariant[status] || "outline"}>
      {statusLabel(t, status)}
    </Badge>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={14} className="text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}

export function BeneficiaryViewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { mutate: globalMutate } = useSWRConfig();

  const { data: ben } = useSWR<Record<string, unknown>>(
    id ? queryKeys.beneficiaries.detail(id) : null,
  );
  // Breadcrumb should read the beneficiary's name, not the UUID.
  useEffect(() => {
    if (!id || !ben) return;
    const name = personFullName(ben.firstName as string, ben.middleName as string, ben.surname as string);
    if (name) setBreadcrumbLabel(id, name);
  }, [id, ben]);

  // The Cases panel must reflect THIS beneficiary's cases, so the request is
  // filtered server-side by beneficiaryId (GET /cases?beneficiaryId=...). The
  // list endpoint paginates (default 10/page), so fetch every page — a
  // beneficiary with more cases than one page used to show "No active cases".
  const { data: casesRes } = useSWR<{ data: Array<Record<string, unknown>>; total: number }>(
    id ? queryKeys.cases.list({ beneficiaryId: id }) : null,
    async () => {
      const pageSize = 100;
      const all: Array<Record<string, unknown>> = [];
      let total = 0;
      for (let page = 1; ; page += 1) {
        const res = await api.get<{ data: Array<Record<string, unknown>>; total: number }>(
          queryKeys.cases.list({ beneficiaryId: id, page, limit: pageSize }),
        );
        const rows = res?.data ?? [];
        all.push(...rows);
        total = res?.total ?? all.length;
        // Stop on a short page (server had no more rows) or once every row the
        // server reported has been collected. `total` guards against a server
        // that keeps returning full pages.
        if (rows.length < pageSize || all.length >= total) break;
      }
      return { data: all, total };
    },
  );
  const {
    data: famGraph,
    isLoading: famLoading,
    error: famError,
  } = useSWR<{
    totalCount?: number;
    members?: Array<FamilyMember & { depth: number; statusIncome?: string }>;
    primary?: FamilyMember & { depth: number; statusIncome?: string };
  }>(id ? queryKeys.beneficiaries.familyGraph(id) : null);

  const loading = !ben && id;

  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState("");
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [beneficiary, setBeneficiary] = useState<BeneficiaryDetail | null>(
    null,
  );
  const [editingNhts, setEditingNhts] = useState(false);
  const [nhtsDraft, setNhtsDraft] = useState('');
  const [nhtsSaving, setNhtsSaving] = useState(false);
  const [nhtsMsg, setNhtsMsg] = useState('');

  // --- Family composition: deactivate / reactivate a member ----------------
  const [deactivateTarget, setDeactivateTarget] = useState<FamilyMember | null>(null);
  const [deactivateReason, setDeactivateReason] = useState(INACTIVE_REASONS[0].value);
  const [deactivateNote, setDeactivateNote] = useState('');
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  async function setMemberActive(m: FamilyMember, active: boolean, reason?: string) {
    if (!id) return;
    await api.patch(
      `/beneficiaries/${id}/family/${m.id}`,
      active ? { active: true } : { active: false, reason },
    );
    await globalMutate(queryKeys.beneficiaries.familyGraph(id));
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateBusy(true);
    setDeactivateError('');
    try {
      const note = deactivateNote.trim();
      const reason = note ? `${deactivateReason} — ${note}` : deactivateReason;
      await setMemberActive(deactivateTarget, false, reason);
      setDeactivateTarget(null);
      setDeactivateNote('');
    } catch (e) {
      setDeactivateError(e instanceof Error ? e.message : t('beneficiaries.deactivateFailed', 'Could not update the family member'));
    } finally {
      setDeactivateBusy(false);
    }
  }

  async function reactivateMember(m: FamilyMember) {
    try {
      await setMemberActive(m, true);
    } catch {
      // The roster simply does not change; the worker can retry.
    }
  }

  const { data: cardSummary } = useSWR<{ cardCode: string; total: number; byCategory: Record<string, number> }>(
    id && beneficiary?.accessCardCode ? queryKeys.accessCards.summary(id) : null,
  );

  useEffect(() => {
    if (!id) return;
    if (ben) {
      const b = ben as Record<string, unknown>;
      const age = computeAge(b.dob as string | undefined);
      const addrParts = ((b.address as string) || "")
        .split(",")
        .map((s: string) => s.trim());
      const allCases = Array.isArray(casesRes) ? casesRes : casesRes?.data || [];
      const beneficiaryCases = allCases.filter(
        (c) =>
          c.beneficiaryId === id ||
          ((c.beneficiary as Record<string, unknown>)?.id as string) === id,
      );
      setBeneficiary({
        id: b.id as string,
        name: `${b.firstName || ""} ${b.middleName || ""} ${b.surname || ""}`
          .replace(/\s+/g, " ")
          .trim(),
        age,
        birthDate: (b.dob as string) || "",
        gender: (b.gender as string) || "",
        contact: (b.phone as string) || "",
        barangay: addrParts[addrParts.length - 1] || "",
        purok: addrParts.length > 1 ? addrParts[0] : "",
        addressLine: addressNames(b.currentAddress as Record<string, string> | undefined) || (b.address as string) || "",
        category: (b.category as string) || "",
        placeOfBirth: (b.placeOfBirth as string) || "",
        civilStatus: (b.civilStatus as string) || "",
        householdSize: famGraph?.totalCount || 1,
        status: (b.consentStatus as string) || "active",
        accessCardCode: (b.accessCardCode as string) || undefined,
        nhtsPrId: ((b.household as Record<string, unknown>)?.nhtsPrId as string) || undefined,
        cases: beneficiaryCases.map((c: Record<string, unknown>) => {
          const sr = c.serviceRequested;
          return {
            id: c.id as string,
            program: Array.isArray(sr) ? sr.join(", ") : (c.controlNo as string) || "",
            status: (c.status as string) || "pending",
            date: c.createdAt
              ? formatDate(c.createdAt as string)
              : "",
          };
        }),
        // Most recently created case drives the client category shown beside the
        // case list. Mirrors the "Client Category" column on the beneficiaries
        // list, so both surfaces agree.
        ...(() => {
          const latest = [...beneficiaryCases].sort(
            (a, b) =>
              new Date((b.createdAt as string) || 0).getTime() -
              new Date((a.createdAt as string) || 0).getTime(),
          )[0];
          return {
            latestClientCategory: (latest?.clientCategory as string) || (b.category as string) || "",
            latestControlNo: (latest?.controlNo as string) || "",
            latestCaseStatus: (latest?.status as string) || "",
          };
        })(),
      });
    }
    if (famGraph?.members) setFamily(famGraph.members);
  }, [ben, casesRes, famGraph, id]);

  useEffect(() => {
    if (assignSuccess) {
      const t = setTimeout(() => setAssignSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [assignSuccess]);

  async function saveNhtsPr() {
    if (!beneficiary?.id) return;
    setNhtsSaving(true);
    setNhtsMsg('');
    try {
      const value = nhtsDraft.trim() || null;
      await api.patch(`/beneficiaries/${beneficiary.id}/household/nhts-pr`, { nhtsPrId: value });
      setBeneficiary(prev => (prev ? { ...prev, nhtsPrId: value || undefined } : prev));
      setEditingNhts(false);
      setNhtsMsg(t('nhts.saved', 'NHTS-PR ID saved.'));
    } catch {
      setNhtsMsg(t('nhts.saveFailed', 'Unable to save NHTS-PR ID.'));
    } finally {
      setNhtsSaving(false);
    }
  }

  async function handleAssignCard() {
    if (!id) return;
    setAssigning(true);
    try {
      const result = await api.post<{ accessCardCode: string }>(
        `/access-cards/assign/${id}`,
      );
      setBeneficiary((prev) =>
        prev ? { ...prev, accessCardCode: result.accessCardCode } : prev,
      );
      setAssignSuccess(t("beneficiaries.cardAssigned", "Access Card assigned: {{code}}", { code: result.accessCardCode }));
    } catch (err: any) {
      setAssignSuccess("");
    }
    setAssigning(false);
  }

  function handleReprint() {
    if (!beneficiary) return;
    const confirmed = window.confirm(
      t("beneficiaries.reprintConfirm", "Reprint Access Card — Reprint card for {{name}}? Current code: {{code}} will remain valid. Verify claimant identity before proceeding.", {
        name: beneficiary.name,
        code: beneficiary.accessCardCode,
      }),
    );
    if (!confirmed) return;
    navigate(`/beneficiary/${id}/card/print`);
  }

  if (loading) {
    return (
      <PageShell
        title={t("beneficiaries.viewTitle", "Beneficiary Details")}
        description={t("beneficiaries.viewingInfo", "Viewing beneficiary information and case records.")}
      >
        <CardGridSkeleton />
      </PageShell>
    );
  }

  if (!beneficiary) {
    return (
      <PageShell
        title={t("beneficiaries.viewTitle", "Beneficiary Details")}
        description=""
        backTo={{ label: t("beneficiaries.back", "Back"), onClick: () => navigate("/beneficiaries") }}
      >
        <EmptyState variant="no-data" />
      </PageShell>
    );
  }

  function handleConsentChange(newStatus: string) {
    setBeneficiary((prev) => (prev ? { ...prev, status: newStatus } : prev));
  }

  return (
    <PageShell
      title={t("beneficiaries.viewTitle", "Beneficiary Details")}
      description={t("beneficiaries.viewingFor", "Viewing information for {{name}}", { name: beneficiary.name })}
      backTo={{ label: t("beneficiaries.back", "Back"), onClick: () => navigate("/beneficiaries") }}
    >
      {assignSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm font-medium text-emerald-700 mb-3">
          {assignSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* --- Left column (2/3) — Profile + Family + Cases --- */}
        <div className="lg:col-span-2 space-y-4">
          {/* Profile Header */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {beneficiary.name ? beneficiary.name.charAt(0) : "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-foreground truncate">
                      {beneficiary.name}
                    </h2>

                  </div>
                  <StatusBadge status={beneficiary.status} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User size={13} /> {beneficiary.gender ? `${beneficiary.gender}, ` : ""}{beneficiary.age} {t("beneficiaries.yearsShort", "yrs")}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} /> {beneficiary.addressLine || `${beneficiary.barangay}${beneficiary.purok ? `, ${beneficiary.purok}` : ""}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={13} /> {beneficiary.birthDate}
                  </span>
                  {beneficiary.contact && (
                    <span className="flex items-center gap-1">
                      <Phone size={13} /> {beneficiary.contact}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Family Composition + Family Tree */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <UsersIcon size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                {t("beneficiaries.familyComposition", "Family Composition ({{count}})", { count: family.length })}
              </h3>
            </div>
            {family.length > 0 && (
              <div className="space-y-2 mb-4">
                {family.map((m) => {
                  const inactive = isInactiveMember(m);
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg border p-3 transition-colors ${inactive ? "border-dashed border-border bg-muted/10" : "border-border bg-muted/30 hover:bg-muted/50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-sm ${m.isPrimary ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
                            {m.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className={`text-sm font-semibold truncate ${inactive ? "text-muted-foreground line-through" : "text-foreground"}`}>{m.fullName}</p>
                              {m.isPrimary && <span className="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-medium text-primary leading-none">{t("beneficiaries.primary", "Primary")}</span>}
                              {inactive && <Badge variant="outline" className="px-1 py-0 text-[9px] leading-none text-muted-foreground">{t("beneficiaries.inactive", "Inactive")}</Badge>}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{m.relationship} &middot; {m.age} {t("beneficiaries.yearsShort", "yrs")}</p>
                          </div>
                        </div>
                        {!m.isPrimary && (
                          inactive ? (
                            <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => reactivateMember(m)}>
                              {t("beneficiaries.reactivate", "Reactivate")}
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0 text-xs text-destructive hover:text-destructive"
                              onClick={() => { setDeactivateTarget(m); setDeactivateReason(INACTIVE_REASONS[0].value); setDeactivateNote(""); setDeactivateError(""); }}
                            >
                              {t("beneficiaries.deactivate", "Deactivate")}
                            </Button>
                          )
                        )}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                        <FamilyField label={t("beneficiaries.sex", "Sex")} value={m.gender || "—"} />
                        <FamilyField label={t("beneficiaries.dob", "Date of Birth")} value={m.dob ? formatDate(m.dob) : "—"} />
                        <FamilyField label={t("beneficiaries.middleNameLabel", "Middle Name")} value={m.middleName || "—"} />
                        <FamilyField label={t("beneficiaries.extensionLabel", "Extension")} value={m.extension || "—"} />
                        <FamilyField label={t("beneficiaries.relationshipLabel", "Relationship")} value={m.relationship || "—"} />
                        <FamilyField label={t("beneficiaries.occupation", "Occupation")} value={m.occupation || "—"} />
                        <FamilyField label={t("beneficiaries.monthlyIncome", "Monthly Income")} value={m.income != null ? `₱${Number(m.income).toLocaleString()}` : "—"} />
                        <FamilyField label={t("beneficiaries.status", "Status")} value={m.status || t("beneficiaries.active", "Active")} />
                        {inactive && m.statusReason && (
                          <FamilyField label={t("beneficiaries.reason", "Reason")} value={m.statusReason} className="col-span-2 sm:col-span-3" />
                        )}
                      </dl>
                    </div>
                  );
                })}
              </div>
            )}
            <FamilyGraph
              loading={famLoading && !famGraph}
              error={famError ? (famError as any)?.message || t("beneficiaries.familyGraphFailed", "Failed to load family graph") : null}
              members={(famGraph?.members || []) as any}
              primary={(famGraph?.primary || null) as any}
            />
          </div>

          {/* Deactivate a family member — kept on record, out of the household
              count and the intake match check until reactivated. */}
          <Dialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) { setDeactivateTarget(null); setDeactivateError(""); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t("beneficiaries.deactivateTitle", "Mark family member inactive")}</DialogTitle>
                <DialogDescription>
                  {t("beneficiaries.deactivateDesc", "{{name}} stays on record but is removed from the household count and the intake match check. You can reactivate them later.", { name: deactivateTarget?.fullName || "" })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor="deactivate-reason" className="text-xs font-medium text-muted-foreground">{t("beneficiaries.reason", "Reason")}</label>
                  <select
                    id="deactivate-reason"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                  >
                    {INACTIVE_REASONS.map((r) => <option key={r.value} value={r.value}>{t(r.key, r.fallback)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="deactivate-note" className="text-xs font-medium text-muted-foreground">{t("beneficiaries.reasonDetails", "Additional details (optional)")}</label>
                  <Input id="deactivate-note" value={deactivateNote} onChange={(e) => setDeactivateNote(e.target.value)} maxLength={160} />
                </div>
                {deactivateError && <p role="alert" className="text-xs text-destructive">{deactivateError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" disabled={deactivateBusy} onClick={() => { setDeactivateTarget(null); setDeactivateError(""); }}>
                  {t("beneficiaries.cancel", "Cancel")}
                </Button>
                <Button variant="destructive" disabled={deactivateBusy} onClick={confirmDeactivate}>
                  {deactivateBusy ? t("beneficiaries.saving", "Saving…") : t("beneficiaries.deactivate", "Deactivate")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Cases + Interventions — 2-column sub-grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <FileText size={16} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.cases", "Cases")}</h3>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full h-7 w-7" aria-label={t("beneficiaries.addCase", "Add case")} onClick={() => {
                  if (!ben) return;
                  navigate("/intake", { state: { prefill: {
                    surname: (ben.surname as string) || "", firstName: (ben.firstName as string) || "",
                    middleName: (ben.middleName as string) || "", gender: (ben.gender as string) || "",
                    dob: (ben.dob as string) || "", placeOfBirth: (ben.placeOfBirth as string) || "",
                    civilStatus: (ben.civilStatus as string) || "", cellularNumber: (ben.phone as string) || "",
                    occupation: (ben.occupation as string) || "", estimatedMonthlyIncome: (ben.estimatedMonthlyIncome as number)?.toString() || "",
                    philsysNumber: (ben.philsysNumber as string) || "",
                    familyMembers: family.map(m => ({
                      id: m.id,
                      surname: m.surname ?? "",
                      firstName: m.firstName ?? "",
                      middleName: m.middleName ?? "",
                      extension: m.extension ?? "",
                      gender: m.gender ?? "",
                      dob: m.dob ?? "",
                      relationship: m.relationship ?? "",
                      occupation: m.occupation ?? "",
                      income: m.income != null ? String(m.income) : "",
                      status: m.status ?? "",
                      done: false,
                    })),
                  }}});
                }}>
                  <Plus size={14} />
                </Button>
              </div>
              {beneficiary.cases.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("beneficiaries.noActiveCases", "No active cases")}</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {beneficiary.cases.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded bg-muted/50 px-2.5 py-2 text-sm cursor-pointer hover:bg-muted transition-colors" onClick={() => navigate(`/cases/${c.id}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(`/cases/${c.id}`)}>
                      <div className="min-w-0 flex-1 mr-2">
                        <p className="font-medium text-foreground truncate">{c.program}</p>

                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{c.date}</span>
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-2 text-primary mb-3">
                <Tag size={16} />
                <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.clientCategory", "Client Category")}</h3>
              </div>
              <div className="space-y-2">
                <p className={`text-sm font-medium ${beneficiary.latestClientCategory ? "text-foreground" : "text-muted-foreground"}`}>
                  {beneficiary.latestClientCategory
                    ? categoryLabel(t, beneficiary.latestClientCategory)
                    : t("beneficiaries.noCategory", "No category recorded")}
                </p>
                {beneficiary.latestControlNo && (
                  <p className="text-xs text-muted-foreground">
                    {t("beneficiaries.latestCase", "Latest case: {{controlNo}}", { controlNo: beneficiary.latestControlNo })}
                  </p>
                )}
                {beneficiary.latestCaseStatus && (
                  <div className="pt-1">
                    <StatusBadge status={beneficiary.latestCaseStatus} />
                  </div>
                )}
                {!beneficiary.latestClientCategory && !beneficiary.latestControlNo && (
                  <p className="text-xs text-muted-foreground">
                    {t("beneficiaries.categoryAfterAssessment", "Set during the case assessment.")}
                  </p>
                )}
              </div>
            </div>


          </div>

          {beneficiary?.id && <RemarksHistoryCard beneficiaryId={beneficiary.id} />}
        </div>

        {/* --- Right column (1/3) — Personal Info + IDs + Consent --- */}
        <div className="space-y-4">
          {/* Personal Info — full SWIS details */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <User size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.personalInfo", "Personal Info")}</h3>
            </div>
            <div className="space-y-2">
              <InfoRow icon={Calendar} label={t("beneficiaries.birthDate", "Birth Date")} value={beneficiary.birthDate || "N/A"} />
              <InfoRow icon={MapPin} label={t("beneficiaries.placeOfBirth", "Place of Birth")} value={beneficiary.placeOfBirth || "N/A"} />
              <InfoRow icon={Tag} label={t("beneficiaries.civilStatus", "Civil Status")} value={beneficiary.civilStatus || "N/A"} />
              <InfoRow icon={Phone} label={t("beneficiaries.contact", "Contact")} value={beneficiary.contact || "N/A"} />
              <InfoRow icon={Tag} label={t("beneficiaries.category", "Category")} value={beneficiary.category || "N/A"} />
              <InfoRow icon={Home} label={t("beneficiaries.household", "Household")} value={t("beneficiaries.membersCount", "{{count}} member", { count: beneficiary.householdSize })} />
              <div className="flex items-start justify-between gap-2">
                <InfoRow
                  icon={Tag}
                  label={t('nhts.label', 'NHTS-PR / Listahanan ID')}
                  value={beneficiary.nhtsPrId || t('nhts.notSet', 'Not set')}
                />
                {!editingNhts && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t('nhts.editLabel', 'Edit NHTS-PR ID')}
                    onClick={() => {
                      setNhtsDraft(beneficiary.nhtsPrId || '');
                      setEditingNhts(true);
                    }}
                  >
                    {t('nhts.edit', 'Edit')}
                  </Button>
                )}
              </div>
              {editingNhts && (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={t('nhts.label', 'NHTS-PR / Listahanan ID')}
                    placeholder={t('nhts.placeholder', 'Enter NHTS-PR / Listahanan ID')}
                    value={nhtsDraft}
                    onChange={e => setNhtsDraft(e.target.value)}
                  />
                  <Button size="sm" disabled={nhtsSaving} aria-label={t('nhts.saveLabel', 'Save NHTS-PR ID')} onClick={saveNhtsPr}>
                    {t('nhts.save', 'Save')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingNhts(false)}>
                    {t('nhts.cancel', 'Cancel')}
                  </Button>
                </div>
              )}
              {nhtsMsg && <p className="text-xs text-muted-foreground">{nhtsMsg}</p>}
            </div>
          </div>

          {/* Claimant (if different from beneficiary) */}
          {(ben as any)?.claimant && (
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-2 text-primary mb-3">
                <UsersIcon size={16} />
                <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.claimantRepresentative", "Claimant Representative")}</h3>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {((ben as any)?.claimant?.person?.firstName || '')} {((ben as any)?.claimant?.person?.surname || '')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("beneficiaries.relationship", "Relationship: {{value}}", { value: ((ben as any)?.claimant?.relationship || '—') })}
                </p>
                {(ben as any)?.claimant?.person?.phone && (
                  <p className="text-xs text-muted-foreground">{t("beneficiaries.contactLabel", "Contact: {{value}}", { value: (ben as any)?.claimant?.person?.phone })}</p>
                )}
              </div>
            </div>
          )}

          {/* Access Card */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <CreditCard size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.accessCard", "Access Card")}</h3>
            </div>
            {beneficiary.accessCardCode ? (
              <div>
                <p className="text-xs text-muted-foreground">{t("beneficiaries.cardCode", "Card Code")}</p>
                <p className="font-mono text-sm font-medium text-primary">{beneficiary.accessCardCode}</p>
                {cardSummary && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Object.entries(cardSummary.byCategory).map(([cat, count]) => (
                      <Badge key={cat} variant="secondary" className="text-[10px]">
                        {count}
                        <span className="ml-0.5 font-normal">
                          {cat === 'case_service' ? t("beneficiaries.cardCase", "Case") : cat === 'referral' ? t("beneficiaries.cardReferrals", "Referrals") : cat === 'community_service' ? t("beneficiaries.cardCommunity", "Community") : t("beneficiaries.cardSeminars", "Seminars")}
                        </span>
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <Button size="sm" className="flex-1" onClick={() => navigate(`/beneficiary/${id}/access-card`)}>
                    <ClipboardList size={14} className="mr-1" /> {t("beneficiaries.viewRecord", "View Record")}
                  </Button>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/beneficiary/${id}/card/print`)}>{t("beneficiaries.print", "Print")}</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleReprint}>{t("beneficiaries.reprint", "Reprint")}</Button>
                </div>
              </div>
            ) : (
              <Button onClick={handleAssignCard} disabled={assigning} className="w-full" size="sm">
                {assigning ? t("beneficiaries.assigning", "Assigning...") : t("beneficiaries.generateAndAssign", "Generate & Assign Card")}
              </Button>
            )}
          </div>

          {/* Consent & Privacy */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <Shield size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.consentPrivacy", "Consent & Privacy")}</h3>
            </div>
            {id && beneficiary && (
              <ConsentManager beneficiaryId={id} currentConsentStatus={beneficiary.status} onConsentChange={handleConsentChange} />
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
