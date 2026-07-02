import { Navigate } from 'react-router-dom';
import { AuthCallbackPage } from './AuthCallbackPage';
import { hasOAuthCallbackParams } from './oauthError';

export function AuthIndexRoute() {
  if (hasOAuthCallbackParams()) {
    return <AuthCallbackPage />;
  }

  return <Navigate to="/calendar" replace />;
}
