import { TeamSection } from '@/components/TeamSection';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageContainer } from '@/components/public/PageContainer';
import { Heart, Stethoscope, Cross, GraduationCap, Briefcase, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const programs = [
  { title: 'Social Pension', description: 'Monthly stipend for senior citizens aged 60 and above.', icon: Heart },
  { title: 'Medical Assistance', description: 'Financial support for medical treatment and hospitalization.', icon: Stethoscope },
  { title: 'Burial Assistance', description: 'Financial aid for funeral expenses of qualified residents.', icon: Cross },
  { title: 'Educational Assistance', description: 'Scholarship and educational support for deserving students.', icon: GraduationCap },
  { title: 'Livelihood Programs', description: 'Skills training and seed capital for small business startups.', icon: Briefcase },
  { title: 'Crisis Intervention', description: 'Emergency assistance for individuals and families in crisis.', icon: ShieldAlert },
];

export function AboutPage() {
  const { t } = useTranslation();

  // Facts drawn from the system's own configuration: the registration
  // barangay list and the service catalogue above.
  const facts = [
    { label: t('about.established', 'Established'), value: '1995' },
    { label: t('about.barangaysServed', 'Barangays served'), value: '13' },
    { label: t('about.coreServices', 'Core services'), value: String(programs.length) },
  ];

  return (
    <div className="w-full">
      {/* Hero — the right column carries the office facts instead of the
          previous external stock photo. */}
      <section className="pb-14 pt-12 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20">
        <PageContainer>
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/15">
                <Heart size={28} className="text-accent" aria-hidden="true" />
              </div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                About Us
              </p>
              <h1 className="mb-4 text-balance font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
                About MSWDO Norzagaray
              </h1>
              <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Serving the community of Norzagaray with dedication and compassion since 1995.
              </p>
            </div>

            <div className="lg:col-span-5">
              <div className="grid grid-cols-3 gap-4 rounded-3xl border border-border/70 bg-card p-6 shadow-lg">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <p className="font-heading text-3xl font-bold tabular-nums tracking-tight text-accent">
                      {fact.value}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{fact.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Mission */}
      <section className="pb-16 sm:pb-20 lg:pb-24">
        <PageContainer>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-4">
              <h2 className="mb-4 font-heading text-3xl font-semibold tracking-tight">
                Our Mission
              </h2>
              <div className="h-1 w-12 rounded-full bg-accent/30" />
            </div>
            <div className="lg:col-span-8">
              <p className="max-w-3xl text-pretty leading-relaxed text-muted-foreground">
                The Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan
                is committed to promoting the well-being and quality of life of all residents,
                especially the poor, vulnerable, and marginalized sectors of society. We strive to
                provide equitable access to social welfare programs and services through efficient,
                transparent, and compassionate delivery. Our team works collaboratively with
                community partners, government agencies, and local stakeholders to create
                sustainable solutions that empower individuals, strengthen families, and build
                resilient communities.
              </p>
            </div>
          </div>
          <Separator className="mt-12" />
        </PageContainer>
      </section>

      {/* Team */}
      <section className="border-y border-border/60 bg-muted/40 py-16 sm:py-20 lg:py-24">
        <PageContainer>
          <TeamSection />
        </PageContainer>
      </section>

      {/* Programs */}
      <section className="py-16 sm:py-20 lg:py-24">
        <PageContainer>
          <div className="mb-12 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
              <span className="text-xs font-medium tracking-wide text-accent">What We Offer</span>
            </div>
            <h2 className="text-balance font-heading text-3xl font-semibold tracking-tight">
              Our Programs
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => {
              const Icon = program.icon;
              return (
                <Card
                  key={program.title}
                  className="group border-border/60 hover:-translate-y-1 hover:border-accent/30"
                >
                  <CardHeader className="pb-3">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 transition-colors duration-200 group-hover:bg-accent/20">
                      <Icon size={24} className="text-accent" aria-hidden="true" />
                    </div>
                    <CardTitle className="font-heading text-lg font-semibold tracking-tight">
                      {program.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="leading-relaxed text-muted-foreground">{program.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
