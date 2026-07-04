import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addEventComment,
  archiveEvent,
  archiveEventComment,
  buildEventIcs,
  createEvent,
  dismissInAppReminder,
  getAttendanceSummary,
  listDueInAppReminders,
  listGroupCategories,
  recordEventHistory,
  replaceInAppReminder,
  setEventRsvp,
  updateEvent,
} from './eventApi';

const { builders, from } = vi.hoisted(() => {
  const builders = {
    categories: {
      select: vi.fn(() => builders.categories),
      eq: vi.fn(() => builders.categories),
      order: vi.fn(),
    },
    events: {
      insert: vi.fn(() => builders.events),
      select: vi.fn(() => builders.events),
      single: vi.fn(),
      update: vi.fn(() => builders.events),
      eq: vi.fn(),
    },
    event_rsvps: {
      upsert: vi.fn(),
    },
    event_comments: {
      insert: vi.fn(),
      update: vi.fn(() => builders.event_comments),
      eq: vi.fn(),
    },
    event_history: {
      insert: vi.fn(),
    },
    event_reminders: {
      delete: vi.fn(() => builders.event_reminders),
      eq: vi.fn(() => builders.event_reminders),
      insert: vi.fn(() => builders.event_reminders),
      select: vi.fn(() => builders.event_reminders),
      single: vi.fn(),
      lte: vi.fn(() => builders.event_reminders),
      order: vi.fn(),
      update: vi.fn(() => builders.event_reminders),
    },
  };

  return {
    builders,
    from: vi.fn((table: 'categories' | 'events' | 'event_rsvps' | 'event_comments' | 'event_history' | 'event_reminders') => builders[table]),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}));

const input = {
  groupId: 'group-1',
  categoryId: 'category-1',
  locationId: 'location-1',
  ownerId: 'user-1',
  title: '  Quest night  ',
  description: ' Bring snacks ',
  startAt: '2026-07-10T18:00:00.000Z',
  endAt: '2026-07-10T21:00:00.000Z',
  timezone: 'UTC',
  mode: 'offline' as const,
  locationText: ' Tavern ',
  onlinePlatform: '',
  onlineUrl: '',
  onlineInstructions: '',
  minimumAttendees: 2,
  maximumAttendees: 5,
  visibility: 'private' as const,
  status: 'open' as const,
};

describe('eventApi', () => {
  beforeEach(() => {
    vi.useRealTimers();
    from.mockClear();
    Object.values(builders).forEach((builder) => {
      Object.values(builder).forEach((fn) => fn.mockClear?.());
    });
  });

  it('lists active group categories', async () => {
    builders.categories.order.mockResolvedValue({ data: [{ id: 'category-1', name: 'DnD' }], error: null });

    await expect(listGroupCategories('group-1')).resolves.toEqual([{ id: 'category-1', name: 'DnD' }]);

    expect(from).toHaveBeenCalledWith('categories');
    expect(builders.categories.eq).toHaveBeenCalledWith('group_id', 'group-1');
    expect(builders.categories.eq).toHaveBeenCalledWith('is_active', true);
  });

  it('creates events with normalized optional text and online details', async () => {
    builders.events.single.mockResolvedValue({ data: { id: 'event-1' }, error: null });

    await expect(createEvent(input)).resolves.toEqual({ id: 'event-1' });

    expect(builders.events.insert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Quest night',
      description: 'Bring snacks',
      location_text: 'Tavern',
      location_id: 'location-1',
      online_details: { platform: null, url: null, instructions: null },
      minimum_attendees: 2,
      maximum_attendees: 5,
    }));
  });

  it('updates and archives events', async () => {
    builders.events.eq.mockResolvedValue({ error: null });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:00:00.000Z'));

    await updateEvent('event-1', input);
    await archiveEvent('event-1');

    expect(builders.events.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Quest night' }));
    expect(builders.events.update).toHaveBeenCalledWith({ status: 'archived', archived_at: '2026-07-04T12:00:00.000Z' });
  });

  it('upserts a member RSVP for an event', async () => {
    builders.event_rsvps.upsert.mockResolvedValue({ error: null });

    await setEventRsvp('event-1', 'user-1', 'attending');

    expect(from).toHaveBeenCalledWith('event_rsvps');
    expect(builders.event_rsvps.upsert).toHaveBeenCalledWith(
      { event_id: 'event-1', user_id: 'user-1', status: 'attending' },
      { onConflict: 'event_id,user_id' },
    );
  });

  it('creates and archives event comments', async () => {
    builders.event_comments.insert.mockResolvedValue({ error: null });
    builders.event_comments.eq.mockResolvedValue({ error: null });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:30:00.000Z'));

    await addEventComment('event-1', 'user-1', '  I can bring snacks.  ');
    await archiveEventComment('comment-1');

    expect(builders.event_comments.insert).toHaveBeenCalledWith({
      event_id: 'event-1',
      user_id: 'user-1',
      body: 'I can bring snacks.',
    });
    expect(builders.event_comments.update).toHaveBeenCalledWith({ archived_at: '2026-07-04T12:30:00.000Z' });
    expect(builders.event_comments.eq).toHaveBeenCalledWith('id', 'comment-1');
  });

  it('records event history entries', async () => {
    builders.event_history.insert.mockResolvedValue({ error: null });

    await recordEventHistory({
      eventId: 'event-1',
      changedBy: 'user-1',
      changeType: 'event_updated',
      oldValue: { title: 'Old title' },
      newValue: { title: 'New title' },
    });

    expect(builders.event_history.insert).toHaveBeenCalledWith({
      event_id: 'event-1',
      changed_by: 'user-1',
      change_type: 'event_updated',
      old_value: { title: 'Old title' },
      new_value: { title: 'New title' },
    });
  });

  it('replaces a member in-app reminder for an event', async () => {
    builders.event_reminders.single.mockResolvedValue({
      data: { id: 'reminder-1', event_id: 'event-1', user_id: 'user-1', remind_at: '2026-07-10T17:00:00.000Z', method: 'in_app', is_sent: false },
      error: null,
    });

    await replaceInAppReminder('event-1', 'user-1', '2026-07-10T18:00:00.000Z', 60);

    expect(builders.event_reminders.delete).toHaveBeenCalled();
    expect(builders.event_reminders.eq).toHaveBeenCalledWith('event_id', 'event-1');
    expect(builders.event_reminders.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builders.event_reminders.eq).toHaveBeenCalledWith('method', 'in_app');
    expect(builders.event_reminders.insert).toHaveBeenCalledWith({
      event_id: 'event-1',
      user_id: 'user-1',
      remind_at: '2026-07-10T17:00:00.000Z',
      method: 'in_app',
    });
  });

  it('lists and dismisses due in-app reminders', async () => {
    builders.event_reminders.order.mockResolvedValue({
      data: [{ id: 'reminder-1', event_id: 'event-1', user_id: 'user-1', remind_at: '2026-07-10T17:00:00.000Z', method: 'in_app', is_sent: false }],
      error: null,
    });

    await expect(listDueInAppReminders('user-1', new Date('2026-07-10T17:30:00.000Z'))).resolves.toHaveLength(1);
    await dismissInAppReminder('reminder-1');

    expect(builders.event_reminders.lte).toHaveBeenCalledWith('remind_at', '2026-07-10T17:30:00.000Z');
    expect(builders.event_reminders.order).toHaveBeenCalledWith('remind_at', { ascending: true });
    expect(builders.event_reminders.update).toHaveBeenCalledWith({ is_sent: true });
    expect(builders.event_reminders.eq).toHaveBeenCalledWith('id', 'reminder-1');
  });

  it('builds an ICS export for a single event', () => {
    const ics = buildEventIcs({
      id: 'event-1',
      group_id: 'group-1',
      category_id: 'category-1',
      location_id: 'location-1',
      owner_id: 'user-1',
      title: 'Board game night',
      description: 'Bring snacks, sleeves; and dice.',
      start_at: '2026-07-10T18:00:00.000Z',
      end_at: '2026-07-10T21:00:00.000Z',
      timezone: 'UTC',
      mode: 'offline',
      location_text: 'Back room',
      online_details: {},
      minimum_attendees: 2,
      maximum_attendees: 5,
      visibility: 'private',
      status: 'open',
      archived_at: null,
      categories: null,
      locations: { id: 'location-1', name: 'Game Room', address: '42 Tabletop Lane', latitude: null, longitude: null, map_url: null, notes: null },
      event_rsvps: [],
      event_comments: [],
      event_history: [],
      event_reminders: [],
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Board game night');
    expect(ics).toContain('DESCRIPTION:Bring snacks\\, sleeves\\; and dice.');
    expect(ics).toContain('LOCATION:Game Room\\, 42 Tabletop Lane\\, Back room');
    expect(ics).toContain('DTSTART:20260710T180000Z');
  });

  it('summarizes RSVP counts and attendance thresholds', () => {
    expect(getAttendanceSummary({
      rsvps: [{ status: 'attending' }, { status: 'maybe' }, { status: 'declined' }],
      minimumAttendees: 2,
      maximumAttendees: 4,
      status: 'open',
    })).toMatchObject({
      attendingCount: 1,
      maybeCount: 1,
      declinedCount: 1,
      remainingMinimum: 1,
      isMinimumReached: false,
      isFull: false,
      label: '1/4 seats - Needs 1 more',
    });

    expect(getAttendanceSummary({
      rsvps: [{ status: 'attending' }, { status: 'attending' }],
      minimumAttendees: 2,
      maximumAttendees: 2,
      status: 'open',
    }).label).toBe('2/2 seats - Full');
  });
});
