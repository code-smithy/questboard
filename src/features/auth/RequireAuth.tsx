import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const location = useLocation();
  const { isConfigured, isLoading, user } = useAuth();
  const { t } = useLanguage();

  if (!isConfigured) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isLoading) {
    return (
      <section className="panel">
        <p className="eyebrow">{t('auth.checkingEyebrow')}</p>
        <h2>{t('auth.checkingTitle')}</h2>
        <p>{t('auth.checkingBody')}</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
