import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { EventDetailPage } from './EventDetailPage';

const { addEventComment, archiveEvent, archiveEventComment, archiveEventSeries, getEvent, listGroupCategories, listGroupLocations, listUserGroups, recordEventHistory, replaceInAppReminder, reviewEventJoinRequest, setEventRsvp, updateEvent } = vi.hoisted(() => ({
  addEventComment: vi.fn(),
  archiveEvent: vi.fn(),
  archiveEventComment: vi.fn(),
  archiveEventSeries: vi.fn(),
  getEvent: vi.fn(),
  listGroupCategories: vi.fn(),
  listGroupLocations: vi.fn(),
  listUserGroups: vi.fn(),
  recordEventHistory: vi.fn(),
  replaceInAppReminder: vi.fn(),
  reviewEventJoinRequest: vi.fn(),
  setEventRsvp: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock('../groups/groupApi', () => ({
  listGroupLocations,
  listUserGroups,
  reviewEventJoinRequest,
}));

vi.mock('./eventApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./eventApi')>()),
  addEventComment,
  archiveEvent,
  archiveEventComment,
  archiveEventSeries,
  getEvent,
  listGroupCategories,
  recordEventHistory,
  replaceInAppReminder,
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
  location_id: 'location-1',
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
  recurrence_rule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE',
  recurrence_parent_id: null,
  archived_at: null,
  categories: { id: 'category-1', name: 'Board Games', color: '#f0b35a', icon: null },
  locations: {
    id: 'location-1',
    name: 'The Game Room',
    address: '42 Tabletop Lane',
    latitude: null,
    longitude: null,
    map_url: 'https://maps.example/game-room',
    notes: 'Ring the side bell.',
  },
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
  event_comments: [
    {
      id: 'comment-1',
      event_id: 'event-1',
      user_id: 'user-1',
      body: 'I can bring snacks.',
      created_at: '2026-07-05T10:00:00Z',
      updated_at: '2026-07-05T10:00:00Z',
      archived_at: null,
      profiles: { display_name: 'Quest Keeper', avatar_url: null },
    },
  ],
  event_history: [
    {
      id: 'history-1',
      event_id: 'event-1',
      changed_by: 'user-2',
      change_type: 'event_updated',
      old_value: { title: 'Old title' },
      new_value: { title: 'Board game night' },
      created_at: '2026-07-05T11:00:00Z',
      profiles: { display_name: 'Map Maker', avatar_url: null },
    },
  ],
  event_reminders: [
    {
      id: 'reminder-1',
      event_id: 'event-1',
      user_id: 'user-1',
      remind_at: '2026-07-10T17:00:00Z',
      method: 'in_app',
      is_sent: false,
      created_at: '2026-07-05T12:00:00Z',
    },
  ],
  event_join_requests: [],
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
    addEventComment.mockReset();
    archiveEvent.mockReset();
    archiveEventComment.mockReset();
    archiveEventSeries.mockReset();
    getEvent.mockReset();
    listGroupCategories.mockReset();
    listGroupLocations.mockReset();
    listUserGroups.mockReset();
    recordEventHistory.mockReset();
    replaceInAppReminder.mockReset();
    reviewEventJoinRequest.mockReset();
    setEventRsvp.mockReset();
    updateEvent.mockReset();
    listGroupCategories.mockResolvedValue([{ id: 'category-1', group_id: 'group-1', name: 'Board Games', color: '#f0b35a', icon: null }]);
    listGroupLocations.mockResolvedValue([{
      id: 'location-1',
      group_id: 'group-1',
      name: 'The Game Room',
      address: '42 Tabletop Lane',
      latitude: null,
      longitude: null,
      map_url: 'https://maps.example/game-room',
      notes: 'Ring the side bell.',
      created_by: 'user-2',
      created_at: '2026-07-01T10:00:00Z',
      archived_at: null,
    }]);
    listUserGroups.mockResolvedValue([{ id: 'group-1', name: 'Friday Guild', role: 'regular' }]);
    getEvent.mockResolvedValue(event);
    addEventComment.mockResolvedValue(undefined);
    archiveEvent.mockResolvedValue(undefined);
    archiveEventComment.mockResolvedValue(undefined);
    archiveEventSeries.mockResolvedValue(undefined);
    recordEventHistory.mockResolvedValue(undefined);
    replaceInAppReminder.mockResolvedValue(undefined);
    reviewEventJoinRequest.mockResolvedValue('event-1');
    setEventRsvp.mockResolvedValue(undefined);
  });

  it('shows RSVP counts, comments, and history', async () => {
    renderEventDetail();

    expect(await screen.findByRole('heading', { name: 'Board game night' })).toBeInTheDocument();
    expect(screen.getByText('1/4 seats - Needs 1 more')).toBeInTheDocument();
    expect(screen.getByText('Every 1 week(s) on Monday, Wednesday')).toBeInTheDocument();
    expect(screen.getByText('Friday Guild')).toBeInTheDocument();
    expect(screen.getByText('1 attending, 1 maybe, 0 declined.')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Attending members')).getByText('Quest Keeper')).toBeInTheDocument();
    expect(screen.getByText('I can bring snacks.')).toBeInTheDocument();
    expect(screen.getByText('event updated')).toBeInTheDocument();
    expect(screen.getByLabelText('Remind me')).toHaveValue('60');
  });

  it('saves the current member RSVP and reloads the event', async () => {
    renderEventDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Maybe' }));

    await waitFor(() => {
      expect(setEventRsvp).toHaveBeenCalledWith('event-1', 'user-1', 'maybe');
    });
    expect(getEvent).toHaveBeenCalledTimes(2);
    expect(recordEventHistory).toHaveBeenCalledWith({
      eventId: 'event-1',
      changedBy: 'user-1',
      changeType: 'rsvp_updated',
      oldValue: { status: 'attending' },
      newValue: { status: 'maybe' },
    });
  });

  it('posts comments and records comment history', async () => {
    renderEventDetail();

    fireEvent.change(await screen.findByLabelText('Add comment'), { target: { value: 'New plan.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));

    await waitFor(() => {
      expect(addEventComment).toHaveBeenCalledWith('event-1', 'user-1', 'New plan.');
    });
    expect(recordEventHistory).toHaveBeenCalledWith({
      eventId: 'event-1',
      changedBy: 'user-1',
      changeType: 'comment_added',
      newValue: { body: 'New plan.' },
    });
    expect(getEvent).toHaveBeenCalledTimes(2);
  });

  it('archives the current member comment', async () => {
    renderEventDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Archive comment' }));

    await waitFor(() => {
      expect(archiveEventComment).toHaveBeenCalledWith('comment-1');
    });
    expect(recordEventHistory).toHaveBeenCalledWith({
      eventId: 'event-1',
      changedBy: 'user-1',
      changeType: 'comment_archived',
      newValue: { comment_id: 'comment-1' },
    });
  });

  it('saves the current member reminder preference', async () => {
    renderEventDetail();

    fireEvent.change(await screen.findByLabelText('Remind me'), { target: { value: '15' } });

    await waitFor(() => {
      expect(replaceInAppReminder).toHaveBeenCalledWith('event-1', 'user-1', '2026-07-10T18:00:00Z', 15);
    });
    expect(getEvent).toHaveBeenCalledTimes(2);
  });

  it('updates a recurring event status without replacing future occurrences', async () => {
    updateEvent.mockResolvedValue(undefined);
    renderEventDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Edit quest' }));
    fireEvent.click(await screen.findByText('Advanced details'));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'cancelled' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save quest' }));

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'event-1',
        expect.objectContaining({ status: 'cancelled' }),
        { replaceFutureOccurrences: false },
      );
    });
  });

  it('lets the event owner admit pending public join requests', async () => {
    getEvent.mockResolvedValue({
      ...event,
      owner_id: 'user-1',
      event_join_requests: [
        {
          id: 'request-1',
          event_id: 'event-1',
          requester_id: 'user-3',
          status: 'pending',
          created_at: '2026-07-06T10:00:00Z',
          reviewed_at: null,
          profiles: { display_name: 'New Adventurer', avatar_url: null },
        },
      ],
    });

    renderEventDetail();

    expect(await screen.findByText('New Adventurer')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => {
      expect(reviewEventJoinRequest).toHaveBeenCalledWith('request-1', 'approved');
    });
    expect(getEvent).toHaveBeenCalledTimes(2);
  });

  it('archives only the current occurrence from a recurring quest', async () => {
    renderEventDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Archive this occurrence' }));

    await waitFor(() => {
      expect(archiveEvent).toHaveBeenCalledWith('event-1');
    });
    expect(archiveEventSeries).not.toHaveBeenCalled();
    expect(recordEventHistory).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      changeType: 'event_archived',
    }));
  });

  it('archives the full recurring series', async () => {
    renderEventDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Archive series' }));

    await waitFor(() => {
      expect(archiveEventSeries).toHaveBeenCalledWith('event-1');
    });
    expect(recordEventHistory).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'event-1',
      changeType: 'event_series_archived',
    }));
  });
});
