import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { FileText, Calendar, Clock, CheckCircle, XCircle, Shield } from 'lucide-react';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ApprovalStep {
  stepName: string;
  approverRole: string;
  slaDays: number;
  order: number;
}

interface ProgramDetail {
  id: string;
  name: string;
  category?: string;
  waitingPeriodDays?: number;
  legalBasis?: string;
  requiredDocuments?: string[];
  fundSources?: string[];
  approvalWorkflow?: ApprovalStep[];
  formTemplate?: Record<string, unknown>;
  formVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: program, isLoading } = useSWR<ProgramDetail>(
    id ? queryKeys.programs.detail(id) : null,
  );

  if (isLoading) {
    return (
      <PageShell title="Loading..." description="">
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading program...</div>
      </PageShell>
    );
  }

  if (!program) {
    return (
      <PageShell title="Program Not Found" description="" backTo={{ label: 'Back to Programs', onClick: () => navigate('/programs') }}>
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText size={40} className="mb-3 opacity-30" />
          <p className="text-sm">Program not found.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={program.name}
      description={program.category || 'Intervention Program'}
      backTo={{ label: 'Back to Programs', onClick: () => navigate('/programs') }}
      actions={
        <Badge variant={program.isActive ? 'default' : 'secondary'} className={`${program.isActive ? 'bg-emerald-500' : ''}`}>
          {program.isActive ? 'Active' : 'Inactive'}
        </Badge>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* === LEFT (2/3) — Main Content === */}
        <div className="lg:col-span-2 space-y-4">
          {/* Program Info */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{program.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Created {new Date(program.createdAt).toLocaleDateString()} &middot;
                  Updated {new Date(program.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Separator />
            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Category</span>
                <p className="font-medium">{program.category || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Legal Basis</span>
                <p className="font-medium">{program.legalBasis || '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Waiting Period</span>
                <p className="font-medium">{program.waitingPeriodDays != null ? `${program.waitingPeriodDays} days` : '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Form Version</span>
                <p className="font-medium">{program.formVersion}</p>
              </div>
            </div>
          </div>

          {/* Approval Workflow */}
          {program.approvalWorkflow && program.approvalWorkflow.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-2">
                <Shield size={16} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold">Approval Workflow</h2>
                <span className="text-xs text-muted-foreground ml-auto">{program.approvalWorkflow.length} step{program.approvalWorkflow.length > 1 ? 's' : ''}</span>
              </div>
              <Separator />
              <div className="px-4 py-3 space-y-2">
                {program.approvalWorkflow
                  .sort((a, b) => a.order - b.order)
                  .map((s, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        {s.order + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{s.stepName}</p>
                        <p className="text-xs text-muted-foreground">Approver: {s.approverRole} &middot; SLA: {s.slaDays}d</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Required Documents */}
          {program.requiredDocuments && program.requiredDocuments.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 flex items-center gap-2">
                <FileText size={16} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold">Required Documents</h2>
                <span className="text-xs text-muted-foreground ml-auto">{program.requiredDocuments.length} item{program.requiredDocuments.length > 1 ? 's' : ''}</span>
              </div>
              <Separator />
              <div className="px-4 py-3">
                <ul className="list-disc list-inside text-sm space-y-1 text-foreground">
                  {program.requiredDocuments.map((doc, i) => (
                    <li key={i}>{doc}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* === RIGHT (1/3) — Sidebar === */}
        <div className="space-y-4">
          {/* Fund Sources */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold">Fund Sources</h2>
            </div>
            <Separator />
            <div className="px-4 py-3">
              {program.fundSources && program.fundSources.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {program.fundSources.map((fs, i) => (
                    <Badge key={i} variant="outline">{fs}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None configured</p>
              )}
            </div>
          </div>

          {/* Form Template */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center gap-2">
              <FileText size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold">Form Template</h2>
            </div>
            <Separator />
            <div className="px-4 py-3">
              <p className="text-sm text-foreground">
                {program.formTemplate ? 'Configured' : 'None'}
              </p>
              {program.formTemplate && (
                <p className="text-xs text-muted-foreground mt-1">
                  {Object.keys(program.formTemplate).length} field{Object.keys(program.formTemplate).length > 1 ? 's' : ''} defined
                </p>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 flex items-center gap-2">
              <Calendar size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold">Metadata</h2>
            </div>
            <Separator />
            <div className="px-4 py-3 space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Created</span>
                <p className="font-medium">{new Date(program.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Updated</span>
                <p className="font-medium">{new Date(program.updatedAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Status</span>
                <p className="font-medium flex items-center gap-1 mt-0.5">
                  {program.isActive ? <CheckCircle size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-muted-foreground" />}
                  {program.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
