import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { ReminderContext } from '../reminders/ReminderContext';
import { ProfilePage } from './ProfilePage';
import {
  disableOwnCalendarFeed,
  ensureOwnCalendarFeed,
  getOwnCalendarFeed,
  updateOwnProfileDefaultEventDuration,
  updateOwnProfileDisplayName,
  updateOwnProfileTimezone,
} from './profileApi';

vi.mock('./profileApi', () => ({
  disableOwnCalendarFeed: vi.fn(),
  ensureOwnCalendarFeed: vi.fn(),
  getCalendarFeedUrl: (token: string) => `http://localhost:54321/functions/v1/calendar-feed?token=${token}`,
  getOwnCalendarFeed: vi.fn(),
  regenerateOwnCalendarFeed: vi.fn(),
  updateOwnProfileDefaultEventDuration: vi.fn(),
  updateOwnProfileDisplayName: vi.fn(),
  updateOwnProfileTimezone: vi.fn(),
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
    default_event_duration_hours: 4,
    timezone: 'Europe/London',
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOwnCalendarFeed).mockResolvedValue(null);
  });

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

  it('saves the default quest duration setting', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    vi.mocked(updateOwnProfileDefaultEventDuration).mockResolvedValue({
      ...baseAuthState.profile!,
      default_event_duration_hours: 2.5,
    });

    renderProfilePage({ refreshProfile });

    const durationInput = screen.getByLabelText('Default quest duration (hours)');

    expect(durationInput).toHaveValue(4);

    fireEvent.change(durationInput, { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save default duration' }));

    await waitFor(() => expect(updateOwnProfileDefaultEventDuration).toHaveBeenCalledWith('user-1', 2.5));
    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Default duration saved.')).toBeInTheDocument();
  });

  it('saves the personal timezone setting', async () => {
    const refreshProfile = vi.fn().mockResolvedValue(undefined);
    vi.mocked(updateOwnProfileTimezone).mockResolvedValue({
      ...baseAuthState.profile!,
      timezone: 'Europe/Zurich',
    });

    renderProfilePage({ refreshProfile });

    const timezoneSelect = screen.getByLabelText('Personal timezone');

    expect(timezoneSelect).toHaveValue('Europe/London');

    fireEvent.change(timezoneSelect, { target: { value: 'Europe/Zurich' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save timezone' }));

    await waitFor(() => expect(updateOwnProfileTimezone).toHaveBeenCalledWith('user-1', 'Europe/Zurich'));
    expect(refreshProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Timezone saved.')).toBeInTheDocument();
  });

  it('creates a private calendar subscription feed from profile settings', async () => {
    vi.mocked(ensureOwnCalendarFeed).mockResolvedValue({
      id: 'feed-1',
      owner_id: 'user-1',
      token: 'feed-token',
      scope: 'rsvp',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_accessed_at: null,
    });

    renderProfilePage();

    expect(await screen.findByLabelText('Calendar subscription')).toHaveValue('rsvp');

    fireEvent.click(screen.getByRole('button', { name: 'Create subscription link' }));

    await waitFor(() => expect(ensureOwnCalendarFeed).toHaveBeenCalledWith('rsvp'));
    expect(await screen.findByLabelText('Private .ics URL')).toHaveValue('http://localhost:54321/functions/v1/calendar-feed?token=feed-token');
    expect(await screen.findByText('Calendar subscription saved.')).toBeInTheDocument();
  });

  it('revokes an existing calendar subscription feed', async () => {
    vi.mocked(getOwnCalendarFeed).mockResolvedValue({
      id: 'feed-1',
      owner_id: 'user-1',
      token: 'feed-token',
      scope: 'visible',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_accessed_at: null,
    });
    vi.mocked(disableOwnCalendarFeed).mockResolvedValue(undefined);

    renderProfilePage();

    expect(await screen.findByLabelText('Private .ics URL')).toHaveValue('http://localhost:54321/functions/v1/calendar-feed?token=feed-token');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke subscription' }));

    await waitFor(() => expect(disableOwnCalendarFeed).toHaveBeenCalled());
    expect(screen.queryByLabelText('Private .ics URL')).not.toBeInTheDocument();
    expect(await screen.findByText('Calendar subscription revoked.')).toBeInTheDocument();
  });
});
