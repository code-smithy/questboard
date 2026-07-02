import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from './AuthContext';
import type { AuthState } from './AuthContext';
import { AuthCallbackPage } from './AuthCallbackPage';

const authState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: null,
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

function renderCallback(url: string, authOverrides: Partial<AuthState> = {}) {
  window.history.pushState({}, '', url);

  return render(
    <AuthContext.Provider value={{ ...authState, ...authOverrides }}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthCallbackPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AuthCallbackPage', () => {
  it('shows OAuth errors returned to the app URL', () => {
    renderCallback('/?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+miAD#error=server_error');

    expect(screen.getByRole('heading', { name: /discord login could not be completed/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to exchange external code: miAD');
    expect(screen.getByText(/unexpected_failure/i)).toBeInTheDocument();
  });

  it('does not hang when Discord returns without a Supabase session', () => {
    renderCallback('/#/auth/callback');

    expect(screen.getByRole('heading', { name: /discord login did not complete/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/did not receive a signed-in Supabase session/i);
  });

  it('keeps the finishing state while auth is loading', () => {
    renderCallback('/#/auth/callback', { isLoading: true });

    expect(screen.getByRole('heading', { name: /finishing login/i })).toBeInTheDocument();
  });
});
