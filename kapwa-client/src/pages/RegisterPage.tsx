import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { TFunction } from 'i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, HandHeart, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';

const barangays = [
  'Bangkal',
  'Baraka',
  'Bigte',
  'Bitungol',
  'Friendship Village Resources (FVR)',
  'Matictic',
  'Minuyan',
  'Partida',
  'Pinagtulayan',
  'Poblacion',
  'San Lorenzo',
  'San Mateo',
  'Tigbe',
];

const makeRegisterSchema = (t: TFunction) => z.object({
  fullName: z
    .string()
    .min(2, t('auth.fullNameRequired', 'Please enter your full name.'))
    .regex(/^[A-Za-z\s]+$/, t('auth.lettersOnly', 'Letters and spaces only.')),
  email: z.string().email(t('auth.emailInvalid', 'Please enter a valid email address.')),
  phone: z
    .string()
    .regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, t('auth.phoneInvalid', 'Please enter a valid phone number.')),
  password: z.string().min(8, t('auth.passwordMinLength', 'Password must be at least 8 characters.')),
  confirmPassword: z.string(),
  barangay: z.string().min(1, t('auth.selectBarangay', 'Please select your barangay.')),
  dateOfBirth: z.string().refine(
    (val) => {
      const age = Math.floor((Date.now() - new Date(val).getTime()) / 31557600000);
      return age >= 18;
    },
    t('auth.mustBe18', 'You must be at least 18 years old.')
  ),
}).refine((data) => data.password === data.confirmPassword, {
  message: t('auth.passwordsDontMatch', 'Passwords do not match.'),
  path: ['confirmPassword'],
});

type RegisterValues = z.infer<ReturnType<typeof makeRegisterSchema>>;

export function RegisterPage() {
  const { t } = useTranslation();
  const registerSchema = useMemo(() => makeRegisterSchema(t), [t]);
  const [serverError, setServerError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      barangay: '',
      dateOfBirth: '',
    },
  });

  async function onSubmit(values: RegisterValues) {
    setServerError('');
    setSubmitting(true);
    try {
      await api.post('/auth/register', {
        fullName: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        barangay: values.barangay,
        dateOfBirth: values.dateOfBirth,
      });
      setRegisteredEmail(values.email);
    } catch {
      toast.error(t('auth.registrationFailed', 'Registration failed'), { description: t('auth.registrationFailedDesc', 'Please check your information and try again.') });
    } finally {
      setSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="relative flex items-center justify-center min-h-screen px-4 overflow-hidden bg-background">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
        </div>
        <Card className="w-full max-w-md mx-auto relative shadow-lg border-border/50">
          <CardHeader className="text-center pb-6">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <HandHeart size={28} className="text-accent" />
            </div>
            <CardTitle className="text-2xl tracking-tight">{t('auth.checkYourEmail', 'Check Your Email')}</CardTitle>
            <CardDescription className="text-base">
              {t('auth.weSentVerificationLink', 'We sent a verification link to')} <strong>{registeredEmail}</strong>{t('auth.period', '.')}
              <br />
              {t('auth.checkInboxToActivate', 'Please check your inbox and click the link to activate your account.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.didntReceiveEmail', "Didn't receive the email? Check your spam folder or")}{' '}
              <button
                type="button"
                className="text-primary underline underline-offset-2 hover:no-underline"
                onClick={async () => {
                  try {
                    await api.post('/auth/resend-verification', { email: registeredEmail });
                    toast.success(t('auth.verificationEmailResent', 'Verification email resent'), { description: t('auth.checkYourInbox', 'Check your inbox.') });
                  } catch {
                    toast.error(t('auth.failedToResend', 'Failed to resend'), { description: t('auth.tryAgainLater', 'Try again later.') });
                  }
                }}
              >
                {t('auth.resend', 'resend')}
              </button>
            </p>
          </CardContent>
          <CardFooter className="justify-center pt-2 pb-6">
            <Button variant="link" asChild>
              <Link to="/login">{t('auth.backToSignIn', 'Back to Sign In')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen px-4 overflow-hidden bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-muted/20 rounded-full blur-3xl opacity-40" />
      </div>

      <Link to="/" className="absolute top-6 left-6 z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline">
        <ArrowLeft size={16} /> {t('auth.backToHome', 'Back to Home')}
      </Link>

      <Card className="w-full max-w-lg mx-auto relative shadow-lg border-border/50">
        <CardHeader className="text-center pb-6">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <HandHeart size={24} className="text-accent" />
          </div>
          <CardTitle className="text-2xl tracking-tight">{t('auth.claimantRegistration', 'Claimant Registration')}</CardTitle>
          <CardDescription className="text-base">
            {t('auth.registerDescription', 'Create an account to track your services and applications.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serverError && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mb-4" role="alert">
              {serverError}
            </div>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.fullName', 'Full Name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('auth.fullName', 'Full Name')} className="h-11 md:h-10" {...field} />
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
                      <FormLabel>{t('auth.emailLabel', 'Email')}</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder={t('auth.emailLabel', 'Email')} className="h-11 md:h-10" {...field} />
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
                      <FormLabel>{t('auth.phoneLabel', 'Phone')}</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="09XX XXX XXXX" className="h-11 md:h-10" {...field} />
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
                      <FormLabel>{t('auth.passwordLabel', 'Password')}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t('auth.passwordLabel', 'Password')} className="h-11 md:h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.confirmPassword', 'Confirm Password')}</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={t('auth.confirmPassword', 'Confirm Password')} className="h-11 md:h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="barangay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.barangay', 'Barangay')}</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11 md:h-10" aria-label={t('auth.selectBarangay', 'Select barangay')}>
                            <SelectValue placeholder={t('auth.selectBarangay', 'Select barangay')} />
                          </SelectTrigger>
                          <SelectContent>
                            {barangays.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.dateOfBirth', 'Date of Birth')}</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-11 md:h-10" aria-label={t('auth.dateOfBirth', 'Date of Birth')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                {t('auth.createAccount', 'Create Account')}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6">
          <Button variant="link" asChild>
            <Link to="/login">{t('auth.alreadyHaveAccount', 'Already have an account? Sign in')}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
