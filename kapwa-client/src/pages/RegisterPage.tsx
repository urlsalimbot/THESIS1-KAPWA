import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const barangays = [
  'Bangkal', 'Binitagan', 'Bitungol', 'Matictic', 'Maturanoc',
  'Minantok', 'Palayan', 'Pandawan', 'Pinagtulayan', 'Poblacion',
  'San Mateo', 'Tigbe',
];

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Please enter your full name.')
    .regex(/^[A-Za-z\s]+$/, 'Letters and spaces only.'),
  email: z.string().email('Please enter a valid email address.'),
  phone: z
    .string()
    .regex(/^09\d{2}\s?\d{3}\s?\d{4}$/, 'Please enter a valid phone number.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  barangay: z.string().min(1, 'Please select your barangay.'),
  dateOfBirth: z.string().refine(
    (val) => {
      const age = Math.floor((Date.now() - new Date(val).getTime()) / 31557600000);
      return age >= 18;
    },
    'You must be at least 18 years old.'
  ),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const [serverError, setServerError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

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
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          password: values.password,
          barangay: values.barangay,
          dateOfBirth: values.dateOfBirth,
        }),
      });

      if (!res.ok) throw new Error('Registration failed');

      // Auto-login after successful registration
      await login(values.email, values.password);
      navigate('/my-dashboard', { replace: true });
    } catch {
      toast.error('Registration failed. Please check your information and try again.');
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-8">
      <Card className="w-full max-w-lg mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="font-heading">Claimant Registration</CardTitle>
          <CardDescription>
            Create an account to track your services and applications.
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
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Full Name" className="h-11 md:h-10" {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email" className="h-11 md:h-10" {...field} />
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
                      <FormLabel>Phone</FormLabel>
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
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Password" className="h-11 md:h-10" {...field} />
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
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm Password" className="h-11 md:h-10" {...field} />
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
                      <FormLabel>Barangay</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="h-11 md:h-10">
                            <SelectValue placeholder="Select barangay" />
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
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-11 md:h-10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="link" asChild>
            <Link to="/login">Already have an account? Sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
