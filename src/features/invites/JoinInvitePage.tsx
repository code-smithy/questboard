import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { acceptGroupInvite } from '../groups/groupApi';
import { useLanguage } from '../i18n/LanguageContext';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function JoinInvitePage() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const { isConfigured, isLoading, user } = useAuth();
  const { t } = useLanguage();
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAcceptInvite = async () => {
    if (!inviteToken || isAccepting) return;

    setIsAccepting(true);
    setErrorMessage(null);

    try {
      await acceptGroupInvite(inviteToken);
      navigate('/groups', { replace: true, state: { inviteAccepted: true } });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('invite.acceptError')));
    } finally {
      setIsAccepting(false);
    }
  };

  if (!inviteToken) {
    return <Navigate to="/groups" replace />;
  }

  if (!isConfigured) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">{t('invite.eyebrow')}</p>
        <h2>{t('invite.setupTitle')}</h2>
        <p>{t('invite.setupBody')}</p>
        <Link className="login-link" to="/login">
          {t('invite.goLogin')}
        </Link>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">{t('invite.eyebrow')}</p>
        <h2>{t('invite.checkingTitle')}</h2>
        <p>{t('invite.checkingBody')}</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">{t('invite.eyebrow')}</p>
        <h2>{t('invite.loginTitle')}</h2>
        <p>{t('invite.loginBody')}</p>
        <Link className="login-link" to="/login" state={{ from: { pathname: `/join/${inviteToken}` } }}>
          {t('invite.loginButton')}
        </Link>
      </section>
    );
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">{t('invite.eyebrow')}</p>
      <h2>{t('invite.joinTitle')}</h2>
      <p>{t('invite.joinBody')}</p>
      <p className="hint">{t('invite.token', { token: inviteToken })}</p>
      <button type="button" onClick={handleAcceptInvite} disabled={isAccepting}>
        {isAccepting ? t('invite.joining') : t('invite.joinButton')}
      </button>
      {errorMessage && (
        <p className="error-text" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
