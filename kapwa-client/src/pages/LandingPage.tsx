import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HandHeart, ArrowRight } from 'lucide-react';
import { ServicesGrid } from '@/components/ServicesGrid';
import { ApplicationSteps } from '@/components/ApplicationSteps';
import { ContactInfo } from '@/components/ContactInfo';

export function LandingPage() {
  return (
    <div>
      {/* 1. Hero Section */}
      <section className="relative py-20 md:py-32 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/3 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 relative">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <HandHeart className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold leading-tight text-foreground mb-4">
            MSWDO Norzagaray
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Empowering communities through compassionate social welfare services — accessible to every resident of Norzagaray, Bulacan.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Button
              size="lg"
              className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-8 text-base font-semibold rounded-lg shadow-sm"
              onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Access Services
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" asChild className="h-12 px-8 text-base rounded-lg">
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
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <HandHeart className="w-6 h-6 text-accent" />
          </div>
          <h2 className="font-heading text-2xl font-semibold mb-4">
            About MSWDO Norzagaray
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
            The Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan is dedicated to providing comprehensive social welfare services to all residents. Our team of licensed social workers and dedicated staff work tirelessly to ensure that every individual and family in need receives the appropriate assistance, support, and care.
          </p>
          <Button variant="outline" asChild>
            <Link to="/about">
              Learn More
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* 5. Contact Section */}
      <section id="contact" className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-heading text-2xl font-semibold text-center mb-4">
            Get in Touch
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-10">
            Reach out to us in person, by phone, or through our online contact form. We are here to serve you.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ContactInfo />
            <div className="flex flex-col justify-center p-6 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-muted-foreground mb-6 leading-relaxed">
                We are here to help. Visit us during office hours or send us a message through our contact form.
              </p>
              <Button variant="outline" asChild className="self-start">
                <Link to="/contact">
                  Contact Us
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
