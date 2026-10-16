import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface IssuedAccount {
  username: string;
  temporaryPassword?: string;
  note?: string;
}

/**
 * The slip for a claimant who has no email address and no mobile number.
 *
 * `AccountProvisioningService` issues a claimant ID and a temporary password
 * instead of the one-time link it mails or texts to everyone else. That
 * response is the ONLY time the password exists in readable form — the database
 * holds a bcrypt hash — so this dialog is the whole recovery story: write it
 * down, print it, or copy it now.
 *
 * Kept apart from IntakePage for two reasons: the page is large, and a slip
 * that silently fails to render would be discovered at the counter rather than
 * here. It renders with `id="claimant-slip"`, which is what the print rule in
 * index.css keys on to hide the rest of the app.
 */
export function ClaimantCredentialsDialog({
  account,
  onDone,
}: {
  account: IssuedAccount;
  onDone: () => void;
}) {
  const { t } = useTranslation();

  const asText = () =>
    `${t('intake.claimantIdLabel', 'Claimant ID')}: ${account.username}\n` +
    `${t('intake.claimantPasswordLabel', 'Temporary password')}: ${account.temporaryPassword ?? ''}`;

  return (
    <AlertDialog open onOpenChange={() => undefined}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('intake.claimantAccountTitle', 'Write these on the claimant’s slip')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'intake.claimantAccountHint',
              'This claimant has no email address or mobile number, so the office issues the sign-in details. The password is shown once and cannot be recovered — if it is lost, issue a new one from the case.',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* The only thing that prints: the slip. */}
        <div id="claimant-slip" className="rounded-lg border bg-card p-4 space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('intake.claimantIdLabel', 'Claimant ID')}
            </p>
            <p className="font-mono text-lg font-semibold tracking-wide">{account.username}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('intake.claimantPasswordLabel', 'Temporary password')}
            </p>
            <p className="font-mono text-2xl font-semibold tracking-[0.2em]">{account.temporaryPassword}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'intake.claimantSignInHint',
              'Sign in at the KAPWA login page with this ID and password. The system will ask for a new password the first time.',
            )}
          </p>
        </div>

        <AlertDialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void navigator.clipboard?.writeText(asText()).then(
                () => toast.success(t('intake.claimantAccountCopied', 'Copied — paste it on the slip or send it to a printer')),
                () => toast.error(t('intake.claimantAccountCopyFailed', 'Could not copy — write the details down instead')),
              );
            }}
          >
            <Copy size={14} aria-hidden="true" /> {t('intake.claimantAccountCopy', 'Copy')}
          </Button>
          <Button type="button" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" /> {t('intake.claimantAccountPrint', 'Print slip')}
          </Button>
          <Button type="button" onClick={onDone}>
            {t('intake.claimantAccountDone', 'Open the case')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
