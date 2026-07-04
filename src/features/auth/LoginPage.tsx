import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from './AuthContext';
import { getAuthRedirectUrl } from './authRedirect';
import { saveAuthReturnTo } from './authReturnTo';
import { getInvalidDiscordClientIdMessage } from './discordOAuth';

export function LoginPage() {
  const location = useLocation();
  const { isConfigured, isLoading, user } = useAuth();
  const { t } = useLanguage();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const redirectTo = (location.state as { from?: Location } | null)?.from?.pathname ?? '/calendar';

  const signInWithDiscord = async () => {
    if (isSigningIn) return;

    if (!isConfigured) {
      setAuthError(t('auth.login.notConfigured'));
      return;
    }

    setIsSigningIn(true);
    setAuthError(null);

    try {
      saveAuthReturnTo(redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: getAuthRedirectUrl(),
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        setAuthError(error.message || t('auth.login.failed'));
        setIsSigningIn(false);
        return;
      }

      if (!data.url) {
        setAuthError(t('auth.login.noRedirect'));
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
      setAuthError(error instanceof Error ? error.message : t('auth.login.failed'));
      setIsSigningIn(false);
    }
  };

  if (!isLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">{t('auth.eyebrow')}</p>
      <h2>{t('auth.login.title')}</h2>
      <p>{t('auth.login.description')}</p>
      <button type="button" onClick={signInWithDiscord} disabled={isSigningIn}>
        {isSigningIn ? t('auth.login.opening') : t('auth.login.button')}
      </button>
      {authError && <p className="hint" role="alert">{authError}</p>}
      {!isConfigured && (
        <p className="hint">{t('auth.login.configureHint')}</p>
      )}
    </section>
  );
}
