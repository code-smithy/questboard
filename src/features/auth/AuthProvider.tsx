import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { AuthContext } from './AuthContext';
import type { AuthState } from './AuthContext';
import type { Profile } from './types';
import { upsertProfileForUser } from './profileSync';
import { getOAuthCodeFromLocation, getOAuthTokenSessionFromLocation, hasOAuthCallbackParams } from './oauthError';

function cleanOAuthCallbackUrl() {
  if (!hasOAuthCallbackParams()) return;

  window.history.replaceState(window.history.state, document.title, `${window.location.pathname}#/auth/callback`);
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
      setProfile(await upsertProfileForUser(supabase, user));
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
        const oauthCode = getOAuthCodeFromLocation();
        let didHandleOAuthCallback = false;

        if (oauthCode) {
          await supabase.auth.exchangeCodeForSession(oauthCode);
          didHandleOAuthCallback = true;
        } else {
          const tokenSession = getOAuthTokenSessionFromLocation();
          if (tokenSession) {
            await supabase.auth.setSession({
              access_token: tokenSession.accessToken,
              refresh_token: tokenSession.refreshToken,
            });
            didHandleOAuthCallback = true;
          }
        }

        if (didHandleOAuthCallback) {
          cleanOAuthCallbackUrl();
        }

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(currentSession);

        if (currentSession?.user) {
          try {
            setProfile(await upsertProfileForUser(supabase, currentSession.user));
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
        void upsertProfileForUser(supabase, nextSession.user)
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
