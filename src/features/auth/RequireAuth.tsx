import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function RequireAuth() {
  const location = useLocation();
  const { isConfigured, isLoading, user } = useAuth();

  if (!isConfigured) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isLoading) {
    return (
      <section className="panel">
        <p className="eyebrow">Loading</p>
        <h2>Checking your adventurer papers…</h2>
        <p>Questboard is confirming your Discord session.</p>
      </section>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
