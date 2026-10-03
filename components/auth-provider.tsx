'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const activateInvitation = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) return;

    const params = new URLSearchParams(window.location.search);
    const invitationId = params.get('invitation_id');
    if (!invitationId) return;

    const { data: freshSessionData } = await supabase.auth.getSession();
    const activeSession = freshSessionData.session ?? nextSession;
    if (!activeSession.access_token) return;

    try {
      const response = await fetch('/api/invitations/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + activeSession.access_token,
        },
        body: JSON.stringify({ invitation_id: invitationId }),
      });

      if (response.ok) {
        params.delete('invitation_id');
        const cleanQuery = params.toString();
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname +
            (cleanQuery ? '?' + cleanQuery : '') +
            window.location.hash
        );
        router.refresh();
      }
    } catch {
      // Retry on the next auth/session event or page load.
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;

    const sessionTimeout = new Promise<{ data: { session: null }; error: null }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null }, error: null }), 5000)
    );

    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then((result) => {
        if (mounted) {
          setSession(result?.data?.session ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setSession(null);
          setLoading(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);

      if (event === 'SIGNED_IN') {
        void activateInvitation(nextSession);
      }

      if (event === 'SIGNED_OUT') {
        void router.replace('/login').then(() => router.refresh());
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router, activateInvitation]);

  useEffect(() => {
    if (!loading && session) {
      void activateInvitation(session);
    }
  }, [loading, session, activateInvitation]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
