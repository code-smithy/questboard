import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from './AuthContext';
import { consumeAuthReturnTo } from './authReturnTo';
import { getOAuthErrorFromLocation } from './oauthError';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isLoading, user } = useAuth();
  const { t } = useLanguage();
  const oauthError = getOAuthErrorFromLocation();

  useEffect(() => {
    if (!isLoading && user) {
      navigate(consumeAuthReturnTo() ?? '/calendar', { replace: true });
    }
  }, [isLoading, navigate, user]);

  if (oauthError) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">{t('auth.eyebrow')}</p>
        <h2>{t('auth.callback.failedTitle')}</h2>
        <p role="alert">{oauthError.description}</p>
        {oauthError.code && <p className="hint">{t('auth.callback.errorCode', { code: oauthError.code })}</p>}
        <p className="hint">{t('auth.callback.providerHint')}</p>
        <Link className="login-link" to="/login">{t('auth.callback.back')}</Link>
      </section>
    );
  }

  if (!isLoading && !user) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">{t('auth.eyebrow')}</p>
        <h2>{t('auth.callback.incompleteTitle')}</h2>
        <p role="alert">{t('auth.callback.incompleteBody')}</p>
        <p className="hint">{t('auth.callback.incompleteHint')}</p>
        <Link className="login-link" to="/login">{t('auth.callback.back')}</Link>
      </section>
    );
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">{t('auth.eyebrow')}</p>
      <h2>{t('auth.callback.finishing')}</h2>
      <p>{t('auth.callback.finishingBody')}</p>
    </section>
  );
}
