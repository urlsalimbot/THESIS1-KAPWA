import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';
import { ServicesGrid } from '@/components/ServicesGrid';
import { ApplicationSteps } from '@/components/ApplicationSteps';
import { ContactInfo } from '@/components/ContactInfo';

export function LandingPage() {
  return (
    <div>
      {/* 1. Hero Section */}
      <section className="py-16 md:py-24 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <Shield className="w-12 h-12 text-accent mx-auto mb-6" />
          <h1 className="font-heading text-3xl md:text-4xl font-bold leading-tight text-foreground mb-4">
            MSWDO Norzagaray
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Empowering communities through compassionate social welfare services — accessible to every resident of Norzagaray, Bulacan.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90 h-11 px-8 text-base font-semibold rounded-md"
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Access Services
            </Button>
            <Button variant="outline" asChild>
              <Link to="/about">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Services Section */}
      <section id="services" className="bg-muted/50">
        <ServicesGrid />
      </section>

      {/* 3. Steps Section */}
      <section id="steps">
        <ApplicationSteps />
      </section>

      {/* 4. About Summary Section */}
      <section id="about" className="py-16 md:py-24 bg-muted/50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-heading text-2xl font-semibold text-center mb-4">
            About MSWDO Norzagaray
          </h2>
          <p className="text-muted-foreground max-w-3xl mx-auto text-center mb-6 leading-relaxed">
            The Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan is dedicated to providing comprehensive social welfare services to all residents. Our team of licensed social workers and dedicated staff work tirelessly to ensure that every individual and family in need receives the appropriate assistance, support, and care.
          </p>
          <Button variant="outline" asChild>
            <Link to="/about">Learn More →</Link>
          </Button>
        </div>
      </section>

      {/* 5. Contact Section */}
      <section id="contact" className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-heading text-2xl font-semibold text-center mb-8">
            Get in Touch
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <ContactInfo />
            <div className="flex flex-col justify-center">
              <p className="text-muted-foreground mb-6">
                We are here to help. Reach out to us during office hours.
              </p>
              <Button variant="outline" asChild className="self-start">
                <Link to="/contact">Contact Us →</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
