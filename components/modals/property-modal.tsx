'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Field, TextInput, TextArea, Select, TagInput, UploadField, Switch, LoadingButton, Modal } from '@/components/forms';
import { createProperty, uploadPropertyImage } from '@/lib/data';
import { useRefresh } from '@/components/refresh-provider';
import type { PropertyType, PropertyStatus } from '@/lib/types';

const propertyTypes: { value: PropertyType; label: string }[] = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'penthouse', label: 'Penthouse' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
];

const propertyStatuses: { value: PropertyStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
  { value: 'off-market', label: 'Off Market' },
];

const agents = ['Aarav Mehta', 'Priya Sharma', 'Rohan Kapoor', 'Sneha Reddy', 'Vikram Singh', 'Ananya Iyer'];
const amenitySuggestions = ['Pool', 'Gym', 'Garden', 'Garage', 'Smart Home', 'Sea View', 'Rooftop', 'Elevator', 'Security', 'Concierge', 'AC', 'Heating'];

export function PropertyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  const handleFileChange = (file: File) => {
    setFiles((p) => [...p, file]);
    setPreviews((p) => [...p, URL.createObjectURL(file)]);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.address.trim()) { toast.error('Address is required'); return; }
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
        toast.success(`Property "${form.title}" created`);
        triggerRefresh();
        onClose();
        setForm({ title: '', address: '', city: '', country: '', type: 'apartment', price: '', bedrooms: '', bathrooms: '', surface: '', description: '', status: 'draft', agent: '' });
        setAmenities([]);
        setFiles([]);
        setPreviews([]);
        setFeatured(false);
      } else {
        toast.error('Failed to save. Check your database connection and try again.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Property"
      description="List a new property with photos and full details."
      size="xl"
      footer={
        <>
          <button className="btn btn-outline btn-md" onClick={onClose}>Cancel</button>
          <LoadingButton onClick={handleSave} loading={saving} variant="gold">
            {form.status === 'draft' ? 'Save Draft' : 'Publish Property'}
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-6">
        {/* Gallery upload */}
        <div>
          <p className="eyebrow mb-3">Photo Gallery</p>
          <UploadField label="Upload photos" accept="image/*" onChange={handleFileChange} />
          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border">
                  <img src={src} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold text-[#0D0D0F]">COVER</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title" required>
              <TextInput value={form.title} onChange={(v) => set('title', v)} placeholder="Skyline Penthouse" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Address" required>
              <TextInput value={form.address} onChange={(v) => set('address', v)} placeholder="1200 Brickell Ave, PH-2" />
            </Field>
          </div>
          <Field label="City">
            <TextInput value={form.city} onChange={(v) => set('city', v)} placeholder="Miami, FL" />
          </Field>
          <Field label="Country">
            <TextInput value={form.country} onChange={(v) => set('country', v)} placeholder="United States" />
          </Field>
          <Field label="Property Type">
            <Select value={form.type} onChange={(v) => set('type', v as PropertyType)} options={propertyTypes} />
          </Field>
          <Field label="Price">
            <TextInput value={form.price} onChange={(v) => set('price', v)} placeholder="4,200,000" type="number" />
          </Field>
          <Field label="Bedrooms">
            <TextInput value={form.bedrooms} onChange={(v) => set('bedrooms', v)} placeholder="4" type="number" />
          </Field>
          <Field label="Bathrooms">
            <TextInput value={form.bathrooms} onChange={(v) => set('bathrooms', v)} placeholder="5" type="number" />
          </Field>
          <Field label="Surface (sq ft)">
            <TextInput value={form.surface} onChange={(v) => set('surface', v)} placeholder="4200" type="number" />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(v) => set('status', v as PropertyStatus)} options={propertyStatuses} />
          </Field>
          <Field label="Agent">
            <Select value={form.agent} onChange={(v) => set('agent', v)} options={agents.map((a) => ({ value: a, label: a }))} placeholder="Select agent..." />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Amenities">
              <TagInput value={amenities} onChange={setAmenities} placeholder="Add amenity..." suggestions={amenitySuggestions} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <TextArea value={form.description} onChange={(v) => set('description', v)} placeholder="Floor-to-ceiling glass walls with panoramic ocean and city views..." rows={4} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Switch checked={featured} onChange={setFeatured} label="Featured listing" description="Show this property in featured sections across the CRM" />
          </div>
        </div>
      </div>
    </Modal>
  );
}
