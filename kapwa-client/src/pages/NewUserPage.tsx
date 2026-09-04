import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { TFunction } from 'i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { PageShell } from '@/components/PageShell';

const ROLE_LABELS: Record<string, string> = {
  admin: 'MSWDO Admin',
  social_worker: 'MSWDO Social Worker',
  coordinator: 'Barangay Coordinator',
  claimant: 'Claimant',
  mayor: "Mayor's Office",
  auditor: 'Auditor',
  agency_staff: 'Agency Staff',
};

const ROLE_OPTIONS = Object.keys(ROLE_LABELS);

const makeNewUserSchema = (t: TFunction) => z.object({
  firstName: z
    .string()
    .min(1, t('usersPanel.firstNameRequired', 'Please enter a first name.'))
    .regex(/^[A-Za-z\s]+$/, t('auth.lettersOnly', 'Letters and spaces only.')),
  middleName: z
    .string()
    .optional()
    .refine((v) => !v || /^[A-Za-z\s]+$/.test(v), t('auth.lettersOnly', 'Letters and spaces only.')),
  lastName: z
    .string()
    .min(1, t('usersPanel.lastNameRequired', 'Please enter a last name.'))
    .regex(/^[A-Za-z\s]+$/, t('auth.lettersOnly', 'Letters and spaces only.')),
  nameExtension: z
    .string()
    .optional()
    .refine((v) => !v || /^[A-Za-z.\s]*$/.test(v), t('auth.lettersOnly', 'Letters and spaces only.')),
  email: z.string().email(t('auth.emailInvalid', 'Please enter a valid email address.')),
  password: z.string().min(8, t('usersPanel.passwordMin', 'Password must be at least 8 characters.')),
  role: z.string().min(1),
  phone: z.string().optional(),
  assignedBarangay: z.string().optional(),
  permittedBarangays: z.string().optional(),
  agencyId: z.string().optional(),
});

type NewUserValues = z.infer<ReturnType<typeof makeNewUserSchema>>;

export function NewUserPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const schema = useMemo(() => makeNewUserSchema(t), [t]);
  const { data: agencies } = useSWR<{ id: string; code: string; name: string }[]>(queryKeys.agencies.list());

  const form = useForm<NewUserValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '', middleName: '', lastName: '', nameExtension: '',
      email: '', password: '', role: 'social_worker', phone: '',
      assignedBarangay: '', permittedBarangays: '', agencyId: '',
    },
  });

  const role = form.watch('role');
  const roleLabel = (r: string) => t(`usersPanel.role.${r}`, ROLE_LABELS[r] || r);

  async function onSubmit(values: NewUserValues) {
    try {
      const body: Record<string, unknown> = {
        email: values.email,
        password: values.password,
        role: values.role,
        first_name: values.firstName,
        middle_name: values.middleName || undefined,
        last_name: values.lastName,
        name_extension: values.nameExtension || undefined,
      };
      if (values.phone) body.phone = values.phone;
      if (values.assignedBarangay) body.assigned_barangay = values.assignedBarangay;
      if (values.permittedBarangays?.trim()) {
        body.permitted_barangays = values.permittedBarangays.split(',').map(b => b.trim()).filter(Boolean);
      }
      if (role === 'agency_staff') {
        const agencyId = form.getValues('agencyId') as string | undefined;
        if (!agencyId) {
          toast.error(t('usersPanel.agencyRequired', 'Please select an agency.'));
          return;
        }
        body.agency_id = agencyId;
      }
      await api.post('/users', body);
      toast.success(t('usersPanel.userCreated', 'User created successfully'));
      navigate('/admin?tab=users');
    } catch (e: any) {
      toast.error(e?.message || t('usersPanel.createFailed', 'Failed to create user'));
    }
  }

  return (
    <PageShell
      title={t('usersPanel.newUserTitle', 'Create New User')}
      description={t('usersPanel.newUserDesc', 'Add a user to the system. Name parts match the users schema.')}
      backTo={{ label: t('usersPanel.backToUsers', 'Back to User Management'), onClick: () => navigate('/admin?tab=users') }}
    >
      <Card className="max-w-2xl shadow-sm border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-blue-500/10 p-2">
              <UserPlus size={18} className="text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">{t('usersPanel.newUserTitle', 'Create New User')}</CardTitle>
              <CardDescription className="text-xs">
                {t('usersPanel.newUserDesc', 'Add a user to the system. Name parts match the users schema.')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.firstName', 'First Name')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('auth.firstName', 'First Name')} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="middleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.middleName', 'Middle Name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('auth.middleName', 'Middle Name')} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.lastName', 'Last Name')} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t('auth.lastName', 'Last Name')} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nameExtension"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.nameExtension', 'Name Extension')}</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Jr., Sr., III" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.emailLabel', 'Email')} *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="user@example.com" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('usersPanel.password', 'Password')} *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t('usersPanel.minChars', 'Min 8 characters')} className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('usersPanel.roleCol', 'Role')} *</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-10" aria-label={t('usersPanel.roleCol', 'Role')}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('usersPanel.phone', 'Phone')}</FormLabel>
                      <FormControl>
                        <Input placeholder="09171234567" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {role === 'agency_staff' && (
                  <div className="space-y-1">
                    <Label htmlFor="new-agency">{t('usersPanel.agency', 'Agency')} *</Label>
                    <Select
                      value={(form.getValues('agencyId') as string) || ''}
                      onValueChange={(v) => form.setValue('agencyId' as any, v)}
                    >
                      <SelectTrigger id="new-agency" className="h-10" aria-label={t('usersPanel.agency', 'Agency')}>
                        <SelectValue placeholder={t('usersPanel.selectAgency', 'Select agency...')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(agencies || []).map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="assignedBarangay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('usersPanel.assignedBarangay', 'Assigned Barangay')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Norzagaray" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="permittedBarangays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('usersPanel.permittedBarangays', 'Permitted Barangays (comma-separated)')}</FormLabel>
                      <FormControl>
                        <Input placeholder="Norzagaray, Angat, San Jose" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-end gap-2 pt-2 pb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin?tab=users">
              <ArrowLeft size={14} className="mr-1" /> {t('usersPanel.cancel', 'Cancel')}
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={form.handleSubmit(onSubmit)}
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting && <Loader2 size={14} className="mr-2 animate-spin" />}
            {t('usersPanel.createUser', 'Create User')}
          </Button>
        </CardFooter>
      </Card>
    </PageShell>
  );
}