import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getAuthRedirectUrl } from './authRedirect';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const location = useLocation();
  const { isLoading, user } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? '/calendar';

  const signInWithDiscord = async () => {
    if (!isSupabaseConfigured || isSigningIn) return;

    setIsSigningIn(true);
    setAuthError(null);

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

    window.location.assign(data.url);
  };

  if (!isLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">Authentication</p>
      <h2>Log in with Discord</h2>
      <p>Connect your Discord identity so Questboard can sync your display name and avatar.</p>
      <button type="button" onClick={signInWithDiscord} disabled={!isSupabaseConfigured || isSigningIn}>
        {isSigningIn ? 'Opening Discord…' : 'Login with Discord'}
      </button>
      {authError && <p className="hint" role="alert">{authError}</p>}
      {!isSupabaseConfigured && (
        <p className="hint">Add Supabase values to your environment or GitHub Actions variables to enable login.</p>
      )}
    </section>
  );
}
