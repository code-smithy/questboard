import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { AuthContext } from './AuthContext';
import type { AuthState } from './AuthContext';
import type { Profile } from './types';

function getDisplayName(user: User) {
  return (
    user.user_metadata.full_name ||
    user.user_metadata.name ||
    user.user_metadata.preferred_username ||
    user.email ||
    'New adventurer'
  );
}

async function upsertProfile(user: User) {
  const profilePayload = {
    id: user.id,
    discord_user_id: user.user_metadata.provider_id ?? null,
    display_name: getDisplayName(user),
    avatar_url: user.user_metadata.avatar_url ?? null,
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = async () => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setProfile(null);
      return;
    }

    try {
      setProfile(await upsertProfile(user));
    } catch (error) {
      console.error('Questboard could not sync the signed-in profile', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(currentSession);

        if (currentSession?.user) {
          try {
            setProfile(await upsertProfile(currentSession.user));
          } catch (error) {
            console.error('Questboard could not sync the signed-in profile', error);
            setProfile(null);
          }
        }
      } catch (error) {
        console.error('Questboard could not load the auth session', error);
        if (isMounted) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (nextSession?.user) {
        void upsertProfile(nextSession.user)
          .then(setProfile)
          .catch((error) => {
            console.error('Questboard could not sync the signed-in profile', error);
            setProfile(null);
          });
      } else {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile,
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
      },
    }),
    [isLoading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
