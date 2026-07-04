import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { EventDetailPage } from './EventDetailPage';

const { archiveEvent, getEvent, listUserGroups, setEventRsvp, updateEvent } = vi.hoisted(() => ({
  archiveEvent: vi.fn(),
  getEvent: vi.fn(),
  listUserGroups: vi.fn(),
  setEventRsvp: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock('../groups/groupApi', () => ({
  listUserGroups,
}));

vi.mock('./eventApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./eventApi')>()),
  archiveEvent,
  getEvent,
  setEventRsvp,
  updateEvent,
}));

const authState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: { id: 'user-1', email: 'user@example.com' } as AuthState['user'],
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

const event = {
  id: 'event-1',
  group_id: 'group-1',
  category_id: 'category-1',
  owner_id: 'user-2',
  title: 'Board game night',
  description: 'Bring snacks.',
  start_at: '2026-07-10T18:00:00Z',
  end_at: '2026-07-10T21:00:00Z',
  timezone: 'UTC',
  mode: 'offline',
  location_text: 'The game room',
  online_details: {},
  minimum_attendees: 2,
  maximum_attendees: 4,
  visibility: 'private',
  status: 'open',
  archived_at: null,
  categories: { id: 'category-1', name: 'Board Games', color: '#f0b35a', icon: null },
  event_rsvps: [
    {
      id: 'rsvp-1',
      event_id: 'event-1',
      user_id: 'user-1',
      status: 'attending',
      profiles: { display_name: 'Quest Keeper', avatar_url: null },
    },
    {
      id: 'rsvp-2',
      event_id: 'event-1',
      user_id: 'user-2',
      status: 'maybe',
      profiles: { display_name: 'Map Maker', avatar_url: null },
    },
  ],
};

function renderEventDetail() {
  return render(
    <AuthContext.Provider value={authState}>
      <MemoryRouter initialEntries={['/events/event-1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/calendar" element={<h1>Calendar</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('EventDetailPage', () => {
  beforeEach(() => {
    archiveEvent.mockReset();
    getEvent.mockReset();
    listUserGroups.mockReset();
    setEventRsvp.mockReset();
    updateEvent.mockReset();
    listUserGroups.mockResolvedValue([{ id: 'group-1', name: 'Friday Guild', role: 'regular' }]);
    getEvent.mockResolvedValue(event);
    setEventRsvp.mockResolvedValue(undefined);
  });

  it('shows RSVP counts and attending members', async () => {
    renderEventDetail();

    expect(await screen.findByRole('heading', { name: 'Board game night' })).toBeInTheDocument();
    expect(screen.getByText('1/4 seats - Needs 1 more')).toBeInTheDocument();
    expect(screen.getByText('1 attending, 1 maybe, 0 declined.')).toBeInTheDocument();
    expect(screen.getByText('Quest Keeper')).toBeInTheDocument();
  });

  it('saves the current member RSVP and reloads the event', async () => {
    renderEventDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Maybe' }));

    await waitFor(() => {
      expect(setEventRsvp).toHaveBeenCalledWith('event-1', 'user-1', 'maybe');
    });
    expect(getEvent).toHaveBeenCalledTimes(2);
  });
});
