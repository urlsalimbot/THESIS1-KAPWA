import { Link } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { HandHeart, MapPin, Phone, Mail } from 'lucide-react';

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/#services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
];

const contactDetails = [
  { icon: MapPin, text: 'Municipal Social Welfare and Development Office, Norzagaray, Bulacan' },
  { icon: Phone, text: '(044) 123-4567' },
  { icon: Mail, text: 'mswdo@norzagaray.gov.ph' },
];

export function PublicFooter() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Column 1: Brand */}
          <div>
            <Link to="/" className="inline-flex items-center gap-2 mb-3 no-underline group">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center transition-all duration-200 group-hover:shadow-md">
                <HandHeart size={16} className="text-accent" />
              </div>
              <span className="font-heading text-xl font-bold text-foreground tracking-tight">KAPWA</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
              MSWDO Norzagaray — Empowering communities through compassionate social welfare services.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground mb-4 tracking-wide">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:translate-x-0.5"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h4 className="font-heading text-sm font-semibold text-foreground mb-4 tracking-wide">Contact Us</h4>
            <ul className="space-y-3">
              {contactDetails.map((detail) => {
                const Icon = detail.icon;
                return (
                  <li key={detail.text} className="flex gap-3 items-start">
                    <Icon size={20} className="text-accent mt-0.5 shrink-0" />
                    <span className="text-sm text-muted-foreground">{detail.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MSWDO Norzagaray. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link to="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Accessibility
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
