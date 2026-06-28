import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MapPin, Phone, Mail } from 'lucide-react';

export function PublicFooter() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Column 1: LGU branding */}
          <div>
            <h3 className="font-heading text-xl font-bold mb-2">KAPWA</h3>
            <p className="text-sm text-muted-foreground">MSWDO Norzagaray</p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="font-heading text-sm font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link to="/">Home</Link>
                </Button>
              </li>
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link to="/about">About</Link>
                </Button>
              </li>
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link to="/#services">Services</Link>
                </Button>
              </li>
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link to="/contact">Contact</Link>
                </Button>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact Info */}
          <div>
            <h4 className="font-heading text-sm font-semibold mb-3">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex gap-3 items-start">
                <MapPin className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Municipal Social Welfare and Development Office, Norzagaray, Bulacan
                </span>
              </li>
              <li className="flex gap-3 items-start">
                <Phone className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">(044) XXX-XXXX</span>
              </li>
              <li className="flex gap-3 items-start">
                <Mail className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">mswdo@norzagaray.gov.ph</span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        <p className="text-center text-sm text-muted-foreground pt-2">
          &copy; 2026 MSWDO Norzagaray. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
