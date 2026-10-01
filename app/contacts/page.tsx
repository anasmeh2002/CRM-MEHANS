'use client';


import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Mail, Phone, AlertCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Avatar, Badge } from '@/components/shared';
import { fetchContacts } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { useGlobalModal } from '@/components/modal-provider';
import type { Contact } from '@/lib/types';
import { useLanguage } from '@/components/language-provider';
import { useAgency } from '@/components/agency-provider';

export default function ContactsPage() {
  const { t } = useLanguage();
  const { currency } = useAgency();
  const [search, setSearch] = useState('');
  const { data: contacts, loading, error, refetch } = useSupabaseQuery(fetchContacts);
  const { openModal } = useGlobalModal();

  // Refetch when the window regains focus (e.g. after closing the create modal).
  useEffect(() => {
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refetch]);

  const list: Contact[] = contacts ?? [];
  const filtered = list.filter((c) =>
    `${c.first_name ?? ''} ${c.last_name ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell>
      <PageHeader title={t('page.contacts')} description={t('page.contactsDescription')}>
        <button onClick={() => openModal('contact')} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t('navbar.newLead')}
        </button>
      </PageHeader>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3.5 py-2.5 max-w-md">
        <Search className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('contacts.searchContacts')}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {error ? (
        <Card>
          <div className="flex items-center gap-3 text-text-secondary">
            <AlertCircle className="h-5 w-5 text-red-500" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-text-primary">{t('contacts.couldntLoad')}</p>
              <p className="text-xs text-text-muted">{error}</p>
            </div>
          </div>
        </Card>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg-secondary p-5">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 animate-pulse rounded-full bg-border" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-border" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-border" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-border" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-border" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <div className="space-y-1.5">
                  <div className="h-3 w-16 animate-pulse rounded bg-border" />
                  <div className="h-3.5 w-20 animate-pulse rounded bg-border" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-border" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary">
              <Search className="h-5 w-5 text-text-muted" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-sm font-medium text-text-primary">{t('contacts.noContacts')}</p>
            <p className="mt-1 text-xs text-text-muted">
              {search ? t('contacts.tryDifferentSearch') : t('contacts.createFirst')}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((contact, i) => {
            const name = `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim();
            const avatarColor = contact.avatarColor || '#D4AF37';
            const value = contact.value ?? 0;
            const lastContact = contact.updated_at
              ? new Date(contact.updated_at).toLocaleDateString()
              : t('common.na');

            return (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card hover>
                  <div className="flex items-start gap-3">
                    <Avatar name={name} color={avatarColor} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{name}</p>
                      <p className="truncate text-xs text-text-muted">{contact.role}</p>
                      <p className="mt-0.5 truncate text-xs text-gold">{contact.company}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Mail className="h-3.5 w-3.5" strokeWidth={1.5} /> <span className="truncate">{contact.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <Phone className="h-3.5 w-3.5" strokeWidth={1.5} /> {contact.phone}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <p className="text-xs text-text-muted">{t('contacts.dealValue')}</p>
                      <p className="text-sm font-semibold text-gold">{formatCurrency(value, currency)}</p>
                    </div>
                    <Badge variant="neutral">{lastContact}</Badge>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
