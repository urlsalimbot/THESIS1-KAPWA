import { useState } from 'react';
import { ContactInfo } from '@/components/ContactInfo';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!name || name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!message || message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Message sent! We'll respond within 1-2 business days.");
      setName('');
      setEmail('');
      setMessage('');
      setErrors({});
    } catch {
      toast.error('Message failed to send. Please try again or call us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto px-4 py-16 md:py-24">
      {/* Left column: Contact info */}
      <div>
        <h1 className="font-heading text-3xl font-bold mb-6">Get in Touch</h1>
        <ContactInfo />
        <p className="text-sm text-muted-foreground mt-6">
          Office Hours: Monday to Friday, 8:00 AM — 5:00 PM
        </p>
      </div>

      {/* Right column: Contact form */}
      <div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="How can we help you?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              aria-invalid={!!errors.message}
              rows={5}
            />
            {errors.message && (
              <p className="text-sm text-destructive mt-1">{errors.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="bg-accent text-accent-foreground hover:bg-accent/90 w-full"
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? 'Sending...' : 'Send Message'}
          </Button>
        </form>
      </div>
    </div>
  );
}
