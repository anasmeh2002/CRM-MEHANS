'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';

const LeadModal = dynamic(() => import('@/components/modals/lead-modal').then((m) => m.LeadModal), { ssr: false });
const ContactModal = dynamic(() => import('@/components/modals/contact-modal').then((m) => m.ContactModal), { ssr: false });
const PropertyModal = dynamic(() => import('@/components/modals/property-modal').then((m) => m.PropertyModal), { ssr: false });
const DealModal = dynamic(() => import('@/components/modals/deal-modal').then((m) => m.DealModal), { ssr: false });
const TaskModal = dynamic(() => import('@/components/modals/task-modal').then((m) => m.TaskModal), { ssr: false });
const MeetingModal = dynamic(() => import('@/components/modals/meeting-modal').then((m) => m.MeetingModal), { ssr: false });

export type ModalType = 'lead' | 'contact' | 'property' | 'deal' | 'task' | 'meeting';

interface ModalContextValue {
  openModal: (type: ModalType) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useGlobalModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useGlobalModal must be used within ModalProvider');
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ModalType | null>(null);

  const openModal = (type: ModalType) => setActive(type);
  const closeModal = () => setActive(null);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {active === 'lead' && <LeadModal open onClose={closeModal} />}
      {active === 'contact' && <ContactModal open onClose={closeModal} />}
      {active === 'property' && <PropertyModal open onClose={closeModal} />}
      {active === 'deal' && <DealModal open onClose={closeModal} />}
      {active === 'task' && <TaskModal open onClose={closeModal} />}
      {active === 'meeting' && <MeetingModal open onClose={closeModal} />}
    </ModalContext.Provider>
  );
}
