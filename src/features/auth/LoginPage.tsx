import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export function LoginPage() {
  const signInWithDiscord = async () => {
    if (!isSupabaseConfigured) return;

    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">Authentication</p>
      <h2>Log in with Discord</h2>
      <p>Connect your Discord identity so Questboard can sync your display name and avatar.</p>
      <button type="button" onClick={signInWithDiscord} disabled={!isSupabaseConfigured}>
        Login with Discord
      </button>
      {!isSupabaseConfigured && <p className="hint">Add Supabase values to your environment to enable login.</p>}
    </section>
  );
}
