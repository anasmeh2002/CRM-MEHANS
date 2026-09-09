'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchAgency } from '@/lib/data';
import { useAuth } from '@/components/auth-provider';
import type { CurrencyCode } from '@/lib/format';

type AgencyContextValue = {
  currency: CurrencyCode;
};

const AgencyContext = createContext<AgencyContextValue>({ currency: 'MAD' });

export function AgencyProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [currency, setCurrency] = useState<CurrencyCode>('MAD');

  useEffect(() => {
    let mounted = true;
    const loadAgency = async () => {
      if (authLoading || !user) {
        if (mounted) setCurrency('MAD');
        return;
      }
      try {
        const agency = await fetchAgency();
        if (mounted && agency?.currency) setCurrency(agency.currency);
      } catch {
        if (mounted) setCurrency('MAD');
      }
    };
    void loadAgency();
    const handleUpdate = () => void loadAgency();
    window.addEventListener('agency-updated', handleUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('agency-updated', handleUpdate);
    };
  }, [user?.id, authLoading]);

  return <AgencyContext.Provider value={{ currency }}>{children}</AgencyContext.Provider>;
}

export function useAgency() {
  return useContext(AgencyContext);
}
