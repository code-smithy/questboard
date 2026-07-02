import { Navigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getAuthRedirectUrl } from './authRedirect';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const location = useLocation();
  const { isLoading, user } = useAuth();
  const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? '/calendar';

  const signInWithDiscord = async () => {
    if (!isSupabaseConfigured) return;

    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: getAuthRedirectUrl(),
      },
    });
  };

  if (!isLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">Authentication</p>
      <h2>Log in with Discord</h2>
      <p>Connect your Discord identity so Questboard can sync your display name and avatar.</p>
      <button type="button" onClick={signInWithDiscord} disabled={!isSupabaseConfigured}>
        Login with Discord
      </button>
      {!isSupabaseConfigured && (
        <p className="hint">Add Supabase values to your environment or GitHub Actions variables to enable login.</p>
      )}
    </section>
  );
}
