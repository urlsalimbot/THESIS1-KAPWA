import { useState, useEffect, useCallback } from "react";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { statusLabel } from "@/i18n/display";
import {
  ArrowLeft,
  User,
  MapPin,
  Users as UsersIcon,
  Gift,
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
import { api, uploadSignature, uploadReceipt, dataURItoBlob, downloadCertificate, type CertificateType } from "../lib/api";
import { queryKeys } from "../lib/query-keys";
import { FamilyGraph } from "../components/family/FamilyGraph";
import { ConsentManager } from "../components/consent/ConsentManager";
import SignaturePad from "../components/forms/SignaturePad";
import { PageShell } from "@/components/PageShell";
import { CardGridSkeleton } from "@/components/skeletons/CardGridSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface BeneficiaryDetail {
  id: string;
  name: string;
  age: number;
  birthDate: string;
  gender: string;
  contact: string;
  barangay: string;
  purok: string;
  category: string;
  placeOfBirth: string;
  civilStatus: string;
  householdSize: number;
  status: string;
  accessCardCode?: string;
  cases: {
    id: string;
    program: string;
    status: string;
    date: string;
    amount?: string;
  }[];
  interventions: {
    id: string;
    type: string;
    description: string;
    date: string;
    fundSource?: string;
  }[];
}

interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  age: number;
  occupation?: string;
  income?: number;
  status?: string;
  isPrimary: boolean;
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
  const { data: casesRes } = useSWR<{ data: Array<Record<string, unknown>>; total: number }>(
    queryKeys.cases.list(),
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

  const [interventionCaseId, setInterventionCaseId] = useState<string | null>(
    null,
  );
  const [intForm, setIntForm] = useState({
    type: "FA",
    amount: "",
    fundSource: "Regular",
  });
  const [intSigDataUrl, setIntSigDataUrl] = useState<string | null>(null);
  const [intReceiptFile, setIntReceiptFile] = useState<File | null>(null);
  const [intSubmitting, setIntSubmitting] = useState(false);
  const [intError, setIntError] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState("");
  const [certGenerating, setCertGenerating] = useState<CertificateType | null>(null);
  const [certError, setCertError] = useState("");
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [beneficiary, setBeneficiary] = useState<BeneficiaryDetail | null>(
    null,
  );

  const { data: cardSummary } = useSWR<{ cardCode: string; total: number; byCategory: Record<string, number> }>(
    id && beneficiary?.accessCardCode ? queryKeys.accessCards.summary(id) : null,
  );

  useEffect(() => {
    if (!id) return;
    if (ben) {
      const b = ben as Record<string, unknown>;
      const age = b.dob
        ? (() => {
            const today = new Date();
            const birth = new Date(b.dob as string);
            let a = today.getFullYear() - birth.getFullYear();

            // Compare month and day correctly
            const hasNotPassedBirthday =
              today.getMonth() < birth.getMonth() ||
              (today.getMonth() === birth.getMonth() &&
                today.getDate() < birth.getDate());

            if (hasNotPassedBirthday) a--;
            return a;
          })()
        : 0;
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
        category: (b.category as string) || "",
        placeOfBirth: (b.placeOfBirth as string) || "",
        civilStatus: (b.civilStatus as string) || "",
        householdSize: famGraph?.totalCount || 1,
        status: (b.consentStatus as string) || "active",
        accessCardCode: (b.accessCardCode as string) || undefined,
        cases: beneficiaryCases.map((c: Record<string, unknown>) => {
          const sr = c.serviceRequested;
          return {
            id: c.id as string,
            program: Array.isArray(sr) ? sr.join(", ") : (c.controlNo as string) || "",
            status: (c.status as string) || "pending",
            date: c.createdAt
              ? new Date(c.createdAt as string).toLocaleDateString()
              : "",
          };
        }),
        interventions: [],
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

  async function handleLogIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!interventionCaseId) return;
    setIntError("");
    setIntSubmitting(true);
    try {
      let workerSignatureUrl = "";
      let receiptUrl = "";

      if (intSigDataUrl) {
        const blob = dataURItoBlob(intSigDataUrl);
        workerSignatureUrl = await uploadSignature(
          blob,
          `sig-${Date.now()}.png`,
        );
      }

      if (intReceiptFile) {
        receiptUrl = await uploadReceipt(intReceiptFile, intReceiptFile.name);
      }

      await api.post(`/cases/${interventionCaseId}/interventions`, {
        serviceName: intForm.type,
        category: intForm.type,
        deliveryDate: new Date().toISOString().split('T')[0],
        amount: parseFloat(intForm.amount) || 0,
        fundSource: intForm.fundSource,
      });

      setInterventionCaseId(null);
      setIntForm({ type: "FA", amount: "", fundSource: "Regular" });
      setIntSigDataUrl(null);
      setIntReceiptFile(null);
    } catch (err: any) {
      setIntError(err.message || t("beneficiaries.logInterventionFailed", "Failed to log intervention"));
    }
    setIntSubmitting(false);
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

  async function handleGenerateCertificate(type: CertificateType) {
    if (!beneficiary) return;
    setCertGenerating(type);
    setCertError("");
    try {
      await downloadCertificate(type, {
        fullName: beneficiary.name,
        address:
          ((ben as Record<string, unknown>)?.address as string) ||
          [beneficiary.purok, beneficiary.barangay].filter(Boolean).join(", ") ||
          undefined,
        date: new Date().toISOString().split("T")[0],
      });
    } catch (err: any) {
      setCertError(err.message || t("beneficiaries.certFailed", "Failed to generate certificate"));
    } finally {
      setCertGenerating(null);
    }
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
        backTo={{ label: t("beneficiaries.back", "Back"), onClick: () => navigate(-1) }}
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
      backTo={{ label: t("beneficiaries.back", "Back"), onClick: () => navigate(-1) }}
    >
      {assignSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm font-medium text-green-700 mb-3">
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
                    <MapPin size={13} /> {beneficiary.barangay}
                    {beneficiary.purok ? `, ${beneficiary.purok}` : ""}
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
              <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
                {family.map((m, i) => {
                  const bgColors = ["bg-muted/40", "bg-muted/20", "bg-muted/30"];
                  const dotColors = ["bg-primary", "bg-accent", "bg-secondary"];
                  return (
                    <div key={m.id} className={`rounded-lg ${bgColors[i % 3]} px-3 py-2 transition-colors hover:bg-muted/50`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.isPrimary ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"} text-[10px] font-semibold shadow-sm`}>
                            {m.fullName.charAt(0)}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ${dotColors[i % 3]} ring-1 ring-card`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-foreground truncate">{m.fullName}</p>
                              {m.isPrimary && <span className="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-medium text-primary leading-none">{t("beneficiaries.primary", "Primary")}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>{m.relationship}</span><span>&middot;</span><span>{m.age} {t("beneficiaries.yearsShort", "yrs")}</span>
                              {m.occupation && <><span>&middot;</span><span className="truncate">{m.occupation}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.status && <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground leading-none">{m.status}</span>}
                          {m.income != null && <span className="text-[10px] font-semibold text-foreground">₱{Number(m.income).toLocaleString()}</span>}
                        </div>
                      </div>
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
                    philhealthNumber: (ben.philhealthNumber as string) || "",
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
                        {c.status === "transitioning" && (
                          <Button variant="default" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setInterventionCaseId(c.id === interventionCaseId ? null : c.id)}>
                            <ClipboardList size={10} className="mr-1" /> {t("beneficiaries.log", "Log")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center gap-2 text-primary mb-3">
                <Gift size={16} />
                <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.interventions", "Interventions")}</h3>
              </div>
              {beneficiary.interventions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("beneficiaries.noInterventions", "No interventions recorded")}</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {beneficiary.interventions.map((intv) => (
                    <div key={intv.id} className="rounded bg-muted/50 px-2.5 py-2 text-sm">
                      <p className="font-medium text-foreground">{intv.type}</p>
                      <p className="text-xs text-muted-foreground">{intv.description}</p>
                      {intv.fundSource && <p className="text-xs font-medium text-primary">{t("beneficiaries.fundLabel", "Fund: {{source}}", { source: intv.fundSource })}</p>}
                      <p className="text-xs text-muted-foreground">{intv.date}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>


          </div>

          {/* Intervention Form */}
          {interventionCaseId && (
            <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <ClipboardList size={16} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.logIntervention", "Log Intervention")}</h3>
                </div>
                <span className="text-xs text-muted-foreground">{t("beneficiaries.caseLabel", "Case: {{id}}", { id: interventionCaseId })}</span>
              </div>
              {intError && <div className="mb-3 rounded bg-destructive/10 p-2 text-xs text-destructive">{intError}</div>}
              <form onSubmit={handleLogIntervention} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("beneficiaries.type", "Type")}</label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" value={intForm.type} onChange={e => setIntForm({ ...intForm, type: e.target.value })} aria-label={t("beneficiaries.interventionType", "Intervention Type")}>
                      <option value="FA">{t("beneficiaries.intFinancial", "Financial Assistance")}</option>
                      <option value="C">{t("beneficiaries.intCounseling", "Counseling")}</option>
                      <option value="CSR">CSR</option>
                      <option value="R">{t("beneficiaries.intReferral", "Referral")}</option>
                      <option value="H">{t("beneficiaries.intHealthcare", "Healthcare")}</option>
                      <option value="HV">{t("beneficiaries.intHomeVisit", "Home Visit")}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("beneficiaries.amount", "Amount (₱)")}</label>
                    <input className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" type="number" min="0" step="0.01" value={intForm.amount} onChange={e => setIntForm({ ...intForm, amount: e.target.value })} aria-label={t("beneficiaries.amount", "Amount")} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("beneficiaries.fundSource", "Fund Source")}</label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" value={intForm.fundSource} onChange={e => setIntForm({ ...intForm, fundSource: e.target.value })} aria-label={t("beneficiaries.fundSource", "Fund Source")}>
                      <option value="Regular">{t("beneficiaries.fundRegular", "Regular")}</option><option value="PDAF">PDAF</option><option value="Legislative">{t("beneficiaries.fundLegislative", "Legislative")}</option><option value="Donation">{t("beneficiaries.fundDonation", "Donation")}</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SignaturePad onSave={(dataUrl: string) => setIntSigDataUrl(dataUrl)} label={t("beneficiaries.workerSignature", "Worker Signature")} />
                  <div className="space-y-1">
                    <label className="text-xs font-medium">{t("beneficiaries.receiptOptional", "Receipt (optional)")}</label>
                    <input type="file" accept="image/*" className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground" onChange={e => setIntReceiptFile(e.target.files?.[0] || null)} aria-label={t("beneficiaries.clientReceipt", "Client Receipt")} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={intSubmitting}>{intSubmitting ? t("beneficiaries.saving", "Saving...") : t("beneficiaries.submitIntervention", "Submit Intervention")}</Button>
                  <Button variant="outline" size="sm" type="button" onClick={() => { setInterventionCaseId(null); setIntError(""); setIntSigDataUrl(null); setIntReceiptFile(null); }}>{t("beneficiaries.cancel", "Cancel")}</Button>
                </div>
              </form>
            </div>
          )}
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

          {/* Certificates */}
          <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
            <div className="flex items-center gap-2 text-primary mb-3">
              <FileText size={16} />
              <h3 className="text-xs font-semibold uppercase tracking-wider">{t("beneficiaries.certificates", "Certificates")}</h3>
            </div>
            {certError && (
              <div className="mb-3 rounded bg-destructive/10 p-2 text-xs text-destructive">{certError}</div>
            )}
            <div className="space-y-2">
              <Button size="sm" className="w-full" onClick={() => handleGenerateCertificate("indigency")} disabled={certGenerating !== null}>
                {certGenerating === "indigency" ? t("beneficiaries.generating", "Generating...") : t("beneficiaries.certIndigency", "Certificate of Indigency")}
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => handleGenerateCertificate("eligibility")} disabled={certGenerating !== null}>
                {certGenerating === "eligibility" ? t("beneficiaries.generating", "Generating...") : t("beneficiaries.certEligibility", "Certificate of Eligibility")}
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => handleGenerateCertificate("referral")} disabled={certGenerating !== null}>
                {certGenerating === "referral" ? t("beneficiaries.generating", "Generating...") : t("beneficiaries.certReferral", "Certificate of Referral")}
              </Button>
            </div>
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
