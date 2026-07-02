import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getAuthRedirectUrl } from './authRedirect';
import { getInvalidDiscordClientIdMessage } from './discordOAuth';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const location = useLocation();
  const { isConfigured, isLoading, user } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? '/calendar';

  const signInWithDiscord = async () => {
    if (isSigningIn) return;

    if (!isConfigured) {
      setAuthError('Discord login is not configured yet. Add Supabase URL and anon key environment values, then rebuild the app.');
      return;
    }

    setIsSigningIn(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: getAuthRedirectUrl(),
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setAuthError(error.message || 'Discord login could not be started. Please try again.');
        setIsSigningIn(false);
        return;
      }

      if (!data.url) {
        setAuthError('Discord login did not return a redirect URL. Please check the Supabase Discord provider setup.');
        setIsSigningIn(false);
        return;
      }

      const invalidDiscordClientIdMessage = getInvalidDiscordClientIdMessage(data.url);
      if (invalidDiscordClientIdMessage) {
        setAuthError(invalidDiscordClientIdMessage);
        setIsSigningIn(false);
        return;
      }

      window.location.assign(data.url);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Discord login could not be started. Please try again.');
      setIsSigningIn(false);
    }
  };

  if (!isLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">Authentication</p>
      <h2>Log in with Discord</h2>
      <p>Connect your Discord identity so Questboard can sync your display name and avatar.</p>
      <button type="button" onClick={signInWithDiscord} disabled={isSigningIn}>
        {isSigningIn ? 'Opening Discord…' : 'Login with Discord'}
      </button>
      {authError && <p className="hint" role="alert">{authError}</p>}
      {!isConfigured && (
        <p className="hint">Add Supabase values to your environment or GitHub Actions variables to enable login.</p>
      )}
    </section>
  );
}
