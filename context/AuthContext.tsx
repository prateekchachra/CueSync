import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';

import { DARZINI, DEMO_SUPERVISOR } from '@/constants/theme';
import { seedDarziniCatalog, seedSupervisorBriefs } from '@/lib/seed';
import { supabase } from '@/lib/supabase';
import type { Profile, Role } from '@/lib/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string, role: Role) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: Role) => Promise<'session' | 'confirm'>;
  signInAsDemo: (role: Role) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function ensureProfile(userId: string, name: string, email: string | null | undefined, role: Role) {
  const existing = await loadProfile(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, artist_name: name, email: email ?? null, role })
    .select()
    .single();
  if (error) {
    const retry = await loadProfile(userId);
    if (retry) return retry;
    throw error;
  }
  return data as Profile;
}

function metaFor(session: Session) {
  const meta = session.user.user_metadata ?? {};
  return {
    name: (meta.artist_name as string) || session.user.email?.split('@')[0] || 'Member',
    role: (meta.role === 'supervisor' ? 'supervisor' : 'musician') as Role,
  };
}

const roleWord = (role: Role) => (role === 'supervisor' ? 'a supervisor' : 'a musician');

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // While a sign-in is validating the role (and seeding demo data) we hold back the profile,
  // so the router keeps the login screen mounted and can show errors.
  const gate = useRef(false);
  const mounted = useRef(true);

  const hydrate = useCallback(async (next: Session | null) => {
    if (!next?.user.id) {
      if (mounted.current) setProfile(null);
      return;
    }
    const { name, role } = metaFor(next);
    try {
      const row = await ensureProfile(next.user.id, name, next.user.email, role);
      if (mounted.current) setProfile(row);
    } catch {
      if (mounted.current) setProfile(null);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted.current) return;
      setSession(data.session ?? null);
      await hydrate(data.session ?? null);
      if (mounted.current) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setProfile(null);
      else if (!gate.current) hydrate(next);
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, [hydrate]);

  const guarded = useCallback(
    async (work: () => Promise<void>) => {
      gate.current = true;
      try {
        await work();
      } finally {
        gate.current = false;
        const { data } = await supabase.auth.getSession();
        await hydrate(data.session ?? null);
      }
    },
    [hydrate]
  );

  const value = useMemo<AuthContextValue>(() => {
    async function assertRole(expected: Role) {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const row = await loadProfile(user.id);
      const actual = row?.role ?? (user.user_metadata?.role === 'supervisor' ? 'supervisor' : 'musician');
      if (actual !== expected) {
        await supabase.auth.signOut();
        throw new Error(
          `This account is registered as ${roleWord(actual)}. Switch to "For ${actual}s" above and log in again.`
        );
      }
    }

    return {
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      signIn: (email, password, role) =>
        guarded(async () => {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          await assertRole(role);
        }),
      signUp: async (email, password, name, role) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { artist_name: name, role } },
        });
        if (error) throw error;
        return data.session ? 'session' : 'confirm';
      },
      signInAsDemo: (role) =>
        guarded(async () => {
        const demo =
          role === 'supervisor'
            ? { email: DEMO_SUPERVISOR.email, password: DEMO_SUPERVISOR.password, name: DEMO_SUPERVISOR.name }
            : { email: DARZINI.email, password: DARZINI.password, name: DARZINI.artistName };

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: demo.email,
          password: demo.password,
        });

        if (signInError) {
          const { data, error } = await supabase.auth.signUp({
            email: demo.email,
            password: demo.password,
            options: { data: { artist_name: demo.name, role } },
          });
          if (error) throw error;
          if (!data.session) {
            throw new Error(
              'Demo account created but email confirmation is on. Turn off "Confirm email" in Supabase Auth settings, then try again.'
            );
          }
        }

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user?.id) return;
        await ensureProfile(user.id, demo.name, user.email, role);
        await assertRole(role);
        if (role === 'supervisor') await seedSupervisorBriefs(user.id);
        else await seedDarziniCatalog(user.id);
        }),
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    };
  }, [session, profile, loading, guarded]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
