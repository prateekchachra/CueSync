import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';

import { DARZINI } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { seedDarziniCatalogIfEmpty } from '@/lib/seed';
import type { Profile } from '@/lib/types';

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, artistName: string) => Promise<'session' | 'confirm'>;
  signInAsDarzini: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

async function ensureProfile(userId: string, artistName: string, email?: string | null) {
  const existing = await loadProfile(userId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, artist_name: artistName, email: email ?? null })
    .select()
    .single();
  if (error) {
    const retry = await loadProfile(userId);
    if (retry) return retry;
    throw error;
  }
  return data as Profile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      if (data.session?.user.id) {
        ensureProfile(
          data.session.user.id,
          (data.session.user.user_metadata?.artist_name as string) ||
            data.session.user.email?.split('@')[0] ||
            'Artist',
          data.session.user.email
        )
          .then((row) => mounted && setProfile(row))
          .finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next?.user.id) {
        setProfile(null);
        return;
      }
      ensureProfile(
        next.user.id,
        (next.user.user_metadata?.artist_name as string) || next.user.email?.split('@')[0] || 'Artist',
        next.user.email
      )
        .then(setProfile)
        .catch(() => setProfile(null));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (email, password, artistName) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { artist_name: artistName } },
        });
        if (error) throw error;
        return data.session ? 'session' : 'confirm';
      },
      signInAsDarzini: async () => {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: DARZINI.email,
          password: DARZINI.password,
        });

        if (signInError) {
          const { data, error } = await supabase.auth.signUp({
            email: DARZINI.email,
            password: DARZINI.password,
            options: { data: { artist_name: DARZINI.artistName } },
          });
          if (error) throw error;
          if (!data.session) {
            throw new Error(
              'Darzini was created but email confirmation is on. Turn off Confirm email in Supabase Auth settings, then try again.'
            );
          }
        }

        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (user?.id) {
          await ensureProfile(user.id, DARZINI.artistName, user.email);
          await seedDarziniCatalogIfEmpty(user.id);
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
