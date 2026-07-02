import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getOAuthErrorFromLocation } from './oauthError';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isLoading, user } = useAuth();
  const oauthError = getOAuthErrorFromLocation();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/calendar', { replace: true });
    }
  }, [isLoading, navigate, user]);

  if (oauthError) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">Authentication</p>
        <h2>Discord login could not be completed</h2>
        <p role="alert">{oauthError.description}</p>
        {oauthError.code && <p className="hint">Error code: {oauthError.code}</p>}
        <p className="hint">
          Check the Supabase Discord provider Client ID, Client Secret, and Auth URL Configuration, then try logging in again.
        </p>
        <Link className="login-link" to="/login">Back to login</Link>
      </section>
    );
  }

  if (!isLoading && !user) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">Authentication</p>
        <h2>Discord login did not complete</h2>
        <p role="alert">Questboard did not receive a signed-in Supabase session after Discord returned.</p>
        <p className="hint">
          Check the Supabase Discord provider credentials, redirect allow list, and profile table setup, then try logging in again.
        </p>
        <Link className="login-link" to="/login">Back to login</Link>
      </section>
    );
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">Authentication</p>
      <h2>Finishing login…</h2>
      <p>Questboard is finishing the Discord sign-in flow and preparing your profile.</p>
    </section>
  );
}
