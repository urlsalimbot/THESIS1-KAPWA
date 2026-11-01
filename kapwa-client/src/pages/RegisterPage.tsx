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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, HandHeart, User, Mail, MapPin, Lock, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { AuthShell } from '@/components/public/AuthShell';
import { NAME_EXTENSIONS } from '@/lib/constants';

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
  firstName: z
    .string()
    .min(1, t('auth.firstNameRequired', 'Please enter your first name.'))
    .regex(/^[A-Za-z\s]+$/, t('auth.lettersOnly', 'Letters and spaces only.')),
  middleName: z
    .string()
    .optional()
    .refine((v) => !v || /^[A-Za-z\s]+$/.test(v), t('auth.lettersOnly', 'Letters and spaces only.')),
  lastName: z
    .string()
    .min(1, t('auth.lastNameRequired', 'Please enter your last name.'))
    .regex(/^[A-Za-z\s]+$/, t('auth.lettersOnly', 'Letters and spaces only.')),
  nameExtension: z
    .string()
    .optional()
    .refine((v) => !v || /^[A-Za-z.\s]*$/.test(v), t('auth.lettersOnly', 'Letters and spaces only.')),
  email: z.string().email(t('auth.emailInvalid', 'Please enter a valid email address.')),
  phone: z
    .string()
    .regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, t('auth.phoneInvalid', 'Please enter a valid phone number.')),
  sex: z.enum(['Male', 'Female'], { message: t('auth.sexRequired', 'Please select your sex.') }),
  placeOfBirth: z.string().min(1, t('auth.placeOfBirthRequired', 'Please enter your place of birth.')),
  civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled'], {
    message: t('auth.civilStatusRequired', 'Please select your civil status.'),
  }),
  street: z.string().min(1, t('auth.streetRequired', 'Please enter your street address.')),
  philsysNumber: z.string().optional(),
  occupation: z.string().min(1, t('auth.occupationRequired', 'Please enter your occupation.')),
  estimatedMonthlyIncome: z
    .string()
    .min(1, t('auth.incomeRequired', 'Please enter your estimated monthly income.'))
    .regex(/^\d+$/, t('auth.incomeInvalid', 'Enter a whole-number monthly income.')),
  isIndigenous: z.boolean(),
  consent: z.boolean().refine((v) => v === true, t('auth.consentRequired', 'Please confirm the data privacy consent.')),
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
  const [emailDelivered, setEmailDelivered] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      nameExtension: '',
      email: '',
      phone: '',
      sex: undefined as unknown as 'Male' | 'Female',
      placeOfBirth: '',
      civilStatus: undefined as unknown as 'Single' | 'Married' | 'Widowed' | 'Separated' | 'Annulled',
      street: '',
      philsysNumber: '',
      occupation: '',
      estimatedMonthlyIncome: '',
      isIndigenous: false,
      consent: false,
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
      const res = await api.post<{ email: string; emailDelivered?: boolean }>('/auth/register', {
        firstName: values.firstName,
        middleName: values.middleName,
        lastName: values.lastName,
        nameExtension: values.nameExtension,
        email: values.email,
        phone: values.phone,
        password: values.password,
        assignedBarangay: values.barangay,
        dob: values.dateOfBirth,
        intake: {
          beneficiary: {
            surname: values.lastName,
            firstName: values.firstName,
            middleName: values.middleName || undefined,
            extension: values.nameExtension && values.nameExtension !== 'N/A' ? values.nameExtension : undefined,
            gender: values.sex,
            dob: values.dateOfBirth,
            age: Math.floor((Date.now() - new Date(values.dateOfBirth).getTime()) / 31557600000),
            placeOfBirth: values.placeOfBirth,
            civilStatus: values.civilStatus,
            cellularNumber: values.phone.replace(/\s/g, ''),
            email: values.email,
            currentAddress: {
              street: values.street,
              barangay: values.barangay,
              city: 'Norzagaray',
              province: 'Bulacan',
              region: '03',
              postalCode: '3013',
            },
            philsysNumber: values.philsysNumber || undefined,
            occupation: values.occupation,
            estimatedMonthlyIncome: parseFloat(values.estimatedMonthlyIncome),
            isIndigenous: values.isIndigenous,
          },
          familyMembers: [],
        },
      });
      setEmailDelivered(res?.emailDelivered !== false);
      setRegisteredEmail(values.email);
    } catch {
      toast.error(t('auth.registrationFailed', 'Registration failed'), { description: t('auth.registrationFailedDesc', 'Please check your information and try again.') });
    } finally {
      setSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <AuthShell>
        <Card className="w-full border-border/50">
          <CardHeader className="text-center pb-6">
            <CardTitle as="h1" className="flex items-center justify-center gap-2.5 text-2xl font-bold tracking-tight">
              <HandHeart size={24} className="text-accent" aria-hidden="true" />{t('auth.checkYourEmail', 'Check Your Email')}</CardTitle>
            <CardDescription className="text-base">
              {t('auth.weSentVerificationLink', 'We sent a verification link to')} <strong>{registeredEmail}</strong>{t('auth.period', '.')}
              <br />
              {t('auth.checkInboxToActivate', 'Please check your inbox and click the link to activate your account.')}
              <br />
              {t('auth.pendingIntakeNotice', 'Your completed intake is now pending review by an MSWDO admin or social worker.')}
            </CardDescription>
            {!emailDelivered && (
              <div className="error-msg mt-3" role="alert">
                {t('auth.emailNotDelivered', 'The verification email could not be sent right now. Please contact the MSWDO office to activate your account.')}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.didntReceiveEmail', "Didn't receive the email? Check your spam folder or")}{' '}
              <Button variant="link"
                type="button"
                className="h-auto p-0"
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
              </Button>
            </p>
          </CardContent>
          <CardFooter className="justify-center pt-2 pb-6">
            <Button variant="link" asChild>
              <Link to="/login">{t('auth.backToSignIn', 'Back to Sign In')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  // Sectioned layout: the name quartet runs inline in one row, Date of Birth
  // sits with it, and contact / address / security get their own labelled
  // sections so the eye groups fields before reading a single label.
  return (
    <AuthShell cardWidth="lg">
      <Card className="w-full border-border/50">
        <CardHeader className="text-center pb-6">
          <CardTitle as="h1" className="flex items-center justify-center gap-2.5 text-2xl font-bold tracking-tight">
            <HandHeart size={24} className="text-accent" aria-hidden="true" />{t('auth.claimantRegistration', 'Claimant Registration')}</CardTitle>
          <CardDescription className="text-base">
            {t('auth.registerDescription', 'Create your account and submit your intake for MSWDO review. Middle name, name extension and PhilSys number may be left blank.')}
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
              {/* Personal Information — the name quartet runs inline */}
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <User size={18} className="text-primary" aria-hidden="true" />
                  {t('auth.sectionPersonal', 'Personal Information')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.firstName', 'First Name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('auth.firstName', 'First Name')} className="h-11 md:h-10" {...field} />
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
                          <Input placeholder={t('auth.middleName', 'Middle Name')} className="h-11 md:h-10" {...field} />
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
                        <FormLabel>{t('auth.lastName', 'Last Name')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('auth.lastName', 'Last Name')} className="h-11 md:h-10" {...field} />
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
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="h-11 md:h-10" aria-label={t('auth.nameExtension', 'Name Extension')}>
                              <SelectValue placeholder={t('auth.nameExtensionPlaceholder', 'Jr., Sr., III')} />
                            </SelectTrigger>
                            <SelectContent>
                              {NAME_EXTENSIONS.map((extension) => (
                                <SelectItem key={extension} value={extension}>{extension}</SelectItem>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="sex" render={({ field }) => (
                    <FormItem><FormLabel>{t('auth.sex', 'Sex')}</FormLabel><FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="flex h-10 items-center gap-4">
                        {['Male', 'Female'].map((sex) => (<label key={sex} className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value={sex} aria-label={sex} />{t(`auth.${sex.toLowerCase()}`, sex)}</label>))}
                      </RadioGroup>
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="placeOfBirth" render={({ field }) => (
                    <FormItem><FormLabel>{t('auth.placeOfBirth', 'Place of Birth')}</FormLabel><FormControl><Input placeholder={t('auth.placeOfBirth', 'Place of Birth')} className="h-11 md:h-10" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="civilStatus" render={({ field }) => (
                    <FormItem><FormLabel>{t('auth.civilStatus', 'Civil Status')}</FormLabel><FormControl>
                      <Select value={field.value} onValueChange={field.onChange}><SelectTrigger className="h-11 md:h-10" aria-label={t('auth.civilStatus', 'Civil Status')}><SelectValue placeholder={t('auth.selectCivilStatus', 'Select civil status')} /></SelectTrigger><SelectContent>{['Single', 'Married', 'Widowed', 'Separated', 'Annulled'].map((status) => (<SelectItem key={status} value={status}>{status}</SelectItem>))}</SelectContent></Select>
                    </FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
              <Separator />

              {/* Contact Details */}
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <Mail size={18} className="text-primary" aria-hidden="true" />
                  {t('auth.sectionContact', 'Contact Details')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </div>
              <Separator />

              {/* Address — the barangay select gets the full width it needs */}
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <MapPin size={18} className="text-primary" aria-hidden="true" />
                  {t('auth.sectionAddress', 'Address')}
                </h2>
                <FormField control={form.control} name="street" render={({ field }) => (
                  <FormItem><FormLabel>{t('auth.street', 'Street Address')}</FormLabel><FormControl><Input placeholder={t('auth.street', 'Street Address')} className="h-11 md:h-10" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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
              <Separator />

              {/* Employment & identity — the remaining General Intake fields */}
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <HandHeart size={18} className="text-primary" aria-hidden="true" />
                  {t('auth.sectionEmployment', 'Employment & Identity')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="occupation" render={({ field }) => (
                    <FormItem><FormLabel>{t('auth.occupation', 'Occupation')}</FormLabel><FormControl><Input placeholder={t('auth.occupation', 'Occupation')} className="h-11 md:h-10" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="estimatedMonthlyIncome" render={({ field }) => (
                    <FormItem><FormLabel>{t('auth.estimatedIncome', 'Estimated Monthly Income')}</FormLabel><FormControl><Input inputMode="numeric" placeholder="0" className="h-11 md:h-10" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="philsysNumber" render={({ field }) => (
                    <FormItem><FormLabel>{t('auth.philsysNumber', 'PhilSys Number')}</FormLabel><FormControl><Input placeholder={t('auth.optional', 'Optional')} className="h-11 md:h-10" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="isIndigenous" render={({ field }) => (
                  <FormItem><div className="flex items-center gap-2"><FormControl><Checkbox id="reg-is-indigenous" aria-label={t('auth.isIndigenous', 'Is an Indigenous Person (IP)')} checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} /></FormControl><FormLabel htmlFor="reg-is-indigenous" className="!mt-0 cursor-pointer">{t('auth.isIndigenous', 'Is an Indigenous Person (IP)')}</FormLabel></div><FormMessage /></FormItem>
                )} />
              </div>
              <Separator />

              {/* Account Security */}
              <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                  <Lock size={18} className="text-primary" aria-hidden="true" />
                  {t('auth.sectionSecurity', 'Account Security')}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.passwordLabel', 'Password')}</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder={t('auth.passwordLabel', 'Password')}
                              className="h-11 md:h-10 pr-10"
                              {...field}
                            />
                          </FormControl>
                          <Button variant="ghost" size="icon"
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                            aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                            aria-pressed={showPassword}
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </Button>
                        </div>
                        {/* Proactive length hint: don't wait for an invalid submit
                            to teach the constraint. Replaced by the error message
                            once validation actually fires. */}
                        {(!field.value || field.value.length < 8) && !form.formState.errors.password && (
                          <p className="text-xs text-muted-foreground">{t('auth.passwordHint', 'At least 8 characters')}</p>
                        )}
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
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showConfirmPassword ? 'text' : 'password'}
                              placeholder={t('auth.confirmPassword', 'Confirm Password')}
                              className="h-11 md:h-10 pr-10"
                              {...field}
                            />
                          </FormControl>
                          <Button variant="ghost" size="icon"
                            type="button"
                            onClick={() => setShowConfirmPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                            aria-label={showConfirmPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                            aria-pressed={showConfirmPassword}
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField control={form.control} name="consent" render={({ field }) => (
                <FormItem>
                  <div className="flex items-start gap-2">
                    <FormControl><Checkbox id="reg-consent" aria-label={t('auth.consentLabel', 'Data privacy consent')} checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} /></FormControl>
                    <FormLabel htmlFor="reg-consent" className="!mt-0 text-sm leading-relaxed text-muted-foreground">{t('auth.consentText', 'I confirm that my information may be recorded and processed under the Data Privacy Act (RA 10173) so MSWDO can review this intake.')}</FormLabel>
                  </div><FormMessage />
                </FormItem>
              )} />

              <Button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-11"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && <Loader2 size={16} className="mr-2 animate-spin" />}
                {t('auth.submitForReview', 'Submit Registration for Review')}
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
    </AuthShell>
  );
}
