import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from './AuthContext';
import type { AuthState } from './AuthContext';
import { LoginPage } from './LoginPage';

const { assign, signInWithOAuth } = vi.hoisted(() => ({
  assign: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.stubGlobal('location', { ...window.location, assign });

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithOAuth,
    },
  },
}));

const baseAuthState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: null,
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

function renderLogin(authState: Partial<AuthState> = {}) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/calendar" element={<h1>Calendar route</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    assign.mockReset();
    signInWithOAuth.mockReset();
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://discord.example/oauth' }, error: null });
  });

  it('starts Discord OAuth through Supabase when the button is clicked', async () => {
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /login with discord/i }));

    await waitFor(() => {
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'discord',
        options: {
          redirectTo: expect.any(String),
          skipBrowserRedirect: true,
        },
      });
    });
    expect(assign).toHaveBeenCalledWith('https://discord.example/oauth');
  });

  it('keeps the login button responsive when Supabase is not configured', async () => {
    renderLogin({ isConfigured: false });

    fireEvent.click(screen.getByRole('button', { name: /login with discord/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/discord login is not configured/i);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it('redirects signed-in users away from the login page', () => {
    renderLogin({ user: { id: 'user-1' } as AuthState['user'] });

    expect(screen.getByRole('heading', { name: 'Calendar route' })).toBeInTheDocument();
  });
});
