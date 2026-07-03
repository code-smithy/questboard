import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { JoinInvitePage } from './JoinInvitePage';

const { acceptGroupInvite } = vi.hoisted(() => ({
  acceptGroupInvite: vi.fn(),
}));

vi.mock('../groups/groupApi', () => ({
  acceptGroupInvite,
}));

const baseAuthState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: { id: 'user-1', email: 'user@example.com' } as AuthState['user'],
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

function renderInvite(authState: Partial<AuthState> = {}) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <MemoryRouter initialEntries={['/join/invite-token']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/join/:inviteToken" element={<JoinInvitePage />} />
          <Route path="/groups" element={<h1>Your guilds</h1>} />
          <Route path="/login" element={<h1>Login page</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('JoinInvitePage', () => {
  beforeEach(() => {
    acceptGroupInvite.mockReset();
    acceptGroupInvite.mockResolvedValue('group-1');
  });

  it('accepts an invite and redirects to groups', async () => {
    renderInvite();

    fireEvent.click(screen.getByRole('button', { name: /join guild/i }));

    await waitFor(() => {
      expect(acceptGroupInvite).toHaveBeenCalledWith('invite-token');
    });
    expect(await screen.findByRole('heading', { name: 'Your guilds' })).toBeInTheDocument();
  });

  it('asks signed-out users to log in before joining', () => {
    renderInvite({ user: null });

    expect(screen.getByRole('heading', { name: /log in to join this guild/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /login with discord/i })).toHaveAttribute('href', '/login');
    expect(acceptGroupInvite).not.toHaveBeenCalled();
  });

  it('shows invite acceptance errors', async () => {
    acceptGroupInvite.mockRejectedValue(new Error('Invite is invalid, expired, inactive, or fully used.'));
    renderInvite();

    fireEvent.click(screen.getByRole('button', { name: /join guild/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invite is invalid/i);
  });
});
