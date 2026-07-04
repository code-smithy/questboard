import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AuthCallbackPage } from './AuthCallbackPage';
import { hasOAuthCallbackParams } from './oauthError';

export function AuthIndexRoute() {
  const { isLoading, user } = useAuth();

  if (hasOAuthCallbackParams()) {
    return <AuthCallbackPage />;
  }

  if (isLoading) {
    return (
      <section className="panel hero-panel">
        <p className="hint">Loading Questboard...</p>
      </section>
    );
  }

  return <Navigate to={user ? '/calendar' : '/public'} replace />;
}
