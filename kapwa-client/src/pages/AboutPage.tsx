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
    <div>
      {/* Hero Header */}
      <section className="py-16 md:py-24 bg-muted/50 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="font-heading text-3xl md:text-4xl font-bold leading-tight mb-4">
            About MSWDO Norzagaray
          </h1>
          <p className="text-lg text-muted-foreground">
            Serving the community of Norzagaray with dedication and compassion.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-heading text-2xl font-semibold mb-6 text-center">
            Our Mission
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            The Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan is committed to promoting the well-being and quality of life of all residents, especially the poor, vulnerable, and marginalized sectors of society. We strive to provide equitable access to social welfare programs and services through efficient, transparent, and compassionate delivery. Our team works collaboratively with community partners, government agencies, and local stakeholders to create sustainable solutions that empower individuals, strengthen families, and build resilient communities.
          </p>
          <Separator className="my-12" />
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-muted/50">
        <TeamSection />
      </section>

      {/* Programs Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-heading text-2xl font-semibold mb-8 text-center">
            Our Programs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programs.map((program) => {
              const Icon = program.icon;
              return (
                <Card key={program.title} className="hover:border-accent/30 hover:shadow-md transition-all duration-200">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Icon className="w-6 h-6 text-accent" />
                      <CardTitle className="font-heading font-semibold">{program.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{program.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
