import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../features/auth/AuthContext';
import type { AuthState } from '../features/auth/AuthContext';
import type { DueReminder } from '../features/events/eventApi';
import { ReminderContext } from '../features/reminders/ReminderContext';
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

function renderShell(authState: Partial<AuthState>, reminders: DueReminder[] = []) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <ReminderContext.Provider
        value={{
          browserNotificationsEnabled: false,
          dueReminders: reminders,
          dismissReminder: async () => undefined,
          notificationPermission: 'unsupported',
          refreshDueReminders: async () => undefined,
          setBrowserNotificationsEnabled: async () => undefined,
        }}
      >
        <MemoryRouter initialEntries={['/calendar']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/calendar" element={<h2>Calendar child</h2>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ReminderContext.Provider>
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
        synced_display_name: 'Discord Aventurine',
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

  it('shows the due reminder count on the user avatar', () => {
    renderShell({
      user: { id: 'user-1', email: 'user@example.com' } as AuthState['user'],
      profile: {
        id: 'user-1',
        discord_user_id: 'discord-1',
        display_name: 'Aventurine',
        synced_display_name: 'Discord Aventurine',
        avatar_url: 'https://cdn.example/avatar.png',
        created_at: new Date().toISOString(),
        last_seen_at: null,
        is_site_admin: false,
      },
    }, [
      {
        id: 'reminder-1',
        event_id: 'event-1',
        user_id: 'user-1',
        remind_at: '2026-07-10T17:00:00Z',
        method: 'in_app',
        is_sent: false,
        created_at: '2026-07-09T12:00:00Z',
        events: null,
      },
    ]);

    expect(screen.getByLabelText('1 due reminder(s)')).toHaveTextContent('1');
  });
});
