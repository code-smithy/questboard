import { Navigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from './AuthContext';
import { AuthCallbackPage } from './AuthCallbackPage';
import { hasOAuthCallbackParams } from './oauthError';

export function AuthIndexRoute() {
  const { isLoading, user } = useAuth();
  const { t } = useLanguage();

  if (hasOAuthCallbackParams()) {
    return <AuthCallbackPage />;
  }

  if (isLoading) {
    return (
      <section className="panel hero-panel">
        <p className="hint">{t('auth.loading')}</p>
      </section>
    );
  }

  return <Navigate to={user ? '/calendar' : '/public'} replace />;
}
