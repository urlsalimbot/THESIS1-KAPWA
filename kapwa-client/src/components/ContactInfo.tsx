import { cn } from '@/lib/utils';

interface ContactInfoProps {
  className?: string;
}

const contactDetails = [
  { label: 'Address', value: 'Municipal Social Welfare and Development Office, Norzagaray, Bulacan' },
  { label: 'Phone', value: '(044) 123-4567' },
  { label: 'Email', value: 'mswdo@norzagaray.gov.ph' },
  { label: 'Office Hours', value: 'Monday to Friday, 8:00 AM - 5:00 PM' },
];

export function ContactInfo({ className }: ContactInfoProps) {
  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-4">
          Visit Us
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          Reach out to us in person, by phone, or through our online contact form. We are here to serve you.
        </p>
        <div className="max-w-lg mx-auto space-y-6">
          {contactDetails.map((detail) => (
            <div key={detail.label} className="flex flex-col sm:flex-row sm:gap-4">
              <span className="font-medium text-sm text-muted-foreground sm:w-32 shrink-0">{detail.label}</span>
              <span className="text-base">{detail.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
