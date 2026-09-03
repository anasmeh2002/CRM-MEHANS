'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { MehansLogo } from '@/components/logo';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const redirectTo = searchParams.get('redirect') ?? '/';

  const validate = (): string | null => {
    if (mode === 'sign-up' && !name.trim()) return 'Please enter your full name';
    if (!email.trim()) return 'Please enter your email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
    if (!password) return 'Please enter your password';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}` },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      if (mode === 'sign-up') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success('Account created. You can sign in now.');
          setMode('sign-in');
          setPassword('');
        } else {
          router.replace(redirectTo);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(redirectTo);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to continue';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || googleLoading;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary bg-grid px-5 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-bg-secondary p-8 shadow-modal sm:p-10">
        <div className="mb-8 flex justify-center"><MehansLogo height={48} /></div>
        <div className="mb-8 text-center">
          <p className="eyebrow text-gold">MEHANS REAL ESTATE</p>
          <h1 className="mt-3 font-serif text-3xl font-medium text-text-primary">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="mt-2 text-sm text-text-muted">{mode === 'sign-in' ? 'Sign in to your workspace.' : 'Start managing your team in one place.'}</p>
        </div>
        <button type="button" onClick={signInWithGoogle} disabled={busy} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated py-3 text-sm font-medium text-text-primary transition-colors hover:border-gold-border disabled:opacity-60">
          {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base font-bold">G</span>}
          Continue with Google
        </button>
        <div className="mb-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-text-muted"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'sign-up' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-text-secondary">Full name</span>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3">
                <UserRound className="h-4 w-4 text-text-muted" />
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent py-3 text-sm text-text-primary outline-none" />
              </div>
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-secondary">Email</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3">
              <Mail className="h-4 w-4 text-text-muted" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-transparent py-3 text-sm text-text-primary outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-text-secondary">Password</span>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3">
              <LockKeyhole className="h-4 w-4 text-text-muted" />
              <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent py-3 text-sm text-text-primary outline-none" />
            </div>
          </label>
          <button disabled={busy} className="btn btn-gold btn-lg w-full justify-center">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{mode === 'sign-in' ? 'Sign in' : 'Create account'} <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>
        <button onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setPassword(''); }} className="mt-6 w-full text-center text-xs text-text-muted transition-colors hover:text-gold">
          {mode === 'sign-in' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main>
  );
}
