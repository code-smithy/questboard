import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { CalendarPage } from './CalendarPage';

const { getCalendarReadModel } = vi.hoisted(() => ({
  getCalendarReadModel: vi.fn(),
}));

vi.mock('./calendarApi', () => ({
  getCalendarReadModel,
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
      category: { id: 'category-1', name: 'Board Games', color: '#f0b35a', icon: '🎲' },
      rsvps: [{ status: 'attending' }, { status: 'maybe' }],
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
      category: { id: 'category-2', name: 'Mini Painting', color: '#77ddaa', icon: '🖌️' },
      rsvps: [{ status: 'attending' }],
    },
  ],
};

function renderCalendar(authState: Partial<AuthState> = {}) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <MemoryRouter initialEntries={['/calendar']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/events/:eventId" element={<h1>Event detail route</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('CalendarPage', () => {
  beforeEach(() => {
    getCalendarReadModel.mockReset();
    getCalendarReadModel.mockResolvedValue(readModel);
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
    expect(within(eventLink).getByText(/Board Games · Offline · private/i)).toBeInTheDocument();
  });
});
