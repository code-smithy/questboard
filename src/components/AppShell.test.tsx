import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../features/auth/AuthContext';
import type { AuthState } from '../features/auth/AuthContext';
import { AppShell } from './AppShell';

const baseAuthState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: null,
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

function renderShell(authState: Partial<AuthState>) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <MemoryRouter initialEntries={['/calendar']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/calendar" element={<h2>Calendar child</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('AppShell', () => {
  it('renders navigation and child routes', () => {
    renderShell({ user: null });

    expect(screen.getByRole('heading', { name: 'Questboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Calendar child' })).toBeInTheDocument();
  });

  it('shows the synced profile name and signs out authenticated users', () => {
    const signOut = vi.fn();
    renderShell({
      user: { id: 'user-1', email: 'user@example.com' } as AuthState['user'],
      profile: {
        id: 'user-1',
        discord_user_id: 'discord-1',
        display_name: 'Aventurine',
        avatar_url: null,
        created_at: new Date().toISOString(),
        last_seen_at: null,
        is_site_admin: false,
      },
      signOut,
    });

    expect(screen.getByText('Aventurine')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
