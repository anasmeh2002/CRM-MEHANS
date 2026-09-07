'use client';


import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Bed, Bath, Maximize, MapPin, Star, X, Home, Search,
  Phone, Mail, MessageCircle, Building, Trash2, Pencil,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader, Card, Badge, Avatar, EmptyState, SkeletonCard } from '@/components/shared';
import { Field, TextInput, TextArea, Select, LoadingButton, Modal, SearchInput, UploadField } from '@/components/forms';
import { fetchProperties, createProperty, updateProperty, deleteProperty, fetchTeamMembers, uploadPropertyImage } from '@/lib/data';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import type { Property, PropertyStatus, PropertyType, TeamMember } from '@/lib/types';
import { cn, safeConfig } from '@/lib/utils';
import { toast } from 'sonner';
import { useLanguage } from '@/components/language-provider';

const statusConfig: Record<PropertyStatus, { label: string; variant: 'success' | 'gold' | 'error' | 'info' | 'neutral' }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  available: { label: 'Available', variant: 'success' },
  reserved: { label: 'Reserved', variant: 'gold' },
  sold: { label: 'Sold', variant: 'error' },
  rented: { label: 'Rented', variant: 'info' },
  'off-market': { label: 'Off Market', variant: 'neutral' },
  archived: { label: 'Archived', variant: 'neutral' },
};

const statusFilters = ['all', 'available', 'reserved', 'sold', 'rented'] as const;

const PLACEHOLDER_IMAGE = 'https://images.pexels.com/photos/30211361/pexels-photo-30211361.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
function imageUrl(storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/property-images/${storagePath}`;
}

/** Map a raw DB property (with joined agent + property_images) into the display shape the UI expects. */
function mapProperty(p: any): Property {
  const images: any[] = Array.isArray(p.property_images) ? p.property_images : [];
  const image = images[0]?.storage_path
    ? imageUrl(images[0].storage_path)
    : (p.image_url || PLACEHOLDER_IMAGE);
  const gallery = images.length > 0
    ? images.map((img) => img.storage_path ? imageUrl(img.storage_path) : PLACEHOLDER_IMAGE)
    : [image];
  const agentName = p.agent?.name ?? p.agent?.full_name ?? 'Unassigned';
  return {
    ...p,
    type: p.property_type ?? p.type ?? 'apartment',
    area: p.surface ?? p.area ?? 0,
    image,
    gallery,
    agent: agentName,
  } as Property;
}

export default function PropertiesPage() {
  const { t } = useLanguage();
  const { data: rawProperties, loading, error, refetch } = useSupabaseQuery(fetchProperties);

  // Local copy of the mapped properties. Seeded from the query result and
  // updated optimistically by the create/edit/delete handlers so the UI
  // reflects changes without waiting for a full refetch.
  const [properties, setProperties] = useState<Property[]>([]);
  useEffect(() => {
    if (rawProperties) setProperties(rawProperties.map(mapProperty));
  }, [rawProperties]);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  useEffect(() => {
    let active = true;
    fetchTeamMembers()
      .then((members) => { if (active) setTeamMembers(members); })
      .catch(() => { if (active) setTeamMembers([]); });
    return () => { active = false; };
  }, []);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PropertyStatus | 'all'>('all');
  const [selected, setSelected] = useState<Property | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editProp, setEditProp] = useState<Property | null>(null);
  const [saving, setSaving] = useState(false);
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [createPreviews, setCreatePreviews] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [form, setForm] = useState({
    title: '', address: '', city: '', price: '', type: 'apartment' as PropertyType,
    status: 'available' as PropertyStatus, bedrooms: '3', bathrooms: '2', area: '2000',
    agent: '', description: '', featured: false,
  });

  // Keep the create form's default agent in sync once team members load.
  useEffect(() => {
    if (teamMembers.length > 0 && !form.agent) {
      setForm((f) => ({ ...f, agent: teamMembers[0].name }));
    }
  }, [teamMembers, form.agent]);

  const filtered = useMemo(() =>
    properties.filter((p) => {
      const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.city.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    }), [properties, search, statusFilter]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const agentId = teamMembers.find((m) => m.name === form.agent)?.id ?? null;
      const input = {
        title: form.title,
        address: form.address,
        city: form.city,
        country: undefined,
        property_type: form.type,
        price: parseInt(form.price) || 500000,
        bedrooms: parseInt(form.bedrooms) || 0,
        bathrooms: parseInt(form.bathrooms) || 0,
        surface: parseInt(form.area) || 0,
        description: form.description || 'No description provided.',
        amenities: [],
        status: form.status,
        featured: form.featured,
        agent_id: agentId ?? undefined,
        published_at: new Date().toISOString(),
      };
      const created = await createProperty(input);
      if (!created) {
        toast.error('Failed to create property. Please try again.');
        return;
      }
      for (let i = 0; i < createFiles.length; i++) {
        await uploadPropertyImage(created.id, createFiles[i], i);
      }
      const withImages = await fetchProperties();
      const updated = withImages.find((p) => p.id === created.id) ?? created;
      setProperties((prev) => [mapProperty(updated), ...prev]);
      setShowCreate(false);
      setCreateFiles([]);
      setCreatePreviews([]);
      setForm({ title: '', address: '', city: '', price: '', type: 'apartment', status: 'available', bedrooms: '3', bathrooms: '2', area: '2000', agent: teamMembers[0]?.name ?? '', description: '', featured: false });
      toast.success(`Property "${form.title}" created successfully`);
    } catch (err) {
      toast.error('Failed to create property. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editProp) return;
    setSaving(true);
    try {
      const agentId = teamMembers.find((m) => m.name === editProp.agent)?.id ?? null;
      const patch = {
        title: editProp.title,
        address: editProp.address,
        city: editProp.city,
        property_type: editProp.type,
        price: editProp.price,
        bedrooms: editProp.bedrooms,
        bathrooms: editProp.bathrooms,
        surface: editProp.area,
        description: editProp.description,
        status: editProp.status,
        featured: editProp.featured,
        agent_id: agentId ?? undefined,
      };
      const updated = await updateProperty(editProp.id, patch);
      if (!updated) {
        toast.error('Failed to update property. Please try again.');
        return;
      }
      setProperties((prev) => prev.map((p) => (p.id === editProp.id ? { ...p, ...mapProperty(updated) } : p)));
      setEditProp(null);
      toast.success(`Property "${editProp.title}" updated successfully`);
    } catch (err) {
      toast.error('Failed to update property. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteProperty(id);
    if (!ok) {
      toast.error('Failed to delete property. Please try again.');
      return;
    }
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
    toast.success('Property deleted');
  };

  return (
    <AppShell>
      <PageHeader title={t('properties.title')} description={t('properties.description')}>
        <button onClick={() => setShowCreate(true)} className="btn btn-gold btn-md">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> {t('properties.newProperty')}
        </button>
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search properties by name or location..." className="flex-1 max-w-md" />
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-200 whitespace-nowrap',
                statusFilter === status ? 'border-gold-border bg-gold-bg text-gold' : 'border-border bg-bg-secondary text-text-secondary hover:text-text-primary'
              )}
            >
              {status === 'all' ? 'All' : safeConfig(statusConfig, status, { label: status, variant: 'neutral' as const }).label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-error-border bg-error-bg">
              <X className="h-6 w-6 text-error" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-serif text-lg font-medium text-text-primary">Unable to load properties</p>
              <p className="mt-1 text-[13px] text-text-secondary">{error}</p>
            </div>
            <button onClick={() => refetch()} className="btn btn-outline btn-md">Try again</button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={Home} title="No properties found" description="Try adjusting your filters or add a new property." action={<button onClick={() => setShowCreate(true)} className="btn btn-gold btn-md"><Plus className="h-4 w-4" strokeWidth={1.5} /> New Property</button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((property, i) => (
            <motion.div
              key={property.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => { setSelected(property); setGalleryIndex(0); }}
              className="group cursor-pointer"
            >
              <div className="overflow-hidden rounded-2xl border border-border bg-bg-secondary transition-all duration-300 hover:border-border-strong hover:shadow-elevated">
                <div className="relative h-52 overflow-hidden">
                  <img src={property.image} alt={property.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-secondary via-transparent to-transparent" />
                  <div className="absolute left-3 top-3">
                    <Badge variant={safeConfig(statusConfig, property.status, { label: 'Unknown', variant: 'neutral' as const }).variant}>{safeConfig(statusConfig, property.status, { label: 'Unknown', variant: 'neutral' as const }).label}</Badge>
                  </div>
                  {property.featured && (
                    <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-gold-border bg-bg-secondary/80 backdrop-blur-sm">
                      <Star className="h-3.5 w-3.5 fill-gold text-gold" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[11px] text-white/70">{property.city}</p>
                    <p className="font-serif text-lg font-medium text-white">{property.title}</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="font-serif text-xl font-medium text-gold">${(property.price / 1000000).toFixed(2)}M</p>
                    <Badge variant="neutral" className="capitalize">{property.type}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-[12px] text-text-secondary">
                    {property.bedrooms > 0 && <span className="flex items-center gap-1.5"><Bed className="h-3.5 w-3.5" strokeWidth={1.5} /> {property.bedrooms} bd</span>}
                    {property.bathrooms > 0 && <span className="flex items-center gap-1.5"><Bath className="h-3.5 w-3.5" strokeWidth={1.5} /> {property.bathrooms} ba</span>}
                    <span className="flex items-center gap-1.5"><Maximize className="h-3.5 w-3.5" strokeWidth={1.5} /> {property.area.toLocaleString()} ft²</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <Avatar name={property.agent} size="sm" color="#D4AF37" />
                    <span className="text-[12px] text-text-muted">{property.agent}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add New Property"
        description="Create a new property listing"
        size="lg"
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="btn btn-ghost btn-md">Cancel</button>
            <LoadingButton onClick={handleCreate} loading={saving} disabled={!form.title || !form.address}>Create Property</LoadingButton>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Property Title" required>
              <TextInput value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Skyline Penthouse" />
            </Field>
          </div>
          <Field label="Address" required>
            <TextInput value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="1200 Brickell Ave" />
          </Field>
          <Field label="City">
            <TextInput value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="Miami, FL" />
          </Field>
          <Field label="Price ($)">
            <TextInput type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="4200000" />
          </Field>
          <Field label="Property Type">
            <Select value={form.type} onChange={(v) => setForm({ ...form, type: v as PropertyType })} options={[
              { value: 'apartment', label: 'Apartment' }, { value: 'villa', label: 'Villa' },
              { value: 'penthouse', label: 'Penthouse' }, { value: 'townhouse', label: 'Townhouse' },
              { value: 'land', label: 'Land' }, { value: 'commercial', label: 'Commercial' },
            ]} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(v) => setForm({ ...form, status: v as PropertyStatus })} options={[
              { value: 'available', label: 'Available' }, { value: 'reserved', label: 'Reserved' },
              { value: 'sold', label: 'Sold' }, { value: 'rented', label: 'Rented' }, { value: 'off-market', label: 'Off Market' },
            ]} />
          </Field>
          <Field label="Listing Agent">
            <Select value={form.agent} onChange={(v) => setForm({ ...form, agent: v })} options={teamMembers.map((m) => ({ value: m.name, label: `${m.name} — ${m.role}` }))} />
          </Field>
          <Field label="Bedrooms">
            <TextInput type="number" value={form.bedrooms} onChange={(v) => setForm({ ...form, bedrooms: v })} />
          </Field>
          <Field label="Bathrooms">
            <TextInput type="number" value={form.bathrooms} onChange={(v) => setForm({ ...form, bathrooms: v })} />
          </Field>
          <Field label="Area (sq ft)">
            <TextInput type="number" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <TextArea value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Describe the property..." rows={3} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Property Photos">
              <UploadField label="Upload property photos" accept="image/*" onChange={(file) => { setCreateFiles((p) => [...p, file]); setCreatePreviews((p) => [...p, URL.createObjectURL(file)]); }} />
              {createPreviews.length > 0 && (
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {createPreviews.map((src, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                      <img src={src} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                      {i === 0 && <span className="absolute left-1 top-1 rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold text-[#0D0D0F]">COVER</span>}
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editProp}
        onClose={() => setEditProp(null)}
        title="Edit Property"
        description={editProp?.title}
        size="lg"
        footer={
          <>
            <button onClick={() => setEditProp(null)} className="btn btn-ghost btn-md">Cancel</button>
            <LoadingButton onClick={handleSaveEdit} loading={saving}>Save Changes</LoadingButton>
          </>
        }
      >
        {editProp && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Property Title" required><TextInput value={editProp.title} onChange={(v) => setEditProp({ ...editProp, title: v })} /></Field>
            </div>
            <Field label="Address"><TextInput value={editProp.address} onChange={(v) => setEditProp({ ...editProp, address: v })} /></Field>
            <Field label="City"><TextInput value={editProp.city} onChange={(v) => setEditProp({ ...editProp, city: v })} /></Field>
            <Field label="Price ($)"><TextInput type="number" value={String(editProp.price)} onChange={(v) => setEditProp({ ...editProp, price: parseInt(v) || 0 })} /></Field>
            <Field label="Type"><Select value={editProp.type} onChange={(v) => setEditProp({ ...editProp, type: v as PropertyType })} options={[
              { value: 'apartment', label: 'Apartment' }, { value: 'villa', label: 'Villa' },
              { value: 'penthouse', label: 'Penthouse' }, { value: 'townhouse', label: 'Townhouse' },
              { value: 'land', label: 'Land' }, { value: 'commercial', label: 'Commercial' },
            ]} /></Field>
            <Field label="Status"><Select value={editProp.status} onChange={(v) => setEditProp({ ...editProp, status: v as PropertyStatus })} options={[
              { value: 'available', label: 'Available' }, { value: 'reserved', label: 'Reserved' },
              { value: 'sold', label: 'Sold' }, { value: 'rented', label: 'Rented' }, { value: 'off-market', label: 'Off Market' },
            ]} /></Field>
            <Field label="Agent"><Select value={editProp.agent} onChange={(v) => setEditProp({ ...editProp, agent: v })} options={teamMembers.map((m) => ({ value: m.name, label: `${m.name} — ${m.role}` }))} /></Field>
            <Field label="Bedrooms"><TextInput type="number" value={String(editProp.bedrooms)} onChange={(v) => setEditProp({ ...editProp, bedrooms: parseInt(v) || 0 })} /></Field>
            <Field label="Bathrooms"><TextInput type="number" value={String(editProp.bathrooms)} onChange={(v) => setEditProp({ ...editProp, bathrooms: parseInt(v) || 0 })} /></Field>
            <Field label="Area (sq ft)"><TextInput type="number" value={String(editProp.area)} onChange={(v) => setEditProp({ ...editProp, area: parseInt(v) || 0 })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Description"><TextArea value={editProp.description} onChange={(v) => setEditProp({ ...editProp, description: v })} rows={3} /></Field>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-lg flex-col border-l border-border bg-bg-secondary shadow-modal"
            >
              <div className="relative h-72 overflow-hidden">
                <div id="property-carousel" className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-thin" style={{ scrollSnapType: 'x mandatory' }}>
                  {selected.gallery.map((src, i) => (
                    <div key={i} className="relative h-full w-full shrink-0 snap-center" style={{ scrollSnapAlign: 'center' }}>
                      <img src={src} alt={`${selected.title} ${i + 1}`} className="h-full w-full object-cover" onClick={() => { setGalleryIndex(i); setLightboxOpen(true); }} />
                    </div>
                  ))}
                </div>
                {selected.gallery.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        const container = document.getElementById('property-carousel');
                        if (container) {
                          const newIndex = galleryIndex > 0 ? galleryIndex - 1 : selected.gallery.length - 1;
                          container.scrollTo({ left: newIndex * container.clientWidth, behavior: 'smooth' });
                          setGalleryIndex(newIndex);
                        }
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                    >
                      <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => {
                        const container = document.getElementById('property-carousel');
                        if (container) {
                          const newIndex = galleryIndex < selected.gallery.length - 1 ? galleryIndex + 1 : 0;
                          container.scrollTo({ left: newIndex * container.clientWidth, behavior: 'smooth' });
                          setGalleryIndex(newIndex);
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                    >
                      <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
                    </button>
                  </>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-secondary to-transparent pointer-events-none" />
                <button onClick={() => setSelected(null)} className="absolute right-3 top-3 rounded-lg bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
                <div className="absolute bottom-4 left-4 right-4">
                  <Badge variant={safeConfig(statusConfig, selected.status, { label: 'Unknown', variant: 'neutral' as const }).variant}>{safeConfig(statusConfig, selected.status, { label: 'Unknown', variant: 'neutral' as const }).label}</Badge>
                  <h2 className="mt-2 font-serif text-2xl font-medium text-white">{selected.title}</h2>
                  <p className="text-[13px] text-white/70">{selected.address}, {selected.city}</p>
                </div>
                {selected.gallery.length > 1 && (
                  <div className="absolute bottom-3 right-4 flex gap-1.5">
                    {selected.gallery.map((_, i) => (
                      <button key={i} onClick={(e) => { e.stopPropagation(); setGalleryIndex(i); const container = document.getElementById('property-carousel'); if (container) container.scrollTo({ left: i * container.clientWidth, behavior: 'smooth' }); }} className={cn('h-1.5 rounded-full transition-all', i === galleryIndex ? 'w-6 bg-gold' : 'w-1.5 bg-white/40')} />
                    ))}
                  </div>
                )}
              </div>
              <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
                <p className="font-serif text-3xl font-medium text-gold">${(selected.price / 1000000).toFixed(2)}M</p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {selected.bedrooms > 0 && (
                    <div className="rounded-xl border border-border bg-bg-elevated p-4 text-center">
                      <Bed className="mx-auto h-5 w-5 text-gold" strokeWidth={1.5} />
                      <p className="mt-1.5 font-serif text-xl font-medium text-text-primary">{selected.bedrooms}</p>
                      <p className="text-[11px] text-text-muted">Bedrooms</p>
                    </div>
                  )}
                  {selected.bathrooms > 0 && (
                    <div className="rounded-xl border border-border bg-bg-elevated p-4 text-center">
                      <Bath className="mx-auto h-5 w-5 text-gold" strokeWidth={1.5} />
                      <p className="mt-1.5 font-serif text-xl font-medium text-text-primary">{selected.bathrooms}</p>
                      <p className="text-[11px] text-text-muted">Bathrooms</p>
                    </div>
                  )}
                  <div className="rounded-xl border border-border bg-bg-elevated p-4 text-center">
                    <Maximize className="mx-auto h-5 w-5 text-gold" strokeWidth={1.5} />
                    <p className="mt-1.5 font-serif text-xl font-medium text-text-primary">{selected.area.toLocaleString()}</p>
                    <p className="text-[11px] text-text-muted">Sq Ft</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-border bg-bg-elevated p-4">
                  <p className="mb-1.5 text-[11px] font-medium text-text-muted">Description</p>
                  <p className="text-[13px] leading-relaxed text-text-primary">{selected.description}</p>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-bg-elevated p-4">
                  <Avatar name={selected.agent} size="lg" color="#D4AF37" />
                  <div>
                    <p className="text-[13px] font-medium text-text-primary">{selected.agent}</p>
                    <p className="text-[12px] text-text-muted">Listing Agent</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-2 text-[13px] text-text-secondary">
                  <MapPin className="h-4 w-4 text-gold" strokeWidth={1.5} /> {selected.address}, {selected.city}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-border p-4">
                <button onClick={() => { setEditProp(selected); setSelected(null); }} className="btn btn-outline btn-sm flex-1"><Pencil className="h-4 w-4" strokeWidth={1.5} /> Edit</button>
                <button onClick={() => handleDelete(selected.id)} className="btn btn-danger btn-sm"><Trash2 className="h-4 w-4" strokeWidth={1.5} /> Delete</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxOpen(false)}
              className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm"
            />
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute right-4 top-4 rounded-lg bg-white/10 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              >
                <X className="h-6 w-6" strokeWidth={1.5} />
              </button>
              {selected.gallery.length > 1 && (
                <>
                  <button
                    onClick={() => {
                      const newIndex = galleryIndex > 0 ? galleryIndex - 1 : selected.gallery.length - 1;
                      setGalleryIndex(newIndex);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-xl bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => {
                      const newIndex = galleryIndex < selected.gallery.length - 1 ? galleryIndex + 1 : 0;
                      setGalleryIndex(newIndex);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    <ChevronRight className="h-6 w-6" strokeWidth={1.5} />
                  </button>
                </>
              )}
              <motion.img
                key={galleryIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                src={selected.gallery[galleryIndex]}
                alt={`${selected.title} ${galleryIndex + 1}`}
                className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
              />
              {selected.gallery.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                  {selected.gallery.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryIndex(i)}
                      className={cn('h-2 rounded-full transition-all', i === galleryIndex ? 'w-8 bg-gold' : 'w-2 bg-white/30')}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
