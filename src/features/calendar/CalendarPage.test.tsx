import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import type { DueReminder } from '../events/eventApi';
import { ReminderContext } from '../reminders/ReminderContext';
import { CalendarPage } from './CalendarPage';

const { getCalendarReadModel } = vi.hoisted(() => ({
  getCalendarReadModel: vi.fn(),
}));

const { dismissInAppReminder, recordEventHistory, setEventRsvp } = vi.hoisted(() => ({
  dismissInAppReminder: vi.fn(),
  recordEventHistory: vi.fn(),
  setEventRsvp: vi.fn(),
}));

vi.mock('./calendarApi', () => ({
  getCalendarReadModel,
}));

vi.mock('../events/eventApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../events/eventApi')>()),
  dismissInAppReminder,
  recordEventHistory,
  setEventRsvp,
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

const readModel = {
  groups: [
    { id: 'group-1', name: 'Friday Guild', role: 'group_admin' },
    { id: 'group-2', name: 'Painting Crew', role: 'regular' },
  ],
  events: [
    {
      id: 'event-1',
      group_id: 'group-1',
      title: 'Board game night',
      description: null,
      start_at: '2026-07-10T18:00:00Z',
      end_at: '2026-07-10T21:00:00Z',
      timezone: 'UTC',
      mode: 'offline',
      minimum_attendees: 3,
      maximum_attendees: 5,
      visibility: 'private',
      status: 'open',
      category: { id: 'category-1', name: 'Board Games', color: '#f0b35a', icon: null },
      rsvps: [{ user_id: 'user-1', status: 'attending' }, { user_id: 'user-2', status: 'maybe' }],
    },
    {
      id: 'event-2',
      group_id: 'group-2',
      title: 'Mini painting hangout',
      description: null,
      start_at: '2026-08-02T19:00:00Z',
      end_at: '2026-08-02T21:00:00Z',
      timezone: 'UTC',
      mode: 'online',
      minimum_attendees: 1,
      maximum_attendees: null,
      visibility: 'public',
      status: 'confirmed',
      category: { id: 'category-2', name: 'Mini Painting', color: '#77ddaa', icon: null },
      rsvps: [{ user_id: 'user-2', status: 'attending' }],
    },
  ],
};

function TestReminderProvider({ children, initialReminders = [] }: { children: ReactNode; initialReminders?: DueReminder[] }) {
  const [dueReminders, setDueReminders] = useState(initialReminders);

  return (
    <ReminderContext.Provider
      value={{
        browserNotificationsEnabled: false,
        dueReminders,
        dismissReminder: async (reminderId) => {
          await dismissInAppReminder(reminderId);
          setDueReminders((currentReminders) => currentReminders.filter((reminder) => reminder.id !== reminderId));
        },
        notificationPermission: 'unsupported',
        refreshDueReminders: async () => undefined,
        setBrowserNotificationsEnabled: async () => undefined,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
}

function renderCalendar(authState: Partial<AuthState> = {}, reminders: DueReminder[] = []) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <TestReminderProvider initialReminders={reminders}>
        <MemoryRouter initialEntries={['/calendar']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/events/:eventId" element={<h1>Event detail route</h1>} />
          </Routes>
        </MemoryRouter>
      </TestReminderProvider>
    </AuthContext.Provider>,
  );
}

describe('CalendarPage', () => {
  beforeEach(() => {
    dismissInAppReminder.mockReset();
    getCalendarReadModel.mockReset();
    recordEventHistory.mockReset();
    setEventRsvp.mockReset();
    dismissInAppReminder.mockResolvedValue(undefined);
    getCalendarReadModel.mockResolvedValue(readModel);
    recordEventHistory.mockResolvedValue(undefined);
    setEventRsvp.mockResolvedValue(undefined);
  });

  it('renders grouped agenda events from the calendar read model', async () => {
    renderCalendar();

    expect(await screen.findByRole('heading', { name: 'July 2026' })).toBeInTheDocument();
    expect(screen.getByText('Board game night')).toBeInTheDocument();
    expect(screen.getByText(/Needs 2 more/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    expect(screen.getByText('Mini painting hangout')).toBeInTheDocument();
    expect(getCalendarReadModel).toHaveBeenCalledWith('user-1');
  });

  it('shows a navigable month calendar view with compact quest links', async () => {
    renderCalendar();

    await screen.findByText('Board game night');
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));

    expect(screen.getByRole('grid', { name: 'July 2026' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Mon' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /18:00 Board game night/i })).toHaveAttribute('href', '/events/event-1');
    expect(screen.queryByText('Mini painting hangout')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

    expect(screen.getByRole('grid', { name: 'August 2026' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /19:00 Mini painting hangout/i })).toHaveAttribute('href', '/events/event-2');

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('grid', { name: 'July 2026' })).toBeInTheDocument();
  });

  it('marks agenda cards with status and category colors', async () => {
    renderCalendar();

    const confirmedTitle = await screen.findByText('Mini painting hangout');
    const confirmedCard = confirmedTitle.closest('article');

    expect(confirmedCard).not.toBeNull();
    expect(confirmedCard).toHaveAttribute('data-status', 'confirmed');
    expect(confirmedCard).toHaveStyle('--event-category-color: #77ddaa');
    expect(within(confirmedCard as HTMLElement).getByText('Confirmed')).toBeInTheDocument();
    expect(within(confirmedCard as HTMLElement).getByText('Mini Painting')).toBeInTheDocument();
  });

  it('filters events by guild, category, and mode', async () => {
    renderCalendar();

    await screen.findByText('Board game night');
    fireEvent.change(screen.getByLabelText(/guild/i), { target: { value: 'group-2' } });
    expect(screen.queryByText('Board game night')).not.toBeInTheDocument();
    expect(screen.getByText('Mini painting hangout')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Board Games' } });
    expect(screen.getByText(/No events match these filters/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'Mini Painting' } });
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'online' } });
    expect(screen.getByText('Mini painting hangout')).toBeInTheDocument();
  });

  it('links agenda cards to event details', async () => {
    renderCalendar();

    const eventLink = await screen.findByRole('link', { name: /board game night/i });
    expect(eventLink).toHaveAttribute('href', '/events/event-1');
    expect(within(eventLink).getByText('Board Games')).toBeInTheDocument();
    expect(within(eventLink).getByText(/Offline - private/i)).toBeInTheDocument();
  });

  it('lets users update their RSVP from the calendar overview', async () => {
    renderCalendar();

    const eventTitle = await screen.findByText('Board game night');
    const eventCard = eventTitle.closest('article');
    expect(eventCard).not.toBeNull();
    expect(within(eventCard as HTMLElement).getByRole('button', { name: 'Attending' })).toHaveClass('is-selected');

    fireEvent.click(within(eventCard as HTMLElement).getByRole('button', { name: 'Maybe' }));

    await waitFor(() => {
      expect(setEventRsvp).toHaveBeenCalledWith('event-1', 'user-1', 'maybe');
    });
    expect(recordEventHistory).toHaveBeenCalledWith({
      eventId: 'event-1',
      changedBy: 'user-1',
      changeType: 'rsvp_updated',
      oldValue: { status: 'attending' },
      newValue: { status: 'maybe' },
    });
    expect(within(eventCard as HTMLElement).getByRole('button', { name: 'Maybe' })).toHaveClass('is-selected');
    expect(screen.getByText(/Needs 3 more/i)).toBeInTheDocument();
  });

  it('shows and dismisses due in-app reminders', async () => {
    const reminders: DueReminder[] = [
      {
        id: 'reminder-1',
        event_id: 'event-1',
        user_id: 'user-1',
        remind_at: '2026-07-10T17:00:00Z',
        method: 'in_app',
        is_sent: false,
        created_at: '2026-07-09T12:00:00Z',
        events: {
          id: 'event-1',
          title: 'Board game night',
          start_at: '2026-07-10T18:00:00Z',
          timezone: 'UTC',
        },
      },
    ];

    renderCalendar({}, reminders);

    expect(await screen.findByRole('heading', { name: 'Due now' })).toBeInTheDocument();
    expect(screen.getAllByText('Board game night')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => {
      expect(dismissInAppReminder).toHaveBeenCalledWith('reminder-1');
    });
    expect(screen.queryByRole('heading', { name: 'Due now' })).not.toBeInTheDocument();
  });
});
