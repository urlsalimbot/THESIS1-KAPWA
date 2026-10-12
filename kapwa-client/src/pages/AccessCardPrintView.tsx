import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { AccessCard } from '../components/cards/AccessCard';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function AccessCardPrintView() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<{ code: string; beneficiary: any; services: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(t('accessCard.noBeneficiaryId', 'No beneficiary ID provided'));
      return;
    }
    api.get<{ code: string; beneficiary: any; services: any[] }>(`/access-cards/beneficiary/${id}/card`)
      .then((data: any) => {
        setCard(data);
        setLoading(false);
      })
      .catch(() => {
        setCard(null);
        setError(t('accessCard.noCard', 'No Access Card'));
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">{t('accessCard.loadingCardData', 'Loading card data...')}</p>
      </div>
    );
  }

  if (error || !card || !card.beneficiary) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-lg font-semibold text-muted-foreground">{t('accessCard.noCard', 'No Access Card')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('accessCard.noCardBody', 'This beneficiary has no Access Card. Generate and assign one to enable card-based tracking.')}
        </p>
      </div>
    );
  }

  const beneficiary = {
    id: card.beneficiary.id || id || '',
    surname: card.beneficiary.surname || '',
    firstName: card.beneficiary.first_name || card.beneficiary.firstName || '',
    barangay: card.beneficiary.barangay || '',
    accessCardCode: card.code || '',
  };

  return (
    <div className="print-container">
      <div className="no-print mb-4 flex justify-end">
        <Button variant="ghost"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm text-white hover:bg-primary-dark"
        >
          <Printer size={16} />
          {t('accessCard.printCard', 'Print Card')}
        </Button>
      </div>
      {/* Printed output is always white-paper, whatever the app's theme — the
          PDF preview must not print a dark card. */}
      <div className="rounded-lg border border-border bg-white p-6">
        <AccessCard beneficiary={beneficiary} services={card.services || []} printable />
      </div>
    </div>
  );
}
