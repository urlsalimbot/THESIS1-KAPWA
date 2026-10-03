import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Mail, Reply, Inbox } from 'lucide-react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { formatDate } from '@/lib/format';
import { humanizeError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: 'new' | 'read';
  createdAt: string;
}

/**
 * The public contact-form inbox, shown inside the messages page.
 *
 * Staff reply by email: the visitor gave their address on the public form, so
 * the reply goes there rather than into this app — the visitor may never have
 * an account here. Replying marks the message read, since reading it is a
 * precondition for answering it.
 */
export function ContactMessagesPanel() {
  const { t } = useTranslation();
  const { data: messages = [], mutate } = useSWR<ContactMessage[]>(queryKeys.messages.contactMessages());
  const [replyTo, setReplyTo] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  async function handleReply() {
    if (!replyTo || !replyText.trim()) return;
    setReplying(true);
    try {
      await api.post(`/contact-messages/${replyTo.id}/reply`, { content: replyText.trim() });
      setReplyTo(null);
      setReplyText('');
      await mutate();
      toast.success(t('messages.replySent', 'Reply sent'));
    } catch (err) {
      toast.error(t('messages.replyFailed', 'Could not send the reply'), {
        description: humanizeError(err),
      });
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Inbox size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{t('messages.contactTitle', 'Contact Messages')}</h2>
        <span className="text-[11px] text-muted-foreground">
          {t('messages.contactCount', '{{count}} inquiries', { count: messages.length })}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Mail size={28} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">{t('messages.noContactTitle', 'No inquiries yet')}</p>
            <p className="mt-1 text-xs">{t('messages.noContactHint', 'Messages from the public contact form appear here.')}</p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map((m) => (
              <div key={m.id} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <Badge variant={m.status === 'new' ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                        {m.status === 'new'
                          ? t('messages.statusNew', 'New')
                          : t('messages.statusRead', 'Read')}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{m.email} · {formatDate(m.createdAt)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1.5"
                    onClick={() => { setReplyTo(m); setReplyText(''); }}
                  >
                    <Reply size={13} />
                    {t('messages.reply', 'Reply')}
                  </Button>
                </div>
                {m.subject && (
                  <p className="mt-2 text-xs font-medium text-foreground">{m.subject}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">{m.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!replyTo} onOpenChange={(open) => { if (!open) { setReplyTo(null); setReplyText(''); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('messages.replyTo', 'Reply to {{name}}', { name: replyTo?.name ?? '' })}
            </DialogTitle>
          </DialogHeader>
          {replyTo && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{replyTo.email}</p>
                {replyTo.subject && <p className="mt-1">{replyTo.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap break-words">{replyTo.message}</p>
              </div>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={t('messages.replyPlaceholder', 'Write your reply…')}
                rows={6}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  {t('messages.replyHint', 'Sent as an email to {{email}}', { email: replyTo.email })}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setReplyTo(null); setReplyText(''); }}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button size="sm" onClick={handleReply} disabled={!replyText.trim() || replying}>
                    <Mail size={14} className="mr-1.5" />
                    {replying ? t('messages.sending', 'Sending…') : t('messages.sendReply', 'Send email')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
