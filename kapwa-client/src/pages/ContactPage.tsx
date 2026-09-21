import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContactInfo } from '@/components/ContactInfo';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/public/PageContainer';
import { PageHero } from '@/components/public/PageHero';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export function ContactPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!name || name.trim().length < 2) {
      newErrors.name = t('contact.nameError', 'Name must be at least 2 characters.');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('contact.emailError', 'Please enter a valid email address.');
    }
    if (!message || message.trim().length < 10) {
      newErrors.message = t('contact.messageError', 'Message must be at least 10 characters.');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await api.post<{ id: string }>('/contact-messages', {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      });
      toast.success(t('contact.sendSuccess', 'Message sent'), {
        description: t('contact.sendSuccessDesc', 'We will respond within 1-2 business days.'),
      });
      setName('');
      setEmail('');
      setMessage('');
      setErrors({});
    } catch {
      toast.error(t('contact.sendFailed', 'Message failed'), {
        description: t('contact.sendFailedDesc', 'Please try again or call us directly.'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full py-12 sm:py-16 lg:py-20">
      <PageContainer>
        <PageHero
          icon={Mail}
          eyebrow={t('public.contactUs', 'Contact Us')}
          title={t('contact.title', 'Get in Touch')}
          description={t(
            'contact.subtitle',
            'We are here to help. Reach out to us through any of the channels below.'
          )}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left column: contact info. ContactInfo already renders office
              hours as one of its rows, so the page does not repeat them. */}
          <div className="lg:col-span-5">
            <h2 className="mb-4 font-heading text-lg font-semibold tracking-tight">
              {t('contact.officeInformation', 'Office Information')}
            </h2>
            <ContactInfo />
          </div>

          {/* Right column: contact form */}
          <div className="lg:col-span-7">
            <Card className="border-border/60 p-6 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="name">{t('contact.name', 'Name')}</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder={t('contact.namePlaceholder', 'Your full name')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                    className={cn('h-11', errors.name && 'border-destructive')}
                  />
                  {errors.name && (
                    <p id="name-error" role="alert" className="text-sm text-destructive">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('contact.email', 'Email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    className={cn('h-11', errors.email && 'border-destructive')}
                  />
                  {errors.email && (
                    <p id="email-error" role="alert" className="text-sm text-destructive">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">{t('contact.message', 'Message')}</Label>
                  <Textarea
                    id="message"
                    placeholder={t('contact.messagePlaceholder', 'How can we help you?')}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={!!errors.message}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                    className={cn(errors.message && 'border-destructive')}
                    rows={5}
                  />
                  {errors.message && (
                    <p id="message-error" role="alert" className="text-sm text-destructive">
                      {errors.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="brand"
                  className="h-11 w-full"
                  disabled={submitting}
                >
                  {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {submitting
                    ? t('contact.sending', 'Sending...')
                    : t('contact.sendMessage', 'Send Message')}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
