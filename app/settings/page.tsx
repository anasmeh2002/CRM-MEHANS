'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Shield, Plug, Code,
  Check, Plus, Trash2, Copy, Loader2, Zap, Workflow, Upload, Image as ImageIcon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar } from '@/components/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import {
  fetchAgency, updateAgency, uploadAgencyLogo,
  fetchProfiles, updateProfileRole, deactivateProfile, createProfile,
  fetchRolePermissions, updateRolePermission,
  fetchIntegrations,
  fetchApiKeys, createApiKey, revokeApiKey,
} from '@/lib/data';
import { fetchN8nConfig, saveN8nConfig, testN8nConnection } from '@/lib/automations';
import type { AgencyProfile, RolePermissionRow, IntegrationRow, ApiKeyRow } from '@/lib/data';
import type { TeamMember } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/language-provider';
import { useAuth } from '@/components/auth-provider';
import { CURRENCY_OPTIONS, type CurrencyCode } from '@/lib/format';

const tabDefs = [
  { id: 'organization', labelKey: 'settings.organization', icon: Building2 },
  { id: 'users', labelKey: 'settings.users', icon: Users },
  { id: 'permissions', labelKey: 'settings.permissions', icon: Shield },
  { id: 'integrations', labelKey: 'settings.integrations', icon: Plug },
  { id: 'automations', labelKey: 'page.automations', icon: Workflow },
  { id: 'api', labelKey: 'settings.apiKeys', icon: Code },
];

const integrationMeta: Record<string, { icon: string; descriptionKey: string; color: string }> = {
  'WhatsApp Business': { icon: 'W', descriptionKey: 'settings.whatsappDescription', color: '#25D366' },
};

const modules = ['leads', 'properties', 'deals', 'tasks', 'meetings', 'contacts'];
const roles = ['owner', 'admin', 'manager', 'agent'];

export default function SettingsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('organization');

  return (
    <AppShell>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabDefs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  activeTab === tab.id ? 'bg-gold-bg text-gold' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        <div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'organization' && <OrganizationTab />}
              {activeTab === 'users' && <UsersTab />}
              {activeTab === 'permissions' && <PermissionsTab />}
              {activeTab === 'integrations' && <IntegrationsTab />}
              {activeTab === 'automations' && <AutomationsTab />}
              {activeTab === 'api' && <ApiTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Organization ──────────────────────────────────────────────────────────

function OrganizationTab() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const { data: agency, loading, error, refetch } = useSupabaseQuery<AgencyProfile | null>(fetchAgency);
  const [form, setForm] = useState<AgencyProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
useEffect(() => {
  if (session?.access_token) refetch();
}, [session?.access_token]);
  useEffect(() => {
    if (agency) {
      setForm(agency);
    } else if (!loading && !error) {
      setForm({
        id: '', name: '', logo_url: null, email: null, phone: null, website: null,
        city: null, country: null, description: null, address: null, currency: 'MAD',
      });
    }
  }, [agency, loading, error]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('settings.logoInvalidFile'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('settings.logoTooLarge'));
      return;
    }
    setUploadingLogo(true);
    try {
      const url = await uploadAgencyLogo(file);
      if (!url) throw new Error('Upload failed');
      setForm((prev) => prev ? { ...prev, logo_url: url } : prev);
      const updatedAgency = await updateAgency(form?.id ?? '', { logo_url: url });
      if (!updatedAgency) throw new Error('Agency was not updated');
      toast.success(t('settings.logoUploaded'));
      refetch();
      window.dispatchEvent(new CustomEvent('agency-updated'));
    } catch {
      toast.error(t('settings.logoUploadFailed'));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      if (!form.id) {
        toast.error(t('settings.workspaceUnavailable'));
        return;
      }
      const updatedAgency = await updateAgency(form.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        website: form.website,
        city: form.city,
        country: form.country,
        address: form.address,
        description: form.description,
        logo_url: form.logo_url,
        currency: form.currency,
      });
      if (!updatedAgency) throw new Error('Agency was not updated');
      setForm(updatedAgency);
      toast.success(t('settings.saved'));
      refetch();
      window.dispatchEvent(new CustomEvent('agency-updated'));
    } catch {
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingCard />;
  if (error) return <ErrorCard onRetry={refetch} />;
  if (!form) return <ErrorCard onRetry={refetch} />;

  return (
    <Card>
      <h3 className="mb-5 font-serif text-lg font-medium text-text-primary">{t('settings.companyInfo')}</h3>
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-bg-elevated p-4">
        {form.logo_url ? (
          <img src={form.logo_url} alt="Logo" className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold text-2xl font-bold text-[#0D0D0F]">
            {(form.name ?? 'A').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">{form.name || t('settings.unnamedAgency')}</p>
          <p className="text-xs text-text-muted">{form.city ? `${form.city}${form.country ? ', ' + form.country : ''}` : t('settings.locationNotSet')}</p>
        </div>
        <div>
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="btn btn-outline btn-sm"
          >
            {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" strokeWidth={1.5} />}
            {t('settings.uploadLogo')}
          </button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.agencyName')}</label>
          <input
            className="input w-full"
            value={form.name ?? ''}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('common.phone')}</label>
          <input
            className="input w-full"
            value={form.phone ?? ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('common.email')}</label>
          <input
            className="input w-full"
            value={form.email ?? ''}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.website')}</label>
          <input
            className="input w-full"
            value={form.website ?? ''}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.address')}</label>
          <input
            className="input w-full"
            value={form.address ?? ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.city')}</label>
          <input
            className="input w-full"
            value={form.city ?? ''}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.country')}</label>
          <input
            className="input w-full"
            value={form.country ?? ''}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.currency')}</label>
          <select
            className="input w-full"
            value={form.currency ?? 'MAD'}
            onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}
          >
            {CURRENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.description')}</label>
          <textarea
            className="input w-full min-h-[80px] resize-y"
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
      </div>
      <button onClick={handleSave} disabled={saving || !form.id} className="btn btn-gold btn-md mt-5">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
      </button>
    </Card>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { t } = useLanguage();
  const { data: users, loading, refetch } = useSupabaseQuery<TeamMember[]>(fetchProfiles);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [saving, setSaving] = useState(false);

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error(t('settings.nameEmailRequired'));
      return;
    }
    setSaving(true);
    try {
      await createProfile({ name: inviteName, email: inviteEmail, role: inviteRole });
      toast.success(t('settings.inviteSuccess', { name: inviteName }));
      setInviteName('');
      setInviteEmail('');
      setInviteRole('agent');
      setInviteOpen(false);
      refetch();
    } catch {
      toast.error(t('settings.inviteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await updateProfileRole(id, role);
      toast.success(t('settings.roleUpdated'));
      refetch();
    } catch {
      toast.error(t('settings.roleUpdateFailed'));
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateProfile(id);
      toast.success(t('settings.userDeactivated'));
      refetch();
    } catch {
      toast.error(t('settings.deactivateFailed'));
    }
  };

  if (loading) return <LoadingCard />;

  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-serif text-lg font-medium text-text-primary">{t('settings.users')}</h3>
        <button
          onClick={() => setInviteOpen(!inviteOpen)}
          className="flex items-center gap-1.5 rounded-xl bg-gold-bg px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold-bg"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t('settings.invite')}
        </button>
      </div>

      {inviteOpen && (
        <div className="mb-4 rounded-xl border border-border bg-bg-elevated p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="input w-full" placeholder={t('settings.fullName')} value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            <input className="input w-full" placeholder={t('settings.emailAddress')} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <select className="input w-full" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="owner">{t('settings.owner')}</option>
              <option value="admin">{t('settings.admin')}</option>
              <option value="manager">{t('settings.manager')}</option>
              <option value="agent">{t('settings.agent')}</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleInvite} disabled={saving} className="btn btn-gold btn-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings.sendInvite')}
            </button>
            <button onClick={() => setInviteOpen(false)} className="btn btn-ghost btn-sm">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(users ?? []).map((user) => (
          <div key={user.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3.5">
            <Avatar name={user.name} size="md" color={user.avatarColor} />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{user.name}</p>
              <p className="text-xs text-text-muted">{user.email}</p>
            </div>
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(user.id, e.target.value)}
              className="input w-auto text-xs"
            >
              <option value="owner">{t('settings.owner')}</option>
              <option value="admin">{t('settings.admin')}</option>
              <option value="manager">{t('settings.manager')}</option>
              <option value="agent">{t('settings.agent')}</option>
            </select>
            <Badge variant={user.role === 'admin' || user.role === 'owner' ? 'gold' : 'neutral'}>{t(`settings.${user.role}`)}</Badge>
            <button
              onClick={() => handleDeactivate(user.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-error hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ))}
        {(users ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">{t('settings.noUsers')}</p>
        )}
      </div>
    </Card>
  );
}

// ─── Permissions ────────────────────────────────────────────────────────────

function PermissionsTab() {
  const { t } = useLanguage();
  const { data: perms, loading, refetch } = useSupabaseQuery<RolePermissionRow[]>(fetchRolePermissions);
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (perm: RolePermissionRow, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    setUpdating(perm.id);
    try {
      await updateRolePermission(perm.id, { [field]: !perm[field] } as any);
      refetch();
    } catch {
      toast.error(t('settings.permissionUpdateFailed'));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <LoadingCard />;

  const grouped: Record<string, RolePermissionRow[]> = {};
  for (const p of (perms ?? [])) {
    if (!grouped[p.role]) grouped[p.role] = [];
    grouped[p.role].push(p);
  }

  return (
    <div className="space-y-4">
      {roles.map((role, i) => {
        const rolePerms = grouped[role] ?? [];
        return (
          <Card key={role} delay={i * 0.05}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-bg text-gold">
                  <Shield className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium capitalize text-text-primary">{role}</p>
                  <p className="text-xs text-text-muted">{rolePerms.length} {t('settings.modules')}</p>
                </div>
              </div>
              <Badge variant="neutral">{rolePerms.length} {t('settings.modules')}</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="pb-2 pe-4 text-start font-medium">{t('settings.module')}</th>
                    <th className="pb-2 px-2 text-center font-medium">{t('settings.view')}</th>
                    <th className="pb-2 px-2 text-center font-medium">{t('settings.create')}</th>
                    <th className="pb-2 px-2 text-center font-medium">{t('settings.edit')}</th>
                    <th className="pb-2 px-2 text-center font-medium">{t('settings.delete')}</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => {
                    const perm = rolePerms.find((p) => p.module === mod);
                    if (!perm) return null;
                    return (
                      <tr key={mod} className="border-b border-border/50">
                        <td className="py-2.5 pe-4 capitalize text-text-primary">{mod}</td>
                        {(['can_view', 'can_create', 'can_edit', 'can_delete'] as const).map((field) => (
                          <td key={field} className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => handleToggle(perm, field)}
                              disabled={updating === perm.id}
                              className={cn(
                                'inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors',
                                perm[field]
                                  ? 'border-gold-border bg-gold-bg text-gold'
                                  : 'border-border bg-bg-secondary text-text-muted'
                              )}
                            >
                              {perm[field] && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Integrations ────────────────────────────────────────────────────────────

function IntegrationsTab() {
  const { t } = useLanguage();
  const { data: integrations, loading, refetch } = useSupabaseQuery<IntegrationRow[]>(fetchIntegrations);
  const router = useRouter();

  const workingServices = ['WhatsApp Business'];

  const handleConnect = (service: string) => {
    if (service === 'WhatsApp Business') router.push('/whatsapp');
  };

  if (loading) return <LoadingCard />;

  const filtered = (integrations ?? []).filter((i) => workingServices.includes(i.service));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {filtered.map((int, i) => {
        const meta = integrationMeta[int.service] ?? { icon: 'I', descriptionKey: 'settings.integration', color: '#888' };
        return (
          <Card key={int.service} hover delay={i * 0.04}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-elevated text-lg">{meta.icon}</div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{int.service}</p>
                  <p className="text-xs text-text-secondary">{t(meta.descriptionKey)}</p>
                </div>
              </div>
              {int.connected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success"><Check className="h-3 w-3" strokeWidth={1.5} /> {t('settings.connected')}</Badge>
                  <button
                    onClick={() => router.push('/whatsapp')}
                    className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-gold-border hover:text-gold"
                  >
                    {t('settings.manage')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(int.service)}
                  className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-gold-border hover:text-gold"
                >
                  {t('settings.connect')}
                </button>
              )}
            </div>
          </Card>
        );
      })}
      {filtered.length === 0 && (
        <Card className="sm:col-span-2">
          <p className="py-8 text-center text-sm text-text-muted">{t('settings.noIntegrations')}</p>
        </Card>
      )}
    </div>
  );
}

// ─── API Keys ────────────────────────────────────────────────────────────────

function ApiTab() {
  const { t } = useLanguage();
  const { data: keys, loading, refetch } = useSupabaseQuery<ApiKeyRow[]>(fetchApiKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error(t('settings.nameApiKey'));
      return;
    }
    setCreating(true);
    try {
      const result = await createApiKey(newKeyName);
      if (result) {
        setNewKey(result.rawKey);
        setNewKeyName('');
        toast.success(t('settings.apiKeyCreated'));
        refetch();
      }
    } catch {
      toast.error(t('settings.apiKeyCreateFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(id);
      toast.success(t('settings.apiKeyRevoked'));
      refetch();
    } catch {
      toast.error(t('settings.apiKeyRevokeFailed'));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('settings.copied'));
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-4">
      {newKey && (
        <Card className="border-gold-border bg-gold-bg">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 text-gold" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">{t('settings.apiKeyCreated')}</p>
              <p className="mt-1 text-xs text-text-muted">{t('settings.copyKeyWarning')}</p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-bg-elevated p-2.5">
                <code className="flex-1 truncate font-mono text-xs text-text-primary">{newKey}</code>
                <button onClick={() => handleCopy(newKey)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-muted hover:text-gold">
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <button onClick={() => setNewKey(null)} className="mt-2 text-xs font-medium text-gold hover:text-gold-soft">{t('settings.dismiss')}</button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="mb-5 font-serif text-lg font-medium text-text-primary">{t('settings.apiKeys')}</h3>
        <div className="space-y-2">
          {(keys ?? []).map((key) => (
            <div key={key.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3.5">
              <Code className="h-4 w-4 text-gold" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{key.name}</p>
                <p className="font-mono text-xs text-text-muted">{key.key_prefix}••••••••••••••••</p>
              </div>
              {key.revoked_at ? (
                <Badge variant="neutral">{t('settings.revoked')}</Badge>
              ) : (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-error hover:text-error"
                >
                  {t('settings.revoke')}
                </button>
              )}
            </div>
          ))}
          {(keys ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">{t('settings.noApiKeys')}</p>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            className="input flex-1"
            placeholder={t('settings.keyName')}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button onClick={handleCreate} disabled={creating} className="btn btn-gold btn-md">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" strokeWidth={1.5} /> {t('settings.createKey')}</>}
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-serif text-lg font-medium text-text-primary">{t('settings.webhooks')}</h3>
        <div className="rounded-xl border border-border bg-bg-elevated p-3.5">
          <p className="text-sm font-medium text-text-primary">{t('settings.n8nActionWebhook')}</p>
          <p className="mt-1 text-[11px] text-text-muted">{t('settings.n8nActionWebhookHint')}</p>
          <code className="mt-2 block truncate rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-xs text-gold">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/automations/webhook` : '/api/automations/webhook'}
          </code>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-bg-elevated p-3.5">
          <p className="text-sm font-medium text-text-primary">{t('settings.crmEventDispatch')}</p>
          <p className="mt-1 text-[11px] text-text-muted">{t('settings.crmEventDispatchHint')}</p>
          <code className="mt-2 block truncate rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-xs text-gold">
            {typeof window !== 'undefined' ? `${window.location.origin}/api/automations/events` : '/api/automations/events'}
          </code>
        </div>
      </Card>
    </div>
  );
}

// ─── Automations (n8n) ───────────────────────────────────────────────────────────

function AutomationsTab() {
  const { t } = useLanguage();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchN8nConfig()
      .then((cfg) => {
        setWebhookUrl(cfg.webhookUrl);
        setApiUrl(cfg.apiUrl);
        setWebhookSecret(cfg.webhookSecret);
        setConnected(cfg.connected);
      })
      .catch(() => toast.error(t('settings.n8nLoadFailed')))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveN8nConfig({ webhookUrl: webhookUrl, apiUrl: apiUrl, webhookSecret: webhookSecret, connected: connected || !!webhookUrl });
      toast.success(t('settings.n8nSaved'));
    } catch {
      toast.error(t('settings.n8nSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testN8nConnection();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    } catch {
      toast.error(t('settings.testFailed'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-bg text-gold">
            <Workflow className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-serif text-lg font-medium text-text-primary">{t('settings.n8nEngine')}</h3>
            <p className="text-xs text-text-muted">{t('settings.n8nEngineHint')}</p>
          </div>
          {connected && <Badge variant="success" className="ms-auto"><Check className="h-3 w-3" strokeWidth={1.5} /> Connected</Badge>}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.n8nWebhookUrl')}</label>
            <input
              className="input w-full"
              placeholder="https://your-n8n.com/webhook/mehans-crm"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-text-muted">{t('settings.n8nWebhookHint')}</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.n8nApiUrl')}</label>
            <input
              className="input w-full"
              placeholder="https://your-n8n.com/api/v1"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">{t('settings.webhookSecret')}</label>
            <input
              type="password"
              className="input w-full"
              placeholder="Shared secret for webhook validation"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-text-muted">{t('settings.webhookSecretHint')}</p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn btn-gold btn-md">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
            </button>
            <button onClick={handleTest} disabled={testing || !webhookUrl} className="btn btn-ghost btn-md">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('settings.testConnection')}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-gold" strokeWidth={1.5} />
          <h3 className="font-serif text-lg font-medium text-text-primary">{t('settings.availableWebhookEvents')}</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { event: 'whatsapp.new_message', labelKey: 'settings.eventNewWhatsapp' },
            { event: 'whatsapp.outgoing_message', labelKey: 'settings.eventOutgoingWhatsapp' },
            { event: 'whatsapp.new_conversation', labelKey: 'settings.eventNewConversation' },
            { event: 'whatsapp.connection_change', labelKey: 'settings.eventConnectionChange' },
            { event: 'lead.created', labelKey: 'settings.eventLeadCreated' },
            { event: 'lead.inactive', labelKey: 'settings.eventLeadInactive' },
            { event: 'deal.won', labelKey: 'settings.eventDealWon' },
            { event: 'deal.lost', labelKey: 'settings.eventDealLost' },
            { event: 'meeting.created', labelKey: 'settings.eventMeetingCreated' },
            { event: 'meeting.updated', labelKey: 'settings.eventMeetingUpdated' },
            { event: 'meeting.cancelled', labelKey: 'settings.eventMeetingCancelled' },
            { event: 'meeting.completed', labelKey: 'settings.eventMeetingCompleted' },
          ].map((evt) => (
            <div key={evt.event} className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2">
              <code className="text-[11px] font-mono text-gold">{evt.event}</code>
              <span className="ms-auto text-[11px] text-text-muted">{t(evt.labelKey)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-text-muted">
          {t('settings.availableWebhookEventsHint')}
        </p>
      </Card>
    </div>
  );
}

// ─── Loading ───────────────────────────────────────────────────────────────────

function LoadingCard() {
  const { t } = useLanguage();
  return (
    <Card>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold" aria-label={t('common.loading')} />
      </div>
    </Card>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <Card>
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-text-muted">{t('settings.workspaceLoadFailed')}</p>
        <button onClick={onRetry} className="btn btn-ghost btn-sm">{t('common.tryAgain')}</button>
      </div>
    </Card>
  );
}
