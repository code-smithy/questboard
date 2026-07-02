import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from './AuthContext';
import type { AuthState } from './AuthContext';
import { RequireAuth } from './RequireAuth';

const baseAuthState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: null,
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

function renderProtected(authState: Partial<AuthState>) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <MemoryRouter initialEntries={['/calendar']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/calendar" element={<h1>Calendar content</h1>} />
          </Route>
          <Route path="/login" element={<h1>Login page</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RequireAuth', () => {
  it('renders protected content for signed-in users', () => {
    renderProtected({ user: { id: 'user-1' } as AuthState['user'] });

    expect(screen.getByRole('heading', { name: 'Calendar content' })).toBeInTheDocument();
  });

  it('redirects signed-out users to login', () => {
    renderProtected({ user: null });

    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it('redirects to login when Supabase is not configured', () => {
    renderProtected({ isConfigured: false });

    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument();
  });

  it('shows a loading state while the session is being checked', () => {
    renderProtected({ isLoading: true });

    expect(screen.getByText(/Checking your adventurer papers/i)).toBeInTheDocument();
  });
});
