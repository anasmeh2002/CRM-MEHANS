export type LeadStatus = 'new' | 'qualified' | 'visit_scheduled' | 'negotiation' | 'won' | 'lost';
export type LeadSource = 'website' | 'referral' | 'social' | 'walk-in' | 'portal' | 'cold-call';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type PropertyStatus = 'draft' | 'available' | 'reserved' | 'sold' | 'rented' | 'off-market' | 'archived';
export type PropertyType = 'apartment' | 'villa' | 'penthouse' | 'townhouse' | 'land' | 'commercial';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type DealStage = 'new_lead' | 'qualified' | 'visit_scheduled' | 'negotiation' | 'won' | 'lost';
export type MeetingType = 'google_meet' | 'zoom' | 'in-person' | 'call' | 'visit';
export type MeetingStatus = 'upcoming' | 'completed' | 'cancelled';
export type RecordType = 'lead' | 'contact' | 'property' | 'deal';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatar_color?: string;
  avatarColor: string;
  status: 'active' | 'away' | 'offline';
  deals: number;
  revenue: number;
  created_at?: string;
  updated_at?: string;
}

export interface Lead {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  source: LeadSource;
  property_interest?: string;
  budget: number;
  language?: string;
  assigned_agent_id?: string;
  contact_id?: string;
  status: LeadStatus;
  score: number;
  notes?: string;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
  assigned_agent?: TeamMember | null;
  contact?: Contact | null;
  name: string;
  avatarColor: string;
  tags: string[];
  owner: string;
  lastActivity: string;
  timeline: TimelineEntry[];
  createdAt: string;
}

export interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  company?: string;
  role?: string;
  language?: string;
  notes?: string;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
  name: string;
  avatarColor: string;
  lastContact: string;
  value: number;
}

export interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  country?: string;
  property_type?: PropertyType;
  type: PropertyType;
  price: number;
  bedrooms: number;
  bathrooms: number;
  surface?: number;
  area: number;
  description?: string;
  amenities?: string[];
  status: PropertyStatus;
  agent_id?: string;
  agent: any;
  featured: boolean;
  published_at?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
  property_images?: PropertyImage[];
  image: string;
  gallery: string[];
}

export interface PropertyImage {
  id: string;
  property_id: string;
  storage_path: string;
  file_name: string;
  alt_text?: string;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  lead_id?: string;
  contact_id?: string;
  property_id?: string;
  owner_id?: string;
  value: number;
  expected_close_date?: string;
  closeDate: string;
  stage: DealStage;
  probability: number;
  notes?: string;
  archived_at?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  lead: any;
  contact?: any;
  property: any;
  owner: any;
  leadName: string;
  propertyName: string;
  ownerName: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: Priority;
  status: TaskStatus;
  due_date?: string;
  dueDate: string;
  assignee_id?: string;
  assignee: any;
  related_type?: RecordType;
  related_id?: string;
  relatedTo?: string;
  relatedType?: string;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Meeting {
  id: string;
  title: string;
  starts_at?: string;
  duration_minutes?: number;
  duration: number;
  meeting_type?: MeetingType;
  type: string;
  location?: string;
  calendar_sync?: string;
  attendee_name?: string;
  attendee: string;
  attendee_email?: string;
  lead_id?: string;
  contact_id?: string;
  assigned_agent_id?: string;
  status: MeetingStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  lead?: Lead | null;
  contact?: Contact | null;
  assigned_agent?: TeamMember | null;
  date: string;
  time: string;
}

export interface Activity {
  id: string;
  record_type?: string;
  record_id?: string;
  activity_type?: string;
  type: string;
  title: string;
  description?: string;
  actor_name?: string;
  created_at?: string;
  user: string;
  timestamp: string;
  lead_id?: string;
  property_id?: string;
}

export interface Note {
  id: string;
  record_type: RecordType;
  record_id: string;
  body: string;
  author_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Attachment {
  id: string;
  record_type: RecordType;
  record_id: string;
  storage_path: string;
  file_name: string;
  content_type?: string;
  size_bytes?: number;
  created_at?: string;
}

export interface TimelineEntry {
  id: string;
  type: 'call' | 'email' | 'whatsapp' | 'meeting' | 'note' | 'status_change';
  title: string;
  description: string;
  timestamp: string;
  author: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  employees: number;
  revenue: number;
  contacts: number;
  deals: number;
  logoColor: string;
}
