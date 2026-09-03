'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Shield, Plug, Palette, Code, CreditCard,
  Check, Plus, Sparkles, Trash2, Copy, Loader2, Zap, Workflow,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar } from '@/components/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import {
  fetchSettings, updateSettings,
  fetchProfiles, updateProfileRole, deactivateProfile, createProfile,
  fetchRolePermissions, updateRolePermission,
  fetchIntegrations, toggleIntegration,
  fetchApiKeys, createApiKey, revokeApiKey,
} from '@/lib/data';
import { fetchN8nConfig, saveN8nConfig, testN8nConnection } from '@/lib/automations';
import type { OrgSettings, RolePermissionRow, IntegrationRow, ApiKeyRow } from '@/lib/data';
import type { TeamMember } from '@/lib/types';

const tabs = [
  { id: 'organization', label: 'Organization', icon: Building2 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'automations', label: 'Automations', icon: Workflow },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'api', label: 'API', icon: Code },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

const integrationMeta: Record<string, { icon: string; description: string; color: string }> = {
  'Slack': { icon: '💬', description: 'Get notifications in Slack', color: '#4A154B' },
  'Gmail': { icon: '✉', description: 'Sync emails with CRM', color: '#EA4335' },
  'WhatsApp Business': { icon: '📱', description: 'Send messages to leads', color: '#25D366' },
  'Google Calendar': { icon: '📅', description: 'Sync meetings and events', color: '#4285F4' },
  'OpenAI': { icon: '✦', description: 'AI assistant and lead scoring', color: '#D4AF37' },
  'Zapier': { icon: '⚡', description: 'Connect 5,000+ apps', color: '#FF4A00' },
};

const modules = ['leads', 'properties', 'deals', 'tasks', 'meetings', 'contacts'];
const roles = ['admin', 'manager', 'agent', 'viewer'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('organization');

  return (
    <AppShell>
      <PageHeader title="Settings" description="Manage your workspace and preferences" />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabs.map((tab) => {
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
                {tab.label}
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
              {activeTab === 'branding' && <BrandingTab />}
              {activeTab === 'api' && <ApiTab />}
              {activeTab === 'billing' && <BillingTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Organization ──────────────────────────────────────────────────────────

function OrganizationTab() {
  const { data: settings, loading, refetch } = useSupabaseQuery<OrgSettings | null>(fetchSettings);
  const [form, setForm] = useState<OrgSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateSettings({
        org_name: form.org_name,
        website: form.website,
        industry: form.industry,
        timezone: form.timezone,
      });
      toast.success('Organization settings saved');
      refetch();
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <LoadingCard />;

  return (
    <Card>
      <h3 className="mb-5 font-serif text-lg font-medium text-text-primary">Organization Details</h3>
      <div className="mb-5 flex items-center gap-4 rounded-xl border border-border bg-bg-elevated p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold text-2xl font-bold text-[#0D0D0F]">
          {form.org_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{form.org_name}</p>
          <p className="text-xs text-text-muted">{form.industry}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Organization Name</label>
          <input
            className="input w-full"
            value={form.org_name}
            onChange={(e) => setForm({ ...form, org_name: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Website</label>
          <input
            className="input w-full"
            value={form.website ?? ''}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Industry</label>
          <input
            className="input w-full"
            value={form.industry ?? ''}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-muted">Timezone</label>
          <input
            className="input w-full"
            value={form.timezone ?? ''}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </div>
      </div>
      <button onClick={handleSave} disabled={saving} className="btn btn-gold btn-md mt-5">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
      </button>
    </Card>
  );
}

// ─── Users ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users, loading, refetch } = useSupabaseQuery<TeamMember[]>(fetchProfiles);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [saving, setSaving] = useState(false);

  const handleInvite = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      await createProfile({ name: inviteName, email: inviteEmail, role: inviteRole });
      toast.success(`${inviteName} invited successfully`);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('agent');
      setInviteOpen(false);
      refetch();
    } catch {
      toast.error('Failed to invite user');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await updateProfileRole(id, role);
      toast.success('Role updated');
      refetch();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await deactivateProfile(id);
      toast.success('User deactivated');
      refetch();
    } catch {
      toast.error('Failed to deactivate user');
    }
  };

  if (loading) return <LoadingCard />;

  return (
    <Card>
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-serif text-lg font-medium text-text-primary">Users</h3>
        <button
          onClick={() => setInviteOpen(!inviteOpen)}
          className="flex items-center gap-1.5 rounded-xl bg-gold-bg px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold-bg"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} /> Invite
        </button>
      </div>

      {inviteOpen && (
        <div className="mb-4 rounded-xl border border-border bg-bg-elevated p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="input w-full" placeholder="Full name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            <input className="input w-full" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <select className="input w-full" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleInvite} disabled={saving} className="btn btn-gold btn-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
            </button>
            <button onClick={() => setInviteOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
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
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
              <option value="viewer">Viewer</option>
            </select>
            <Badge variant={user.role === 'admin' ? 'gold' : 'neutral'}>{user.role}</Badge>
            <button
              onClick={() => handleDeactivate(user.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-colors hover:border-error hover:text-error"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ))}
        {(users ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">No users found. Invite team members to get started.</p>
        )}
      </div>
    </Card>
  );
}

// ─── Permissions ────────────────────────────────────────────────────────────

function PermissionsTab() {
  const { data: perms, loading, refetch } = useSupabaseQuery<RolePermissionRow[]>(fetchRolePermissions);
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (perm: RolePermissionRow, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete') => {
    setUpdating(perm.id);
    try {
      await updateRolePermission(perm.id, { [field]: !perm[field] } as any);
      refetch();
    } catch {
      toast.error('Failed to update permission');
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
                  <p className="text-xs text-text-muted">{rolePerms.length} modules</p>
                </div>
              </div>
              <Badge variant="neutral">{rolePerms.length} modules</Badge>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted">
                    <th className="pb-2 pr-4 text-left font-medium">Module</th>
                    <th className="pb-2 px-2 text-center font-medium">View</th>
                    <th className="pb-2 px-2 text-center font-medium">Create</th>
                    <th className="pb-2 px-2 text-center font-medium">Edit</th>
                    <th className="pb-2 px-2 text-center font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((mod) => {
                    const perm = rolePerms.find((p) => p.module === mod);
                    if (!perm) return null;
                    return (
                      <tr key={mod} className="border-b border-border/50">
                        <td className="py-2.5 pr-4 capitalize text-text-primary">{mod}</td>
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
  const { data: integrations, loading, refetch } = useSupabaseQuery<IntegrationRow[]>(fetchIntegrations);

  const handleToggle = async (service: string, currentlyConnected: boolean) => {
    try {
      await toggleIntegration(service, !currentlyConnected);
      toast.success(currentlyConnected ? `${service} disconnected` : `${service} connected`);
      refetch();
    } catch {
      toast.error('Failed to update integration');
    }
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(integrations ?? []).map((int, i) => {
        const meta = integrationMeta[int.service] ?? { icon: '🔌', description: 'Integration', color: '#888' };
        return (
          <Card key={int.service} hover delay={i * 0.04}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-elevated text-lg">{meta.icon}</div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{int.service}</p>
                  <p className="text-xs text-text-secondary">{meta.description}</p>
                </div>
              </div>
              {int.connected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success"><Check className="h-3 w-3" strokeWidth={1.5} /> Connected</Badge>
                  <button
                    onClick={() => handleToggle(int.service, true)}
                    className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-error hover:text-error"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleToggle(int.service, false)}
                  className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-gold-border hover:text-gold"
                >
                  Connect
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Branding ────────────────────────────────────────────────────────────────

function BrandingTab() {
  const { data: settings, loading, refetch } = useSupabaseQuery<OrgSettings | null>(fetchSettings);
  const [color, setColor] = useState('#D4AF37');
  const [theme, setTheme] = useState('dark');
  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setColor(settings.primary_color ?? '#D4AF37');
      setTheme(settings.theme ?? 'dark');
      setOrgName(settings.org_name ?? '');
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ primary_color: color, theme, org_name: orgName });
      toast.success('Branding saved');
      refetch();
    } catch {
      toast.error('Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <LoadingCard />;

  return (
    <Card>
      <h3 className="mb-5 font-serif text-lg font-medium text-text-primary">Branding</h3>
      <div className="space-y-5">
        <div>
          <label className="mb-2.5 block text-xs font-medium text-text-muted">Organization Name</label>
          <input className="input w-full" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
        </div>
        <div>
          <label className="mb-2.5 block text-xs font-medium text-text-muted">Primary Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 cursor-pointer rounded-xl border border-border bg-transparent" />
            <span className="text-sm font-mono text-text-primary">{color}</span>
          </div>
        </div>
        <div>
          <label className="mb-2.5 block text-xs font-medium text-text-muted">Theme</label>
          <div className="flex gap-3">
            {['dark', 'light'].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  'flex h-16 w-24 cursor-pointer items-center justify-center rounded-xl border-2 transition-all',
                  t === 'dark' ? 'bg-bg-primary' : 'bg-white',
                  theme === t ? 'border-gold' : 'border-border'
                )}
              >
                <span className={cn('text-xs font-medium capitalize', t === 'dark' ? 'text-gold' : 'text-gray-900')}>
                  {t}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2.5 block text-xs font-medium text-text-muted">Logo</label>
          <div className="flex items-center gap-4 rounded-xl border border-border bg-bg-elevated p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold text-lg font-bold text-[#0D0D0F]">
              {(orgName || 'M').charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-text-muted">Logo upload requires storage integration</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-gold btn-md">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Branding'}
        </button>
      </div>
    </Card>
  );
}

// ─── API Keys ────────────────────────────────────────────────────────────────

function ApiTab() {
  const { data: keys, loading, refetch } = useSupabaseQuery<ApiKeyRow[]>(fetchApiKeys);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please name your API key');
      return;
    }
    setCreating(true);
    try {
      const result = await createApiKey(newKeyName);
      if (result) {
        setNewKey(result.rawKey);
        setNewKeyName('');
        toast.success('API key created');
        refetch();
      }
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeApiKey(id);
      toast.success('API key revoked');
      refetch();
    } catch {
      toast.error('Failed to revoke key');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  if (loading) return <LoadingCard />;

  return (
    <div className="space-y-4">
      {newKey && (
        <Card className="border-gold-border bg-gold-bg">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 h-5 w-5 text-gold" strokeWidth={1.5} />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">API key created successfully</p>
              <p className="mt-1 text-xs text-text-muted">Copy this key now. You will not be able to see it again.</p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-bg-elevated p-2.5">
                <code className="flex-1 truncate font-mono text-xs text-text-primary">{newKey}</code>
                <button onClick={() => handleCopy(newKey)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-muted hover:text-gold">
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <button onClick={() => setNewKey(null)} className="mt-2 text-xs font-medium text-gold hover:text-gold-soft">Dismiss</button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="mb-5 font-serif text-lg font-medium text-text-primary">API Keys</h3>
        <div className="space-y-2">
          {(keys ?? []).map((key) => (
            <div key={key.id} className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-3.5">
              <Code className="h-4 w-4 text-gold" strokeWidth={1.5} />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{key.name}</p>
                <p className="font-mono text-xs text-text-muted">{key.key_prefix}••••••••••••••••</p>
              </div>
              {key.revoked_at ? (
                <Badge variant="neutral">Revoked</Badge>
              ) : (
                <button
                  onClick={() => handleRevoke(key.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-error hover:text-error"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
          {(keys ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">No API keys yet. Create one below.</p>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Key name (e.g. Production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <button onClick={handleCreate} disabled={creating} className="btn btn-gold btn-md">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" strokeWidth={1.5} /> Generate</>}
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 font-serif text-lg font-medium text-text-primary">Webhooks</h3>
        <div className="rounded-xl border border-border bg-bg-elevated p-3.5">
          <p className="text-sm font-medium text-text-primary">Endpoint URL</p>
          <input className="input mt-2 w-full" placeholder="https://your-app.com/webhook/mehans" />
        </div>
        <button onClick={() => toast.success('Webhook saved')} className="btn btn-gold btn-md mt-4">Save Webhook</button>
      </Card>
    </div>
  );
}

// ─── Billing ──────────────────────────────────────────────────────────────────

function BillingTab() {
  const { data: integrations, loading } = useSupabaseQuery<IntegrationRow[]>(fetchIntegrations);
  const billingConnected = (integrations ?? []).some((i) => i.service === 'Stripe' && i.connected);

  if (loading) return <LoadingCard />;

  if (!billingConnected) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CreditCard className="h-12 w-12 text-text-muted" strokeWidth={1} />
          <p className="mt-4 text-sm font-medium text-text-primary">Billing integration not configured</p>
          <p className="mt-1 text-xs text-text-muted">Connect a billing integration to manage your subscription and invoices.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Sparkles className="h-12 w-12 text-gold" strokeWidth={1} />
        <p className="mt-4 text-sm font-medium text-text-primary">Billing is active</p>
      </div>
    </Card>
  );
}

// ─── Automations (n8n) ───────────────────────────────────────────────────────────

function AutomationsTab() {
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
      .catch(() => toast.error('Failed to load n8n config'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveN8nConfig({ webhookUrl: webhookUrl, apiUrl: apiUrl, webhookSecret: webhookSecret, connected: connected || !!webhookUrl });
      toast.success('n8n settings saved');
    } catch {
      toast.error('Failed to save n8n settings');
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
      toast.error('Test failed');
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
            <h3 className="font-serif text-lg font-medium text-text-primary">n8n Automation Engine</h3>
            <p className="text-xs text-text-muted">Connect your n8n instance to trigger CRM automations</p>
          </div>
          {connected && <Badge variant="success" className="ml-auto"><Check className="h-3 w-3" strokeWidth={1.5} /> Connected</Badge>}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">n8n Webhook URL</label>
            <input
              className="input w-full"
              placeholder="https://your-n8n.com/webhook/mehans-crm"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-text-muted">CRM events are sent to this URL. Keep it secret.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">n8n API URL (optional)</label>
            <input
              className="input w-full"
              placeholder="https://your-n8n.com/api/v1"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Webhook Secret</label>
            <input
              type="password"
              className="input w-full"
              placeholder="Shared secret for webhook validation"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-text-muted">Sent as x-webhook-secret header. n8n must validate this.</p>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="btn btn-gold btn-md">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Settings'}
            </button>
            <button onClick={handleTest} disabled={testing || !webhookUrl} className="btn btn-ghost btn-md">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test Connection'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-gold" strokeWidth={1.5} />
          <h3 className="font-serif text-lg font-medium text-text-primary">Available Webhook Events</h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { event: 'whatsapp.new_message', label: 'New WhatsApp Message' },
            { event: 'whatsapp.outgoing_message', label: 'Outgoing WhatsApp Message' },
            { event: 'whatsapp.new_conversation', label: 'New WhatsApp Conversation' },
            { event: 'whatsapp.connection_change', label: 'WhatsApp Connection Changed' },
            { event: 'lead.created', label: 'Lead Created' },
            { event: 'lead.inactive', label: 'Lead Inactive (48h)' },
            { event: 'deal.won', label: 'Deal Won' },
            { event: 'deal.lost', label: 'Deal Lost' },
            { event: 'meeting.created', label: 'Appointment Created' },
            { event: 'meeting.updated', label: 'Appointment Updated' },
            { event: 'meeting.cancelled', label: 'Appointment Cancelled' },
            { event: 'meeting.completed', label: 'Appointment Completed' },
          ].map((evt) => (
            <div key={evt.event} className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2">
              <code className="text-[11px] font-mono text-gold">{evt.event}</code>
              <span className="ml-auto text-[11px] text-text-muted">{evt.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-text-muted">
          These events are sent to your n8n webhook URL. Use them as trigger nodes in your n8n workflows.
        </p>
      </Card>
    </div>
  );
}

// ─── Loading ───────────────────────────────────────────────────────────────────

function LoadingCard() {
  return (
    <Card>
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    </Card>
  );
}
