import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isLoading, user } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      navigate('/calendar', { replace: true });
    }
  }, [isLoading, navigate, user]);

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">Authentication</p>
      <h2>Finishing login…</h2>
      <p>Questboard is finishing the Discord sign-in flow and preparing your profile.</p>
    </section>
  );
}
