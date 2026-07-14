import { useLocation } from 'react-router-dom';
import { HelpCircle, Lightbulb, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { usePageInfo } from '@/lib/page-info-context';

interface HelpEntry {
  q: string;
  a: string;
}

interface RouteHelp {
  title: string;
  icon?: string;
  tips: string[];
  faqs: HelpEntry[];
}

const ROUTE_HELP: Record<string, RouteHelp> = {
  '/dashboard': {
    title: 'Dashboard',
    tips: [
      'Review the summary cards for a quick overview of caseload and pending items.',
      'Use the chart to spot trends in intake, approvals, and interventions.',
      'Click any metric card to navigate directly to the relevant section.',
    ],
    faqs: [
      { q: 'Why don\'t I see any data?', a: 'The dashboard reflects only data you have permission to view. If you were just granted access, try refreshing.' },
      { q: 'How often does the dashboard update?', a: 'Data refreshes automatically when you navigate here, or you can manually refresh the page.' },
    ],
  },
  '/intake': {
    title: 'GIS Intake Form',
    tips: [
      'Fill in all required fields — the form validates before submission.',
      'Attach supporting documents before finalizing the intake.',
      'After submission, the case moves to the approval pipeline.',
    ],
    faqs: [
      { q: 'Can I save a draft?', a: 'Yes — use the Save Draft button. Drafts appear in your pending cases.' },
      { q: 'What if I make a mistake?', a: 'You can edit the intake before it enters the approval pipeline. Once approved, changes are restricted.' },
    ],
  },
  '/cases': {
    title: 'Case Tracker',
    tips: [
      'Filter cases by status, priority, or assigned social worker.',
      'Click a case row to view full details and case history.',
      'Use the search bar to find a specific case by name or reference number.',
    ],
    faqs: [
      { q: 'What do the status colors mean?', a: 'Green = active, Yellow = pending review, Red = urgent, Grey = closed.' },
      { q: 'Can I reassign a case?', a: 'Yes — open the case and use the Reassign option in the actions menu. You need coordinator or admin rights.' },
    ],
  },
  '/beneficiaries': {
    title: 'Beneficiaries',
    tips: [
      'Search by name, household ID, or barangay to find records quickly.',
      'Export beneficiary lists for offline reporting.',
      'Keep household data current — outdated info can delay assistance.',
    ],
    faqs: [
      { q: 'How do I add a new beneficiary?', a: 'Use the GIS Intake form to register a new client. Beneficiaries are created through the intake process.' },
      { q: 'Can I edit beneficiary information?', a: 'Yes — open the beneficiary profile and click Edit. Changes are logged for audit.' },
    ],
  },
  '/interventions': {
    title: 'Interventions',
    tips: [
      'Log interventions only after disbursement is confirmed.',
      'Attach receipts and supporting documents to each intervention record.',
      'Use the category filter to group by assistance type.',
    ],
    faqs: [
      { q: 'What counts as an intervention?', a: 'Any post-disbursement assistance activity — counselling, skills training, medical aid, or food packs.' },
      { q: 'Can I backdate an intervention?', a: 'Yes, but the date must be within the case\'s active period. The system flags out-of-range dates.' },
    ],
  },
  '/tracker': {
    title: 'Daily Case Tracker',
    tips: [
      'This is the "God Database" tally — log cases chronologically.',
      'Use the date picker to view historical entries.',
      'Each entry corresponds to a client interaction for the day.',
    ],
    faqs: [
      { q: 'How is this different from Case Tracker?', a: 'The Daily Tracker is a chronological log of all client interactions, while Case Tracker organizes by individual case.' },
      { q: 'Can I delete an entry?', a: 'Only admins can delete entries. Social workers can edit but not remove.' },
    ],
  },
  '/messages': {
    title: 'Messages',
    tips: [
      'Use messages for internal team coordination — this is not a client communication channel.',
      'Unread messages appear in bold with a blue dot.',
      'You can message any MSWDO team member across barangays.',
    ],
    faqs: [
      { q: 'Are messages confidential?', a: 'Messages are internal to MSWDO staff. They are not shared with clients or external parties.' },
      { q: 'Can I send attachments?', a: 'Currently text-only. For file sharing, upload to the case record and reference it in the message.' },
    ],
  },
  '/notifications': {
    title: 'Notifications',
    tips: [
      'Notifications alert you to case updates, approvals, and system events.',
      'Use "Mark all read" to clear the badge counter.',
      'Click a notification to navigate to the relevant record.',
    ],
    faqs: [
      { q: 'Why am I not getting notifications?', a: 'Check your notification preferences in Settings. Some notifications are role-specific.' },
      { q: 'How long are notifications kept?', a: 'Notifications older than 30 days are automatically archived.' },
    ],
  },
  '/approvals': {
    title: 'Approval Pipeline',
    tips: [
      'Review each case carefully — approving incomplete intakes causes downstream issues.',
      'Use the sign-off workflow for Certificates of Eligibility and Petty Cash Vouchers.',
      'Add remarks to explain approval or rejection decisions.',
    ],
    faqs: [
      { q: 'What happens when I reject a case?', a: 'The case returns to the social worker\'s queue with your rejection remarks for revision.' },
      { q: 'Can I delegate approval?', a: 'Yes — coordinators can delegate to another eligible staff member in Settings.' },
    ],
  },
  '/settings': {
    title: 'Settings',
    tips: [
      'Enable two-factor authentication for added account security.',
      'Configure notification preferences to control which alerts you receive.',
      'Profile changes are saved immediately.',
    ],
    faqs: [
      { q: 'Can I reset my password here?', a: 'Yes — use the Security section to change your password. You\'ll need your current password.' },
      { q: 'What if I lose my 2FA device?', a: 'Contact an administrator to reset your 2FA configuration.' },
    ],
  },
  '/admin': {
    title: 'Admin Panel',
    tips: [
      'Manage user accounts, roles, and system-wide settings.',
      'Audit logs track all configuration changes.',
      'Be cautious when modifying system-level settings.',
    ],
    faqs: [
      { q: 'Can I create custom roles?', a: 'Roles are predefined. You can assign multiple roles to a user if needed.' },
      { q: 'How do I export audit logs?', a: 'Use the Export button in the Audit section to download logs as CSV.' },
    ],
  },
  '/csr': {
    title: 'CSR Generator',
    tips: [
      'Select a beneficiary to auto-populate case study fields.',
      'Review the generated report before printing.',
      'CSR documents are stored in the beneficiary\'s record.',
    ],
    faqs: [
      { q: 'What format are CSRs generated in?', a: 'CSRs are generated as formatted documents ready for printing or PDF export.' },
      { q: 'Can I customize the template?', a: 'Templates follow MSWDO standards. Contact an admin for template modifications.' },
    ],
  },
  '/filing': {
    title: 'Digital Filing',
    tips: [
      'Upload documents in PDF or image format for case records.',
      'Tag documents with categories for easier retrieval.',
      'Signed documents can be uploaded alongside unsigned versions.',
    ],
    faqs: [
      { q: 'Is there a file size limit?', a: 'Individual files are capped at 10 MB. For larger files, split them into multiple uploads.' },
      { q: 'Are uploaded documents backed up?', a: 'Yes — all documents are stored securely with automated backups.' },
    ],
  },
  '/irf': {
    title: 'Incident Report Forms (IRF)',
    tips: [
      'IRFs are for VAWC/RA 9262 cases — handle with sensitivity.',
      'Attach blotter entry numbers for cross-referencing police records.',
      'All IRF data is PII-protected and access-restricted.',
    ],
    faqs: [
      { q: 'Who can view IRF records?', a: 'Access is restricted to authorized social workers and administrators handling VAWC cases.' },
      { q: 'Can I print an IRF?', a: 'Yes — use the Print option in the IRF detail view for a formatted copy.' },
    ],
  },
  '/access-cards': {
    title: 'Access Cards',
    tips: [
      'Access Cards serve as beneficiary identification for aid distribution.',
      'Print and laminate cards for distribution to eligible beneficiaries.',
      'Verify beneficiary information before generating a card.',
    ],
    faqs: [
      { q: 'How is an Access Card different from a Beneficiary record?', a: 'The Access Card is a printable ID document. The beneficiary record is the full case profile.' },
      { q: 'Can I replace a lost card?', a: 'Yes — generate a new card from the beneficiary profile. Old cards are invalidated.' },
    ],
  },
  '/programs': {
    title: 'Programs & Assignments',
    tips: [
      'Configure assistance programs and their eligibility criteria.',
      'Assign social workers to programs for workload distribution.',
      'Program changes require admin-level confirmation.',
    ],
    faqs: [
      { q: 'Can I run multiple programs simultaneously?', a: 'Yes — programs are independent and can run concurrently with different eligibility rules.' },
      { q: 'How do I archive a completed program?', a: 'Use the Archive toggle in program settings. Archived programs are read-only.' },
    ],
  },
  '/my-dashboard': {
    title: 'My Dashboard (Claimant)',
    tips: [
      'Track your case status and assistance history from one place.',
      'Review and manage your data-sharing consents.',
      'Contact MSWDO through the provided contact information.',
    ],
    faqs: [
      { q: 'How do I update my personal information?', a: 'Contact your assigned social worker or visit the MSWDO office to update records.' },
      { q: 'Where can I see my access card?', a: 'Use the My Access Card link to view and print your digital access card.' },
    ],
  },
  '/my-access-card': {
    title: 'My Access Card',
    tips: [
      'This is your digital KAPWA Access Card — read-only view.',
      'Present this card when claiming assistance at MSWDO.',
      'Print a copy for offline use.',
    ],
    faqs: [
      { q: 'Can I download my access card?', a: 'Use the print function to save as PDF for offline access.' },
      { q: 'My information is incorrect — what do I do?', a: 'Contact your assigned social worker to request a correction.' },
    ],
  },
  '/coordinator': {
    title: 'Coordinator Dashboard',
    tips: [
      'Monitor barangay-level social welfare activities.',
      'View team workload distribution and case assignments.',
      'Generate barangay-level summary reports.',
    ],
    faqs: [
      { q: 'What data appears on the coordinator dashboard?', a: 'Aggregated data from all barangays under your supervision, filtered by your jurisdiction.' },
      { q: 'Can I assign cases to specific social workers?', a: 'Yes — use the Assign option in any case detail view.' },
    ],
  },
  '/reports': {
    title: 'Reports (Mayor)',
    tips: [
      'Access municipal-level program and compliance overviews.',
      'Filter reports by barangay, program, or date range.',
      'Export reports for presentation to the municipal council.',
    ],
    faqs: [
      { q: 'What reports are available?', a: 'Program compliance, beneficiary counts, disbursement summaries, and case statistics.' },
      { q: 'Can I schedule recurring reports?', a: 'This feature is not yet available. Reports are generated on-demand.' },
    ],
  },
  '/audit-logs': {
    title: 'Auditor Page',
    tips: [
      'Review all system activity for compliance monitoring.',
      'Filter logs by user, action type, or date range.',
      'Export audit trails for external audit requirements.',
    ],
    faqs: [
      { q: 'How far back do audit logs go?', a: 'Logs are retained for 12 months per MSWDO data retention policy.' },
      { q: 'Can I export the entire audit log?', a: 'Yes — use the Export button. Large datasets may take several minutes to generate.' },
    ],
  },
};

function resolveHelp(pathname: string): RouteHelp | null {
  if (ROUTE_HELP[pathname]) return ROUTE_HELP[pathname];
  const segment = '/' + pathname.split('/')[1];
  if (ROUTE_HELP[segment]) return ROUTE_HELP[segment];
  return null;
}

export default function PageInfoPopover() {
  const { pathname } = useLocation();
  const { title } = usePageInfo();
  const help = resolveHelp(pathname);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label="Help">
          <HelpCircle size={20} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">{help?.title || title || 'Help'}</span>
          </div>
        </div>

        {help ? (
          <div className="max-h-[360px] overflow-y-auto">
            {help.tips.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lightbulb size={12} />
                  Tips
                </p>
                <ul className="space-y-1.5">
                  {help.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                      <span className="text-muted-foreground/40 shrink-0 mt-0.5">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {help.faqs.length > 0 && (
              <>
                <Separator />
                <div className="px-4 py-3 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <RotateCcw size={12} />
                    FAQs
                  </p>
                  {help.faqs.map((faq, i) => (
                    <div key={i}>
                      <p className="text-xs font-medium text-foreground">{faq.q}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No help content available for this page.
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
