'use client';


import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Globe, Users, TrendingUp, Building2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge } from '@/components/shared';
import { fetchContacts } from '@/lib/data';
import { formatCurrency } from '@/lib/format';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Contact } from '@/lib/types';
import { toast } from 'sonner';

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const { data, loading, error } = useSupabaseQuery<Contact[]>(fetchContacts, []);

  const contacts = data ?? [];
  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader title="Companies" description={`${contacts.length} companies in your portfolio`}>
        <button onClick={() => toast.success('New company form opened')} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> New Company
        </button>
      </PageHeader>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3.5 py-2.5 max-w-md">
        <Search className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-bg-elevated" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-bg-elevated" />
                  <div className="h-2 w-32 animate-pulse rounded bg-bg-elevated" />
                  <div className="h-2 w-20 animate-pulse rounded bg-bg-elevated" />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="space-y-1.5">
                    <div className="h-2 w-12 animate-pulse rounded bg-bg-elevated" />
                    <div className="h-3 w-10 animate-pulse rounded bg-bg-elevated" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-text-muted">{error}</p>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-text-muted">
              {contacts.length === 0 ? 'No companies found.' : 'No companies match your search.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contact, i) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <Card hover>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-[#0D0D0F]"
                    style={{ background: contact.avatarColor }}
                  >
                    {(contact.company ?? contact.name)[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{contact.company ?? contact.name}</p>
                    <p className="text-xs text-text-muted">{contact.role ?? 'Contact'}</p>
                    {contact.email && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gold">
                        <Globe className="h-3 w-3" strokeWidth={1.5} /> {contact.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <Users className="h-3 w-3" strokeWidth={1.5} /> Contact
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-text-primary">{contact.name}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> Value
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-text-primary">{formatCurrency(contact.value)}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-xs text-text-muted">
                      <Building2 className="h-3 w-3" strokeWidth={1.5} /> Last Contact
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-text-primary">{contact.lastContact}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
