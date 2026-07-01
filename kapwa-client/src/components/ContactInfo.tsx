import { cn } from '@/lib/utils';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

interface ContactInfoProps {
  className?: string;
}

const contactDetails = [
  { label: 'Address', value: 'Municipal Social Welfare and Development Office, Norzagaray, Bulacan', icon: MapPin },
  { label: 'Phone', value: '(044) 123-4567', icon: Phone },
  { label: 'Email', value: 'mswdo@norzagaray.gov.ph', icon: Mail },
  { label: 'Office Hours', value: 'Monday to Friday, 8:00 AM - 5:00 PM', icon: Clock },
];

export function ContactInfo({ className }: ContactInfoProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {contactDetails.map((detail) => {
        const Icon = detail.icon;
        return (
          <div key={detail.label} className="flex gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors duration-200">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{detail.label}</p>
              <p className="text-sm text-foreground">{detail.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
