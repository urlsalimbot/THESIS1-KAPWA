import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HandHeart, ArrowRight } from 'lucide-react';
import { ServicesGrid } from '@/components/ServicesGrid';
import { ApplicationSteps } from '@/components/ApplicationSteps';
import { ContactInfo } from '@/components/ContactInfo';

export function LandingPage() {
  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* 1. Hero Section - Asymmetric layout with visual depth */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        {/* Background imagery and gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-muted/20" />
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-accent/5 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-accent/3 rounded-full blur-3xl opacity-40" />
        </div>
        
        <div className="relative grid md:grid-cols-12 gap-8 items-center">
          {/* Left content - spans 7 columns */}
          <div className="md:col-span-7 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <HandHeart size={16} className="text-accent" />
              <span className="text-xs font-medium text-accent tracking-wide">MSWDO Norzagaray</span>
            </div>
            
            <h1 className="font-heading text-5xl md:text-6xl font-bold leading-tight text-foreground mb-6 tracking-tight text-balance">
              Compassionate social welfare services for every resident
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed max-w-xl text-pretty">
              Empowering communities through accessible, transparent, and efficient social assistance programs in Norzagaray, Bulacan.
            </p>
            
            <div className="flex gap-4 flex-wrap">
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 h-12 px-8 text-base font-semibold rounded-lg shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Access Services
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button variant="outline" size="lg" asChild className="h-12 px-8 text-base rounded-lg">
                <Link to="/about">Learn More</Link>
              </Button>
            </div>
          </div>
          
          {/* Right visual element - spans 5 columns */}
          <div className="md:col-span-5 hidden md:block">
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-accent/10 to-muted/30 border border-border/50 overflow-hidden shadow-lg">
                <img 
                  src="https://picsum.photos/seed/kapwa-hero/600/600" 
                  alt="Community support and social welfare services in Norzagaray"
                  className="w-full h-full object-cover opacity-80 mix-blend-overlay"
                  loading="lazy"
                />
              </div>
              {/* Floating stat card */}
              <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-xl shadow-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Active Programs</p>
                <p className="text-2xl font-bold font-heading tracking-tight">24</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Services Section */}
      <section id="services" className="py-16 md:py-24 bg-muted/30 rounded-2xl -mx-4 px-4">
        <ServicesGrid />
      </section>

      {/* 3. Steps Section */}
      <section id="steps" className="py-16 md:py-24">
        <ApplicationSteps />
      </section>

      {/* 4. About Summary Section - Asymmetric layout */}
      <section id="about" className="py-16 md:py-24 bg-muted/30 rounded-2xl -mx-4 px-4">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5 hidden md:block">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-accent/5 to-muted/20 border border-border/50 overflow-hidden">
              <img 
                src="https://picsum.photos/seed/kapwa-about/600/450" 
                alt="MSWDO Norzagaray office and staff"
                className="w-full h-full object-cover opacity-70 mix-blend-overlay"
                loading="lazy"
              />
            </div>
          </div>
          
          <div className="md:col-span-7 md:col-start-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
              <HandHeart size={16} className="text-accent" />
            </div>
            <h2 className="font-heading text-3xl font-semibold mb-4 tracking-tight text-balance">
              About MSWDO Norzagaray
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6 max-w-lg text-pretty">
              The Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan is dedicated to providing comprehensive social welfare services to all residents. Our team of licensed social workers and dedicated staff work tirelessly to ensure that every individual and family in need receives the appropriate assistance, support, and care.
            </p>
            <Button variant="outline" asChild>
              <Link to="/about">
                Learn More
                <ArrowRight size={16} className="ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 5. Contact Section */}
      <section id="contact" className="py-16 md:py-24">
        <div className="grid md:grid-cols-12 gap-8">
          <div className="md:col-span-5">
            <h2 className="font-heading text-3xl font-semibold mb-4 tracking-tight text-balance">
              Get in Touch
            </h2>
            <p className="text-muted-foreground mb-6 leading-relaxed text-pretty">
              Reach out to us in person, by phone, or through our online contact form. We are here to serve you.
            </p>
          </div>
          
          <div className="md:col-span-7">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ContactInfo />
              <div className="flex flex-col justify-center p-6 rounded-xl bg-muted/20 border border-border/50">
                <p className="text-muted-foreground mb-6 leading-relaxed text-pretty">
                  We are here to help. Visit us during office hours or send us a message through our contact form.
                </p>
                <Button variant="outline" asChild className="self-start">
                  <Link to="/contact">
                    Contact Us
                    <ArrowRight size={16} className="ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
