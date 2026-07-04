import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './AuthContext';
import type { AuthState } from './AuthContext';
import { AuthCallbackPage } from './AuthCallbackPage';

const { consumeAuthReturnTo } = vi.hoisted(() => ({
  consumeAuthReturnTo: vi.fn(),
}));

vi.mock('./authReturnTo', () => ({
  consumeAuthReturnTo,
}));

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
      <MemoryRouter initialEntries={['/auth/callback']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/calendar" element={<h1>Calendar route</h1>} />
          <Route path="/join/invite-token" element={<h1>Join invite route</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    consumeAuthReturnTo.mockReset();
    consumeAuthReturnTo.mockReturnValue(null);
  });
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



  it('redirects signed-in users to the saved invite return path', async () => {
    consumeAuthReturnTo.mockReturnValue('/join/invite-token');
    renderCallback('/#/auth/callback', { user: { id: 'user-1' } as AuthState['user'] });

    expect(await screen.findByText(/join invite route/i)).toBeInTheDocument();
  });

  it('keeps the finishing state while auth is loading', () => {
    renderCallback('/#/auth/callback', { isLoading: true });

    expect(screen.getByRole('heading', { name: /finishing login/i })).toBeInTheDocument();
  });
});
