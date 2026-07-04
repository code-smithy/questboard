import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { ReminderContext } from '../reminders/ReminderContext';
import { ProfilePage } from './ProfilePage';
import { updateOwnProfileDisplayName } from './profileApi';

vi.mock('./profileApi', () => ({
  updateOwnProfileDisplayName: vi.fn(),
}));

const baseAuthState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: { id: 'user-1', email: 'user@example.com' } as AuthState['user'],
  profile: {
    id: 'user-1',
    discord_user_id: 'discord-1',
    display_name: 'Table Name',
    synced_display_name: 'Discord Name',
    avatar_url: null,
    created_at: '2026-01-01T00:00:00Z',
    last_seen_at: null,
    is_site_admin: false,
  },
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

function renderProfilePage(authState: Partial<AuthState> = {}) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <ReminderContext.Provider
        value={{
          browserNotificationsEnabled: false,
          dueReminders: [],
          dismissReminder: async () => undefined,
          notificationPermission: 'unsupported',
          refreshDueReminders: async () => undefined,
          setBrowserNotificationsEnabled: async () => undefined,
        }}
      >
        <ProfilePage />
      </ReminderContext.Provider>
    </AuthContext.Provider>,
  );
}

describe('ProfilePage', () => {
  it('edits the shown display name while keeping the synced Discord name read-only', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    vi.mocked(updateOwnProfileDisplayName).mockResolvedValue({
      ...baseAuthState.profile!,
      display_name: 'Guild Name',
    });

    renderProfilePage({ refreshProfile });

    const displayNameInput = screen.getByLabelText('Display name');
    const syncedNameInput = screen.getByLabelText('Synced Discord name');

    expect(displayNameInput).toHaveValue('Table Name');
    expect(syncedNameInput).toHaveValue('Discord Name');
    expect(syncedNameInput).toHaveAttribute('readonly');

    fireEvent.change(displayNameInput, { target: { value: '  Guild Name  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save display name' }));

    await waitFor(() => expect(updateOwnProfileDisplayName).toHaveBeenCalledWith('user-1', 'Guild Name'));
    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Display name saved.')).toBeInTheDocument();
  });
});
