'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, TagInput, UploadField, Switch, LoadingButton, Modal } from '@/components/forms';
import { createProperty, uploadPropertyImage } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import { useLanguage } from '@/components/language-provider';
import type { PropertyType, PropertyStatus } from '@/lib/types';

const typeKeys: Record<PropertyType, string> = {
  apartment: 'property.apartment', villa: 'property.villa', penthouse: 'property.penthouse',
  townhouse: 'property.townhouse', land: 'property.land', commercial: 'property.commercial',
};

const statusKeys: Record<PropertyStatus, string> = {
  draft: 'property.draft', available: 'property.available', reserved: 'property.reserved',
  sold: 'property.sold', rented: 'property.rented', 'off-market': 'property.offMarket',
};

const amenityKeys: Record<string, string> = {
  Pool: 'amenity.pool', Gym: 'amenity.gym', Garden: 'amenity.garden', Garage: 'amenity.garage',
  'Smart Home': 'amenity.smartHome', 'Sea View': 'amenity.seaView', Rooftop: 'amenity.rooftop',
  Elevator: 'amenity.elevator', Security: 'amenity.security', Concierge: 'amenity.concierge',
  AC: 'amenity.ac', Heating: 'amenity.heating',
};

const agents: string[] = [];

export function PropertyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { triggerRefresh } = useRefresh();
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [featured, setFeatured] = useState(false);
  const [form, setForm] = useState({
    title: '', address: '', city: '', country: '', type: 'apartment' as PropertyType,
    price: '', bedrooms: '', bathrooms: '', surface: '', description: '', status: 'draft' as PropertyStatus, agent: '',
  });
  const [amenities, setAmenities] = useState<string[]>([]);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const propertyTypes = (Object.keys(typeKeys) as PropertyType[]).map((v) => ({ value: v, label: t(typeKeys[v]) }));
  const propertyStatuses = (Object.keys(statusKeys) as PropertyStatus[]).map((v) => ({ value: v, label: t(statusKeys[v]) }));
  const amenitySuggestions = Object.keys(amenityKeys);

  const handleFileChange = (file: File) => {
    setFiles((p) => [...p, file]);
    setPreviews((p) => [...p, URL.createObjectURL(file)]);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error(t('propertyModal.titleRequired')); return; }
    if (!form.address.trim()) { toast.error(t('propertyModal.addressRequired')); return; }
    setSaving(true);
    try {
      const property = await createProperty({
        title: form.title,
        address: form.address,
        city: form.city,
        country: form.country || '',
        type: form.type,
        price: Number(form.price) || 0,
        bedrooms: Number(form.bedrooms) || 0,
        bathrooms: Number(form.bathrooms) || 0,
        area: Number(form.surface) || 0,
        description: form.description || undefined,
        amenities,
        status: form.status,
        featured,
        published_at: form.status === 'available' ? new Date().toISOString() : null,
      });
      if (property) {
        for (let i = 0; i < files.length; i++) {
          await uploadPropertyImage(property.id, files[i], i);
        }
        toast.success(t('propertyModal.propertyCreated', { title: form.title }));
        triggerRefresh();
        onClose();
        setForm({ title: '', address: '', city: '', country: '', type: 'apartment', price: '', bedrooms: '', bathrooms: '', surface: '', description: '', status: 'draft', agent: '' });
        setAmenities([]);
        setFiles([]);
        setPreviews([]);
        setFeatured(false);
      } else {
        toast.error(t('modal.failedToSaveDb'));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('modal.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('propertyModal.title')}
      description={t('propertyModal.description')}
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>{t('modal.cancel')}</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">
            {form.status === 'draft' ? t('propertyModal.saveDraft') : t('propertyModal.publishProperty')}
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-6">
        {/* Gallery upload */}
        <div>
          <p className="eyebrow mb-3">{t('propertyModal.photoGallery')}</p>
          <UploadField label={t('propertyModal.uploadPhotos')} accept="image/*" onChange={handleFileChange} />
          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                  <img src={src} alt={t('common.preview')} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rtl:right-1 rtl:left-auto rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold text-[#0D0D0F]">{t('propertyModal.cover')}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label={t('propertyModal.propertyTitle')} required>
              <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder={t('propertyModal.titlePlaceholder')} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('propertyModal.address')} required>
              <TextInput value={form.address} onChange={(v) => set('address', v)} placeholder={t('propertyModal.addressPlaceholder')} />
            </Field>
          </div>
          <Field label={t('properties.city')}>
            <TextInput value={form.city} onChange={(v) => set('city', v)} placeholder={t('propertyModal.cityPlaceholder')} />
          </Field>
          <Field label={t('propertyModal.country')}>
            <TextInput value={form.country} onChange={(v) => set('country', v)} placeholder={t('propertyModal.countryPlaceholder')} />
          </Field>
          <Field label={t('propertyModal.propertyType')}>
            <Select value={form.type} onChange={(v) => set('type', v as PropertyType)} options={propertyTypes} />
          </Field>
          <Field label={t('properties.price')}>
            <TextInput value={form.price} onChange={(v) => set('price', v)} placeholder={t('propertyModal.pricePlaceholder')} type="number" />
          </Field>
          <Field label={t('properties.bedrooms')}>
            <TextInput value={form.bedrooms} onChange={(v) => set('bedrooms', v)} placeholder={t('propertyModal.bedroomsPlaceholder')} type="number" />
          </Field>
          <Field label={t('properties.bathrooms')}>
            <TextInput value={form.bathrooms} onChange={(v) => set('bathrooms', v)} placeholder={t('propertyModal.bathroomsPlaceholder')} type="number" />
          </Field>
          <Field label={t('propertyModal.surface')}>
            <TextInput value={form.surface} onChange={(v) => set('surface', v)} placeholder={t('propertyModal.surfacePlaceholder')} type="number" />
          </Field>
          <Field label={t('common.status')}>
            <Select value={form.status} onChange={(v) => set('status', v as PropertyStatus)} options={propertyStatuses} />
          </Field>
          <Field label={t('propertyModal.agent')}>
            <Select value={form.agent} onChange={(v) => set('agent', v)} options={agents.map((a) => ({ value: a, label: a }))} placeholder={t('propertyModal.selectAgent')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('propertyModal.amenities')}>
              <TagInput value={amenities} onChange={setAmenities} placeholder={t('propertyModal.amenitiesPlaceholder')} suggestions={amenitySuggestions} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('propertyModal.description')}>
              <TextArea value={form.description} onChange={(v) => set('description', v)} placeholder={t('propertyModal.descriptionPlaceholder')} rows={4} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Switch checked={featured} onChange={setFeatured} label={t('propertyModal.descriptionPlaceholder')} description={t('propertyModal.showFeatured')} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
