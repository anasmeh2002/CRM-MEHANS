import { supabase } from './supabase';
import { dispatchAutomationEvent } from './automations';
import type {
  Lead, Contact, Property, Deal, Task, Meeting, Activity, TeamMember, PropertyImage, Note, Attachment,
} from './types';

export interface OrgSettings {
  id: number;
  org_name: string;
  website: string;
  industry: string;
  timezone: string;
  logo_path: string | null;
  primary_color: string;
  theme: string;
}

export interface AgencyProfile {
  id: string;
  name: string;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  address: string | null;
}

export interface NotificationRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  record_type: string | null;
  record_id: string | null;
  read: boolean;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  revoked_at: string | null;
}

export interface IntegrationRow {
  id: string;
  agency_id: string | null;
  service: string;
  connected: boolean;
  config: Record<string, unknown>;
}

export interface RolePermissionRow {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

function db() {
  return supabase;
}

// ─── Mappers ───

function mapProfileToTeamMember(row: any): TeamMember {
  return {
    id: row.id,
    name: row.full_name ?? '',
    email: row.email ?? '',
    phone: row.phone,
    role: row.role ?? 'agent',
    avatar_color: row.avatar_color ?? '#D4AF37',
    avatarColor: row.avatar_color ?? '#D4AF37',
    status: row.status ?? 'active',
    deals: row.deals ?? 0,
    revenue: Number(row.revenue ?? 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapContact(row: any): Contact {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed';
  return {
    ...row,
    name,
    avatarColor: '#D4AF37',
    lastContact: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'N/A',
    value: 0,
  };
}

function mapLead(row: any): Lead {
  const name = row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unnamed';
  const budget = Number(row.budget ?? row.budget_max ?? 0);
  return {
    ...row,
    name,
    avatarColor: '#D4AF37',
    tags: row.tags ?? [],
    budget,
    score: row.ai_score ?? row.score ?? 50,
    source: row.source ?? 'manual',
    status: row.status ?? 'new',
    property_interest: row.interested_in ?? row.property_interest ?? '',
    owner: row.assigned_agent?.full_name ?? 'Unassigned',
    assigned_agent: row.assigned_agent ? mapProfileToTeamMember(row.assigned_agent) : null,
    assigned_agent_id: row.assigned_to ?? row.assigned_agent_id,
    lastActivity: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'N/A',
    timeline: [],
    createdAt: row.created_at ?? '',
  };
}

function mapProperty(row: any): Property {
  const images = row.property_images ?? [];
  const coverImage = images.find((img: any) => img.is_cover)?.storage_path;
  const imageUrl = row.image_url || (coverImage ? getPropertyImageUrl(coverImage) : '');
  const gallery = images.length > 0
    ? images.map((img: any) => getPropertyImageUrl(img.storage_path))
    : imageUrl ? [imageUrl] : [];
  return {
    ...row,
    type: row.type ?? 'apartment',
    property_type: row.type ?? 'apartment',
    area: Number(row.area ?? 0),
    surface: Number(row.area ?? 0),
    agent: row.agent ? mapProfileToTeamMember(row.agent) : null,
    agent_id: row.assigned_to ?? row.agent_id,
    image: imageUrl,
    gallery,
    featured: row.featured ?? false,
    amenities: row.amenities ?? [],
  };
}

function mapDeal(row: any): Deal {
  const lead = row.lead;
  const leadName = lead
    ? (lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'N/A')
    : 'N/A';
  const property = row.property;
  const propertyName = property?.title ?? 'N/A';
  const owner = row.owner;
  const ownerName = owner?.full_name ?? 'Unassigned';
  return {
    ...row,
    value: Number(row.value ?? 0),
    closeDate: row.expected_close_date ?? 'N/A',
    createdAt: row.created_at ?? '',
    leadName,
    propertyName,
    ownerName,
  };
}

function mapTask(row: any): Task {
  return {
    ...row,
    dueDate: row.due_date ?? 'N/A',
    assignee: row.assignee ? mapProfileToTeamMember(row.assignee) : null,
    relatedType: row.related_type ?? '',
  };
}

function mapMeeting(row: any): Meeting {
  const startsAt = row.starts_at ? new Date(row.starts_at) : null;
  return {
    ...row,
    date: startsAt ? `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}` : '',
    time: startsAt ? `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}` : '',
    duration: row.duration_minutes ?? 30,
    type: row.meeting_type ?? 'in-person',
    attendee: row.attendee_name ?? 'TBD',
    assigned_agent: row.assigned_agent ? mapProfileToTeamMember(row.assigned_agent) : null,
  };
}

function mapActivity(row: any): Activity {
  return {
    ...row,
    type: row.type ?? row.activity_type ?? '',
    user: row.actor_name ?? 'System',
    timestamp: row.created_at ?? '',
  };
}

function getPropertyImageUrl(storagePath: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${url}/storage/v1/object/public/property-images/${storagePath}`;
}

// ─── Team Members ───

export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await db().from('profiles').select('*').order('created_at', { ascending: true });
  if (error) { console.error('[data] fetchTeamMembers failed', error); return []; }
  return (data ?? []).map(mapProfileToTeamMember);
}

// ─── Contacts ───

export async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await db().from('contacts').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[data] fetchContacts failed', error); return []; }
  return (data ?? []).map(mapContact);
}

export async function createContact(input: Partial<Contact>): Promise<Contact | null> {
  const payload = {
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    company: input.company,
    role: input.role,
    language: input.language,
    notes: input.notes,
  };
  const { data, error } = await db().from('contacts').insert(payload).select('*').single();
  if (error) { console.error('[data] createContact failed', error); return null; }
  return mapContact(data);
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<Contact | null> {
  const { data, error } = await db().from('contacts').update(patch).eq('id', id).select('*').single();
  if (error) { console.error('[data] updateContact failed', error); return null; }
  return mapContact(data);
}

export async function deleteContact(id: string): Promise<boolean> {
  const { error } = await db().from('contacts').delete().eq('id', id);
  if (error) { console.error('[data] deleteContact failed', error); return false; }
  return true;
}

// ─── Leads ───

export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await db()
    .from('leads')
    .select('*, assigned_agent:profiles!assigned_to(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error('[data] fetchLeads failed', error); return []; }
  return (data ?? []).map(mapLead);
}

export async function createLead(input: Partial<Lead>): Promise<Lead | null> {
  void dispatchAutomationEvent('lead.created', { lead: input });
  const payload: Record<string, unknown> = {
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone,
    whatsapp: input.whatsapp,
    source: input.source ?? 'manual',
    status: input.status ?? 'new',
    budget: input.budget ?? 0,
    budget_min: input.budget ?? 0,
    budget_max: input.budget ?? 0,
    ai_score: input.score ?? 50,
    score: input.score ?? 50,
    notes: input.notes,
    tags: input.tags ?? [],
    assigned_to: input.assigned_agent_id ?? null,
    language: input.language ?? 'English',
    interested_in: input.property_interest ?? null,
    priority: 'medium',
  };
  const { data, error } = await db().from('leads').insert(payload).select('*, assigned_agent:profiles!assigned_to(*)').single();
  if (error) { console.error('[data] createLead failed', error); return null; }
  return mapLead(data);
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Lead | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.first_name !== undefined) dbPatch.first_name = patch.first_name;
  if (patch.last_name !== undefined) dbPatch.last_name = patch.last_name;
  if (patch.email !== undefined) dbPatch.email = patch.email;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.whatsapp !== undefined) dbPatch.whatsapp = patch.whatsapp;
  if (patch.source !== undefined) dbPatch.source = patch.source;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.budget !== undefined) { dbPatch.budget = patch.budget; dbPatch.budget_max = patch.budget; }
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.tags !== undefined) dbPatch.tags = patch.tags;
  if (patch.assigned_agent_id !== undefined) dbPatch.assigned_to = patch.assigned_agent_id;
  if (patch.score !== undefined) { dbPatch.ai_score = patch.score; dbPatch.score = patch.score; }
  if (patch.property_interest !== undefined) dbPatch.interested_in = patch.property_interest;
  const { data, error } = await db().from('leads').update(dbPatch).eq('id', id).select('*, assigned_agent:profiles!assigned_to(*)').single();
  if (error) { console.error('[data] updateLead failed', error); return null; }
  if (patch.status === 'qualified') void dispatchAutomationEvent('lead.qualified', { lead_id: id, status: patch.status });
  return mapLead(data);
}

export async function deleteLead(id: string): Promise<boolean> {
  const { error } = await db().from('leads').delete().eq('id', id);
  if (error) { console.error('[data] deleteLead failed', error); return false; }
  return true;
}

export async function archiveLead(id: string): Promise<boolean> {
  const { error } = await db().from('leads').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.error('[data] archiveLead failed', error); return false; }
  return true;
}

// ─── Properties ───

export async function fetchProperties(): Promise<Property[]> {
  const { data, error } = await db()
    .from('properties')
    .select('*, agent:profiles!assigned_to(*), property_images(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error('[data] fetchProperties failed', error); return []; }
  return (data ?? []).map(mapProperty);
}

export async function createProperty(input: Partial<Property>): Promise<Property | null> {
  void dispatchAutomationEvent('property.match', { property: input });
  const payload: Record<string, unknown> = {
    title: input.title,
    address: input.address,
    city: input.city,
    country: input.country,
    type: input.type ?? input.property_type ?? 'apartment',
    price: input.price ?? 0,
    bedrooms: input.bedrooms ?? 0,
    bathrooms: input.bathrooms ?? 0,
    area: input.area ?? input.surface ?? 0,
    description: input.description,
    amenities: input.amenities ?? [],
    status: input.status ?? 'available',
    assigned_to: input.agent_id ?? null,
    featured: input.featured ?? false,
    image_url: input.image ?? null,
  };
  const { data, error } = await db().from('properties').insert(payload).select('*, agent:profiles!assigned_to(*), property_images(*)').single();
  if (error) { console.error('[data] createProperty failed', error); return null; }
  return mapProperty(data);
}

export async function updateProperty(id: string, patch: Partial<Property>): Promise<Property | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.address !== undefined) dbPatch.address = patch.address;
  if (patch.city !== undefined) dbPatch.city = patch.city;
  if (patch.country !== undefined) dbPatch.country = patch.country;
  if (patch.type !== undefined) dbPatch.type = patch.type;
  if (patch.property_type !== undefined) dbPatch.type = patch.property_type;
  if (patch.price !== undefined) dbPatch.price = patch.price;
  if (patch.bedrooms !== undefined) dbPatch.bedrooms = patch.bedrooms;
  if (patch.bathrooms !== undefined) dbPatch.bathrooms = patch.bathrooms;
  if (patch.area !== undefined) dbPatch.area = patch.area;
  if (patch.surface !== undefined) dbPatch.area = patch.surface;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.amenities !== undefined) dbPatch.amenities = patch.amenities;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.agent_id !== undefined) dbPatch.assigned_to = patch.agent_id;
  if (patch.featured !== undefined) dbPatch.featured = patch.featured;
  if (patch.image !== undefined) dbPatch.image_url = patch.image;
  const { data, error } = await db().from('properties').update(dbPatch).eq('id', id).select('*, agent:profiles!assigned_to(*), property_images(*)').single();
  if (error) { console.error('[data] updateProperty failed', error); return null; }
  return mapProperty(data);
}

export async function deleteProperty(id: string): Promise<boolean> {
  const { error } = await db().from('properties').delete().eq('id', id);
  if (error) { console.error('[data] deleteProperty failed', error); return false; }
  return true;
}

export async function archiveProperty(id: string): Promise<boolean> {
  const { error } = await db().from('properties').update({ archived_at: new Date().toISOString(), status: 'archived' }).eq('id', id);
  if (error) { console.error('[data] archiveProperty failed', error); return false; }
  return true;
}

// ─── Deals ───

export async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await db()
    .from('deals')
    .select('*, lead:leads(*), contact:contacts(*), property:properties(*), owner:profiles!owner_id(*)')
    .order('created_at', { ascending: false });
  if (error) { console.error('[data] fetchDeals failed', error); return []; }
  return (data ?? []).map(mapDeal);
}

export async function createDeal(input: Partial<Deal>): Promise<Deal | null> {
  const payload: Record<string, unknown> = {
    title: input.title,
    lead_id: input.lead_id ?? null,
    contact_id: input.contact_id ?? null,
    property_id: input.property_id ?? null,
    owner_id: input.owner_id ?? null,
    value: input.value ?? 0,
    expected_close_date: input.expected_close_date ?? null,
    stage: input.stage ?? 'new_lead',
    probability: input.probability ?? 20,
    notes: input.notes ?? null,
  };
  const { data, error } = await db().from('deals').insert(payload).select('*, lead:leads(*), contact:contacts(*), property:properties(*), owner:profiles!owner_id(*)').single();
  if (error) { console.error('[data] createDeal failed', error); return null; }
  return mapDeal(data);
}

export async function updateDeal(id: string, patch: Partial<Deal>): Promise<Deal | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.lead_id !== undefined) dbPatch.lead_id = patch.lead_id;
  if (patch.contact_id !== undefined) dbPatch.contact_id = patch.contact_id;
  if (patch.property_id !== undefined) dbPatch.property_id = patch.property_id;
  if (patch.owner_id !== undefined) dbPatch.owner_id = patch.owner_id;
  if (patch.value !== undefined) dbPatch.value = patch.value;
  if (patch.expected_close_date !== undefined) dbPatch.expected_close_date = patch.expected_close_date;
  if (patch.stage !== undefined) dbPatch.stage = patch.stage;
  if (patch.probability !== undefined) dbPatch.probability = patch.probability;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  const { data, error } = await db().from('deals').update(dbPatch).eq('id', id).select('*, lead:leads(*), contact:contacts(*), property:properties(*), owner:profiles!owner_id(*)').single();
  if (error) { console.error('[data] updateDeal failed', error); return null; }
  if (patch.stage === 'won') void dispatchAutomationEvent('deal.won', { deal_id: id, stage: 'won' });
  if (patch.stage === 'lost') void dispatchAutomationEvent('deal.lost', { deal_id: id, stage: 'lost' });
  return mapDeal(data);
}

export async function deleteDeal(id: string): Promise<boolean> {
  const { error } = await db().from('deals').delete().eq('id', id);
  if (error) { console.error('[data] deleteDeal failed', error); return false; }
  return true;
}

// ─── Tasks ───

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await db()
    .from('tasks')
    .select('*, assignee:profiles!assignee_id(*)')
    .order('due_date', { ascending: true });
  if (error) { console.error('[data] fetchTasks failed', error); return []; }
  return (data ?? []).map(mapTask);
}

export async function createTask(input: Partial<Task>): Promise<Task | null> {
  const payload: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    priority: input.priority ?? 'medium',
    status: input.status ?? 'todo',
    due_date: input.due_date ?? null,
    assignee_id: input.assignee_id ?? null,
    related_type: input.related_type ?? null,
    related_id: input.related_id ?? null,
  };
  const { data, error } = await db().from('tasks').insert(payload).select('*, assignee:profiles!assignee_id(*)').single();
  if (error) { console.error('[data] createTask failed', error); return null; }
  return mapTask(data);
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.due_date !== undefined) dbPatch.due_date = patch.due_date;
  if (patch.assignee_id !== undefined) dbPatch.assignee_id = patch.assignee_id;
  if (patch.completed_at !== undefined) dbPatch.completed_at = patch.completed_at;
  const { data, error } = await db().from('tasks').update(dbPatch).eq('id', id).select('*, assignee:profiles!assignee_id(*)').single();
  if (error) { console.error('[data] updateTask failed', error); return null; }
  return mapTask(data);
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await db().from('tasks').delete().eq('id', id);
  if (error) { console.error('[data] deleteTask failed', error); return false; }
  return true;
}

// ─── Meetings ───

export async function fetchMeetings(): Promise<Meeting[]> {
  const { data, error } = await db()
    .from('meetings')
    .select('*, lead:leads(*), contact:contacts(*), assigned_agent:profiles!assigned_agent_id(*)')
    .order('starts_at', { ascending: true });
  if (error) { console.error('[data] fetchMeetings failed', error); return []; }
  return (data ?? []).map(mapMeeting);
}

export async function createMeeting(input: Partial<Meeting>): Promise<Meeting | null> {
  void dispatchAutomationEvent('meeting.created', { meeting: input });
  const payload: Record<string, unknown> = {
    title: input.title,
    starts_at: input.starts_at ?? new Date().toISOString(),
    duration_minutes: input.duration_minutes ?? 30,
    meeting_type: input.meeting_type ?? 'in-person',
    location: input.location,
    attendee_name: input.attendee_name,
    attendee_email: input.attendee_email,
    lead_id: input.lead_id ?? null,
    contact_id: input.contact_id ?? null,
    assigned_agent_id: input.assigned_agent_id ?? null,
    status: input.status ?? 'upcoming',
    notes: input.notes,
  };
  const { data, error } = await db().from('meetings').insert(payload).select('*, lead:leads(*), contact:contacts(*), assigned_agent:profiles!assigned_agent_id(*)').single();
  if (error) { console.error('[data] createMeeting failed', error); return null; }
  return mapMeeting(data);
}

export async function updateMeeting(id: string, patch: Partial<Meeting>): Promise<Meeting | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.starts_at !== undefined) dbPatch.starts_at = patch.starts_at;
  if (patch.duration_minutes !== undefined) dbPatch.duration_minutes = patch.duration_minutes;
  if (patch.meeting_type !== undefined) dbPatch.meeting_type = patch.meeting_type;
  if (patch.location !== undefined) dbPatch.location = patch.location;
  if (patch.attendee_name !== undefined) dbPatch.attendee_name = patch.attendee_name;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  const { data, error } = await db().from('meetings').update(dbPatch).eq('id', id).select('*, lead:leads(*), contact:contacts(*), assigned_agent:profiles!assigned_agent_id(*)').single();
  if (error) { console.error('[data] updateMeeting failed', error); return null; }
  if (patch.status === 'cancelled') void dispatchAutomationEvent('meeting.cancelled', { meeting_id: id });
  if (patch.status === 'completed') void dispatchAutomationEvent('meeting.completed', { meeting_id: id });
  void dispatchAutomationEvent('meeting.updated', { meeting_id: id, patch });
  return mapMeeting(data);
}

export async function deleteMeeting(id: string): Promise<boolean> {
  const { error } = await db().from('meetings').delete().eq('id', id);
  if (error) { console.error('[data] deleteMeeting failed', error); return false; }
  return true;
}

// ─── Activities ───

export async function fetchActivities(recordType?: string, recordId?: string): Promise<Activity[]> {
  let query = db().from('activities').select('*').order('created_at', { ascending: false }).limit(100);
  if (recordType && recordId) {
    query = query.eq('record_type', recordType).eq('record_id', recordId);
  }
  const { data, error } = await query;
  if (error) { console.error('[data] fetchActivities failed', error); return []; }
  return (data ?? []).map(mapActivity);
}

export async function createActivity(activity: Partial<Activity>): Promise<Activity | null> {
  const payload: Record<string, unknown> = {
    type: activity.type ?? activity.activity_type ?? 'note',
    title: activity.title,
    description: activity.description,
    actor_name: activity.actor_name ?? activity.user,
    record_type: activity.record_type,
    record_id: activity.record_id,
    lead_id: activity.lead_id,
    property_id: activity.property_id,
  };
  const { data, error } = await db().from('activities').insert(payload).select('*').single();
  if (error) { console.error('[data] createActivity failed', error); return null; }
  return mapActivity(data);
}

// ─── Notes ───

export async function fetchNotes(recordType: string, recordId: string): Promise<Note[]> {
  const { data, error } = await db().from('notes').select('*').eq('record_type', recordType).eq('record_id', recordId).order('created_at', { ascending: false });
  if (error) { console.error('[data] fetchNotes failed', error); return []; }
  return (data ?? []) as Note[];
}

export async function createNote(recordType: string, recordId: string, body: string, authorName?: string): Promise<Note | null> {
  const { data, error } = await db().from('notes').insert({ record_type: recordType, record_id: recordId, body, author_name: authorName }).select('*').single();
  if (error) { console.error('[data] createNote failed', error); return null; }
  return data as Note;
}

// ─── Attachments ───

export async function fetchAttachments(recordType: string, recordId: string): Promise<Attachment[]> {
  const { data, error } = await db().from('attachments').select('*').eq('record_type', recordType).eq('record_id', recordId).order('created_at', { ascending: false });
  if (error) { console.error('[data] fetchAttachments failed', error); return []; }
  return (data ?? []) as Attachment[];
}

// ─── Property Images ───

export async function fetchPropertyImages(propertyId: string): Promise<PropertyImage[]> {
  const { data, error } = await db().from('property_images').select('*').eq('property_id', propertyId).order('sort_order', { ascending: true });
  if (error) { console.error('[data] fetchPropertyImages failed', error); return []; }
  return (data ?? []) as PropertyImage[];
}

export async function uploadPropertyImage(propertyId: string, file: File, sortOrder = 0): Promise<PropertyImage | null> {
  const fileName = `${propertyId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await db().storage.from('property-images').upload(fileName, file, { upsert: false });
  if (uploadError) { console.error('[data] uploadPropertyImage failed', uploadError); return null; }
  const { data, error } = await db().from('property_images').insert({ property_id: propertyId, storage_path: fileName, file_name: file.name, sort_order: sortOrder }).select('*').single();
  if (error) { console.error('[data] uploadPropertyImage db failed', error); return null; }
  return data as PropertyImage;
}

export async function deletePropertyImage(imageId: string, storagePath: string): Promise<boolean> {
  const { error: dbError } = await db().from('property_images').delete().eq('id', imageId);
  if (dbError) { console.error('[data] deletePropertyImage db failed', dbError); return false; }
  await db().storage.from('property-images').remove([storagePath]);
  return true;
}

// ─── Dashboard Stats ───

export type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'all';

export function getDateRangeStart(range: DateRange): Date | null {
  const now = new Date();
  switch (range) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': { const q = Math.floor(now.getMonth() / 3); return new Date(now.getFullYear(), q * 3, 1); }
    case 'all': return null;
  }
}

export async function fetchDashboardStats(range: DateRange = 'month') {
  const startDate = getDateRangeStart(range);
  const [leads, deals, meetings, tasks, properties] = await Promise.all([
    fetchLeads(),
    fetchDeals(),
    fetchMeetings(),
    fetchTasks(),
    fetchProperties(),
  ]);

  const inRange = (dateStr: string | null | undefined) => {
    if (!startDate) return true;
    if (!dateStr) return false;
    return new Date(dateStr) >= startDate;
  };

  const wonDeals = deals.filter((d) => d.stage === 'won' && inRange(d.createdAt ?? d.closeDate));
  const revenue = wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const openDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const rangeLeads = leads.filter((l) => inRange(l.createdAt));
  const conversionRate = rangeLeads.length > 0 ? (wonDeals.length / rangeLeads.length) * 100 : 0;
  const upcomingMeetings = meetings.filter((m) => m.status === 'upcoming');
  const openTasks = tasks.filter((t) => t.status !== 'done');

  return {
    revenue,
    pipelineValue,
    conversionRate,
    appointmentsCount: upcomingMeetings.length,
    tasksCount: openTasks.length,
    propertiesCount: properties.length,
    leadsCount: rangeLeads.length,
    dealsCount: deals.length,
  };
}

export async function fetchRevenueData() {
  const deals = await fetchDeals();
  const wonDeals = deals.filter((d) => d.stage === 'won');
  const now = new Date();
  const months: { month: string; revenue: number; target: number }[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthRevenue = wonDeals
      .filter((deal) => {
        const dealDate = new Date(deal.createdAt ?? deal.closeDate ?? monthEnd);
        return dealDate >= monthStart && dealDate < monthEnd;
      })
      .reduce((sum, deal) => sum + (deal.value ?? 0), 0);
    const target = 1500000 + (7 - i) * 200000;
    months.push({ month: monthNames[d.getMonth()], revenue: monthRevenue, target });
  }
  return months;
}

export async function fetchPipelineData() {
  const deals = await fetchDeals();
  const now = new Date();
  const months: { month: string; value: number }[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthValue = deals
      .filter((deal) => {
        const dealDate = new Date(deal.createdAt ?? monthEnd);
        return dealDate >= monthStart && dealDate < monthEnd;
      })
      .reduce((sum, deal) => sum + (deal.value ?? 0), 0);
    months.push({ month: monthNames[d.getMonth()], value: Math.round(monthValue / 1_000_000 * 10) / 10 });
  }
  return months;
}

export async function fetchLeadSourceData() {
  const leads = await fetchLeads();
  const sourceMap: Record<string, number> = {};
  leads.forEach((lead) => {
    const source = lead.source ?? 'manual';
    sourceMap[source] = (sourceMap[source] ?? 0) + 1;
  });

  const colors: Record<string, string> = {
    website: '#D4AF37', referral: '#4A90D9', social: '#5BAA6F',
    portal: '#9B6FBF', 'walk-in': '#D4823A', 'cold-call': '#C75555',
    manual: '#8A8A82',
  };

  const total = leads.length || 1;
  return [
    { name: 'Website', value: Math.round(((sourceMap.website ?? 0) / total) * 100), color: colors.website },
    { name: 'Referral', value: Math.round(((sourceMap.referral ?? 0) / total) * 100), color: colors.referral },
    { name: 'Social Media', value: Math.round(((sourceMap.social ?? 0) / total) * 100), color: colors.social },
    { name: 'Portal', value: Math.round(((sourceMap.portal ?? 0) / total) * 100), color: colors.portal },
    { name: 'Walk-in', value: Math.round(((sourceMap['walk-in'] ?? 0) / total) * 100), color: colors['walk-in'] },
    { name: 'Cold Call', value: Math.round(((sourceMap['cold-call'] ?? 0) / total) * 100), color: colors['cold-call'] },
  ].filter((s) => s.value > 0);
}

export async function fetchFunnelData() {
  const leads = await fetchLeads();
  const deals = await fetchDeals();

  const stageCounts: Record<string, { count: number; value: number }> = {
    'New Leads': { count: 0, value: 0 },
    Qualified: { count: 0, value: 0 },
    'Visit Scheduled': { count: 0, value: 0 },
    Negotiation: { count: 0, value: 0 },
    Won: { count: 0, value: 0 },
  };

  leads.forEach((lead) => {
    const status = lead.status ?? 'new';
    if (status === 'new') stageCounts['New Leads'].count++;
    else if (status === 'qualified') stageCounts.Qualified.count++;
    else if (status === 'visit_scheduled') stageCounts['Visit Scheduled'].count++;
    else if (status === 'negotiation') stageCounts.Negotiation.count++;
    else if (status === 'won') stageCounts.Won.count++;
  });

  deals.forEach((deal) => {
    const stage = deal.stage ?? 'new_lead';
    if (stage === 'new_lead') stageCounts['New Leads'].value += deal.value ?? 0;
    else if (stage === 'qualified') stageCounts.Qualified.value += deal.value ?? 0;
    else if (stage === 'visit_scheduled') stageCounts['Visit Scheduled'].value += deal.value ?? 0;
    else if (stage === 'negotiation') stageCounts.Negotiation.value += deal.value ?? 0;
    else if (stage === 'won') stageCounts.Won.value += deal.value ?? 0;
  });

  return Object.entries(stageCounts).map(([stage, data]) => ({
    stage,
    count: data.count,
    value: data.value,
  }));
}

// ─── Settings ──────────────────────────────────────────────────────────────

export async function fetchSettings(): Promise<OrgSettings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data as OrgSettings | null;
}

export async function updateSettings(updates: Partial<Omit<OrgSettings, 'id'>>): Promise<OrgSettings | null> {
  const { data, error } = await supabase
    .from('settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as OrgSettings | null;
}

// ─── Agency Profile ──────────────────────────────────────────────────────────

export async function fetchAgency(): Promise<AgencyProfile | null> {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as AgencyProfile | null;
}

export async function updateAgency(updates: Partial<Omit<AgencyProfile, 'id'>>): Promise<AgencyProfile | null> {
  const { data, error } = await supabase
    .from('agencies')
    .update(updates)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as AgencyProfile | null;
}

export async function uploadAgencyLogo(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const path = `logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('agency-logos')
    .upload(path, file, { cacheControl: '3600', upsert: true });
  if (uploadError) throw uploadError;
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/agency-logos/${path}`;
  return url;
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .neq('read', true);
  if (error) throw error;
  return true;
}

export async function createNotification(input: {
  title: string;
  description?: string;
  type?: string;
  record_type?: string;
  record_id?: string;
}): Promise<NotificationRow | null> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      title: input.title,
      description: input.description ?? null,
      type: input.type ?? 'info',
      record_type: input.record_type ?? null,
      record_id: input.record_id ?? null,
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as NotificationRow | null;
}

// ─── API Keys ────────────────────────────────────────────────────────────────

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `mhk_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const prefix = raw.slice(0, 12);
  // Simple hash — since we can't use crypto.subtle synchronously in all contexts,
  // we use a basic hash. For production, a server-side function would be better.
  let hash = '';
  for (let i = 0; i < raw.length; i++) {
    hash += (raw.charCodeAt(i) * 31 + i * 7).toString(16);
  }
  return { raw, hash, prefix };
}

export async function fetchApiKeys(): Promise<ApiKeyRow[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_at, revoked_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiKeyRow[];
}

export async function createApiKey(name: string): Promise<{ rawKey: string; row: ApiKeyRow } | null> {
  const { raw, hash, prefix } = generateApiKey();
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ name, key_hash: hash, key_prefix: prefix })
    .select('id, name, key_prefix, created_at, revoked_at')
    .maybeSingle();
  if (error) throw error;
  return { rawKey: raw, row: data as ApiKeyRow };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  return true;
}

// ─── Integrations ─────────────────────────────────────────────────────────────

export async function fetchIntegrations(): Promise<IntegrationRow[]> {
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .order('service', { ascending: true });
  if (error) throw error;
  return (data ?? []) as IntegrationRow[];
}

export async function toggleIntegration(service: string, connected: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('integrations')
    .update({ connected, updated_at: new Date().toISOString() })
    .eq('service', service)
    .not('agency_id', 'is', null);
  if (error) throw error;
  return true;
}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export async function fetchRolePermissions(): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase
    .from('role_permissions')
    .select('*')
    .order('role, module', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RolePermissionRow[];
}

export async function updateRolePermission(id: string, updates: Partial<Pick<RolePermissionRow, 'can_view' | 'can_create' | 'can_edit' | 'can_delete'>>): Promise<boolean> {
  const { error } = await supabase
    .from('role_permissions')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
  return true;
}

// ─── Team Members (for settings/users) ────────────────────────────────────────

export async function fetchProfiles(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    ...p,
    avatarColor: p.avatar_color ?? '#D4AF37',
    name: p.name ?? (`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || 'Unknown'),
    status: p.status ?? 'active',
    deals: p.deals ?? 0,
    revenue: p.revenue ?? 0,
  })) as TeamMember[];
}

export async function updateProfileRole(id: string, role: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function deactivateProfile(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function createProfile(input: { name: string; email: string; role: string }): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      name: input.name,
      email: input.email,
      role: input.role,
      avatar_color: '#D4AF37',
      status: 'active',
    })
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, avatarColor: data.avatar_color ?? '#D4AF37', name: data.name ?? 'Unknown', status: data.status ?? 'active', deals: data.deals ?? 0, revenue: data.revenue ?? 0 } as TeamMember;
}

// ─── Global Search ────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  type: 'lead' | 'property' | 'deal' | 'task' | 'meeting';
  label: string;
  subtitle: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  const [leads, properties, deals, tasks, meetings] = await Promise.all([
    supabase.from('leads').select('id, first_name, last_name, email, status').ilike('first_name', `%${q}%`),
    supabase.from('leads').select('id, first_name, last_name, email, status').ilike('last_name', `%${q}%`),
    supabase.from('properties').select('id, title, address, city, status').ilike('title', `%${q}%`),
    supabase.from('deals').select('id, title, stage, value').ilike('title', `%${q}%`),
    supabase.from('tasks').select('id, title, status, priority').ilike('title', `%${q}%`),
    supabase.from('meetings').select('id, title, status, meeting_type').ilike('title', `%${q}%`),
  ]);

  for (const l of (leads.data ?? [])) {
    results.push({ id: l.id, type: 'lead', label: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim(), subtitle: `Lead · ${l.status}` });
  }
  for (const l of (leads.data ?? [])) {
    // avoid duplicates from first_name match — already added above
    break;
  }
  for (const l of ((properties.data ?? []) as any[])) {
    results.push({ id: l.id, type: 'property', label: l.title, subtitle: `Property · ${l.city ?? ''}` });
  }
  for (const d of ((deals.data ?? []) as any[])) {
    results.push({ id: d.id, type: 'deal', label: d.title, subtitle: `Deal · ${d.stage}` });
  }
  for (const t of ((tasks.data ?? []) as any[])) {
    results.push({ id: t.id, type: 'task', label: t.title, subtitle: `Task · ${t.status}` });
  }
  for (const m of ((meetings.data ?? []) as any[])) {
    results.push({ id: m.id, type: 'meeting', label: m.title, subtitle: `Meeting · ${m.meeting_type}` });
  }

  return results.slice(0, 10);
}
