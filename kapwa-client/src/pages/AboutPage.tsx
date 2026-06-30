import { TeamSection } from '@/components/TeamSection';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Heart, Stethoscope, Cross, GraduationCap, Briefcase, ShieldAlert } from 'lucide-react';

const programs = [
  { title: 'Social Pension', description: 'Monthly stipend for senior citizens aged 60 and above.', icon: Heart },
  { title: 'Medical Assistance', description: 'Financial support for medical treatment and hospitalization.', icon: Stethoscope },
  { title: 'Burial Assistance', description: 'Financial aid for funeral expenses of qualified residents.', icon: Cross },
  { title: 'Educational Assistance', description: 'Scholarship and educational support for deserving students.', icon: GraduationCap },
  { title: 'Livelihood Programs', description: 'Skills training and seed capital for small business startups.', icon: Briefcase },
  { title: 'Crisis Intervention', description: 'Emergency assistance for individuals and families in crisis.', icon: ShieldAlert },
];

export function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4">
      {/* Hero Header - Asymmetric layout */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-muted/20 rounded-full blur-3xl opacity-40" />
        </div>
        
        <div className="relative grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <span className="text-xs font-medium text-accent tracking-wide">About Us</span>
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold leading-tight mb-4 tracking-tight text-balance">
              About MSWDO Norzagaray
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl text-pretty">
              Serving the community of Norzagaray with dedication and compassion since 1995.
            </p>
          </div>
          
          <div className="md:col-span-5 hidden md:block">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-accent/10 to-muted/30 border border-border/50 overflow-hidden shadow-lg">
              <img 
                src="https://picsum.photos/seed/kapwa-about-hero/600/450" 
                alt="MSWDO Norzagaray community outreach program"
                className="w-full h-full object-cover opacity-70 mix-blend-overlay"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 md:py-24">
        <div className="grid md:grid-cols-12 gap-8">
          <div className="md:col-span-4">
            <h2 className="font-heading text-3xl font-semibold mb-4 tracking-tight">Our Mission</h2>
            <div className="w-12 h-1 bg-accent/30 rounded-full mb-6" />
          </div>
          <div className="md:col-span-8">
            <p className="text-base text-muted-foreground leading-relaxed text-pretty">
              The Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan is committed to promoting the well-being and quality of life of all residents, especially the poor, vulnerable, and marginalized sectors of society. We strive to provide equitable access to social welfare programs and services through efficient, transparent, and compassionate delivery. Our team works collaboratively with community partners, government agencies, and local stakeholders to create sustainable solutions that empower individuals, strengthen families, and build resilient communities.
            </p>
          </div>
        </div>
        <Separator className="my-12" />
      </section>

      {/* Team Section */}
      <section className="py-16 md:py-24 bg-muted/30 rounded-2xl -mx-4 px-4">
        <TeamSection />
      </section>

      {/* Programs Section - Asymmetric grid */}
      <section className="py-16 md:py-24">
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <span className="text-xs font-medium text-accent tracking-wide">What We Offer</span>
          </div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance">Our Programs</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {programs.map((program, index) => {
            const Icon = program.icon;
            return (
              <Card key={program.title} className="hover:border-accent/30 hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
                    <Icon size={24} className="text-accent" />
                  </div>
                  <CardTitle className="font-heading font-semibold text-lg tracking-tight">{program.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{program.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
