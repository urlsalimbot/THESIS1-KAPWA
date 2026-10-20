import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { humanizeError } from '@/lib/errors';
import { INTERVENTION_TYPES } from '@/lib/constants';
import { useInterventionCatalog, type CustomServiceType } from '@/hooks/useInterventionCatalog';

/**
 * The intervention catalog: the built-in services KAPWA ships (national
 * vocabulary, read-only) plus the local services an admin adds here. A custom
 * code is the slug of its name and is fixed once created — interventions store
 * it — so retiring one deactivates it instead of deleting what old rows point at.
 */
export function InterventionCatalogPage() {
  const { t } = useTranslation();
  const { services, isLoading, mutate } = useInterventionCatalog();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [financial, setFinancial] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const activeCount = services.filter((s) => s.isActive).length;

  async function add() {
    if (label.trim().length < 2) {
      toast.error(t('interventionCatalog.nameRequired', 'Enter the service name.'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/intervention-catalog', { label: label.trim(), isFinancial: financial });
      await mutate();
      toast.success(t('interventionCatalog.added', 'Service added to the catalog'));
      setOpen(false);
      setLabel('');
      setFinancial(false);
    } catch (e) {
      toast.error(humanizeError(e) || t('interventionCatalog.addFailed', 'Could not add the service'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(entry: CustomServiceType) {
    setBusyCode(entry.code);
    try {
      await api.patch(`/intervention-catalog/${entry.code}`, { isActive: !entry.isActive });
      await mutate();
    } catch (e) {
      toast.error(humanizeError(e) || t('interventionCatalog.toggleFailed', 'Could not update the service'));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <PageShell
      title={t('interventionCatalog.title', 'Intervention Catalog')}
      description={t(
        'interventionCatalog.description',
        'The services a case can record. Built-in services ship with KAPWA; add the local ones your office delivers.',
      )}
      actions={
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} className="mr-1.5" />
          {t('interventionCatalog.add', 'Add service')}
        </Button>
      }
    >
      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {t('interventionCatalog.customTitle', 'Local services')}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t('interventionCatalog.customCount', '{{active}} active of {{total}}', {
              active: activeCount,
              total: services.length,
            })}
          </span>
        </div>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('interventionCatalog.colName', 'Service')}</TableHead>
                <TableHead className="w-48">{t('interventionCatalog.colCode', 'Code')}</TableHead>
                <TableHead className="w-36">{t('interventionCatalog.colMoney', 'Money')}</TableHead>
                <TableHead className="w-28 text-right">{t('interventionCatalog.colActive', 'Offered')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-muted-foreground">
                    {t('interventionCatalog.loading', 'Loading...')}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && services.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center gap-1 py-6 text-center text-muted-foreground">
                      <Wrench size={24} className="opacity-40" aria-hidden="true" />
                      <span className="text-sm">{t('interventionCatalog.empty', 'No local services yet')}</span>
                      <span className="text-xs">
                        {t('interventionCatalog.emptyHint', 'A service added here appears in the intervention dialog for every case.')}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {services.map((entry) => (
                <TableRow key={entry.code} className={entry.isActive ? undefined : 'opacity-60'}>
                  <TableCell className="font-medium">{entry.label}</TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">{entry.code}</code>
                  </TableCell>
                  <TableCell>
                    {entry.isFinancial ? (
                      <Badge variant="secondary" className="whitespace-nowrap text-xs">
                        {t('interventionCatalog.moneyYes', 'Carries money')}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={entry.isActive}
                      disabled={busyCode === entry.code}
                      onCheckedChange={() => toggle(entry)}
                      aria-label={t('interventionCatalog.toggleAria', 'Offer {{name}} for new interventions', {
                        name: entry.label,
                      })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('interventionCatalog.builtInTitle', 'Built-in services')}</h2>
          <span className="text-xs text-muted-foreground">
            {t('interventionCatalog.builtInHint', 'Fixed: these carry the national reporting vocabulary.')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {INTERVENTION_TYPES.map((code) => (
            <Badge key={code} variant="outline" className="text-xs font-normal">
              {t(`interventionType.${code}`, code)}
            </Badge>
          ))}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('interventionCatalog.newTitle', 'Add a service')}</DialogTitle>
            <DialogDescription>
              {t(
                'interventionCatalog.newDesc',
                'It becomes available in the intervention dialog for every case. The code is derived from the name and cannot change later.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="catalog-label">{t('interventionCatalog.nameLabel', 'Service name *')}</Label>
              <Input
                id="catalog-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('interventionCatalog.namePlaceholder', 'e.g. Barangay medical mission')}
                autoFocus
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={financial}
                onCheckedChange={(v) => setFinancial(v === true)}
                aria-label={t('interventionCatalog.financialAria', 'This service carries money')}
              />
              <span>
                {t('interventionCatalog.financial', 'This service carries money')}
                <span className="block text-xs text-muted-foreground">
                  {t('interventionCatalog.financialHint', 'Adds amount, mode of delivery and fund source to the form.')}
                </span>
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t('interventionCatalog.cancel', 'Cancel')}
            </Button>
            <Button onClick={add} disabled={saving}>
              {saving ? t('interventionCatalog.saving', 'Saving...') : t('interventionCatalog.add', 'Add service')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
