import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  disableOwnCalendarFeed,
  ensureOwnCalendarFeed,
  getCalendarFeedUrl,
  getOwnCalendarFeed,
  regenerateOwnCalendarFeed,
  updateOwnProfileDefaultEventDuration,
  updateOwnProfileDisplayName,
  updateOwnProfileTimezone,
} from './profileApi';

const { builders, from, rpc } = vi.hoisted(() => {
  const builders = {
    calendar_feeds: {
      select: vi.fn(() => builders.calendar_feeds),
      eq: vi.fn(() => builders.calendar_feeds),
      maybeSingle: vi.fn(),
    },
    profiles: {
      update: vi.fn(() => builders.profiles),
      eq: vi.fn(() => builders.profiles),
      select: vi.fn(() => builders.profiles),
      single: vi.fn(),
    },
  };

  return {
    builders,
    from: vi.fn((table: 'calendar_feeds' | 'profiles') => builders[table]),
    rpc: vi.fn(),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from, rpc },
  supabaseUrl: 'https://questboard.example.supabase.co',
}));

describe('profileApi', () => {
  beforeEach(() => {
    from.mockClear();
    rpc.mockClear();
    Object.values(builders).forEach((builder) => {
      Object.values(builder).forEach((fn) => fn.mockClear?.());
    });
  });

  it('trims and saves the editable profile display name', async () => {
    builders.profiles.single.mockResolvedValue({
      data: { id: 'user-1', display_name: 'Guild Name' },
      error: null,
    });

    await expect(updateOwnProfileDisplayName('user-1', '  Guild Name  ')).resolves.toEqual({
      id: 'user-1',
      display_name: 'Guild Name',
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(builders.profiles.update).toHaveBeenCalledWith({ display_name: 'Guild Name' });
    expect(builders.profiles.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('saves the default event duration hours', async () => {
    builders.profiles.single.mockResolvedValue({
      data: { id: 'user-1', default_event_duration_hours: 3.5 },
      error: null,
    });

    await expect(updateOwnProfileDefaultEventDuration('user-1', 3.5)).resolves.toEqual({
      id: 'user-1',
      default_event_duration_hours: 3.5,
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(builders.profiles.update).toHaveBeenCalledWith({ default_event_duration_hours: 3.5 });
    expect(builders.profiles.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('saves the profile timezone', async () => {
    builders.profiles.single.mockResolvedValue({
      data: { id: 'user-1', timezone: 'Europe/Zurich' },
      error: null,
    });

    await expect(updateOwnProfileTimezone('user-1', 'Europe/Zurich')).resolves.toEqual({
      id: 'user-1',
      timezone: 'Europe/Zurich',
    });

    expect(from).toHaveBeenCalledWith('profiles');
    expect(builders.profiles.update).toHaveBeenCalledWith({ timezone: 'Europe/Zurich' });
    expect(builders.profiles.eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('loads a user calendar feed', async () => {
    builders.calendar_feeds.maybeSingle.mockResolvedValue({
      data: { id: 'feed-1', owner_id: 'user-1', token: 'token-1', scope: 'rsvp', is_active: true },
      error: null,
    });

    await expect(getOwnCalendarFeed('user-1')).resolves.toMatchObject({ id: 'feed-1', token: 'token-1' });

    expect(from).toHaveBeenCalledWith('calendar_feeds');
    expect(builders.calendar_feeds.select).toHaveBeenCalledWith('id, owner_id, token, scope, is_active, created_at, updated_at, last_accessed_at');
    expect(builders.calendar_feeds.eq).toHaveBeenCalledWith('owner_id', 'user-1');
  });

  it('manages calendar feed tokens through RPCs', async () => {
    rpc.mockResolvedValueOnce({
      data: { id: 'feed-1', token: 'token-1', scope: 'visible', is_active: true },
      error: null,
    });
    rpc.mockResolvedValueOnce({
      data: { id: 'feed-1', token: 'token-2', scope: 'visible', is_active: true },
      error: null,
    });
    rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(ensureOwnCalendarFeed('visible')).resolves.toMatchObject({ token: 'token-1' });
    await expect(regenerateOwnCalendarFeed()).resolves.toMatchObject({ token: 'token-2' });
    await expect(disableOwnCalendarFeed()).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('ensure_own_calendar_feed', { feed_scope: 'visible' });
    expect(rpc).toHaveBeenCalledWith('regenerate_own_calendar_feed');
    expect(rpc).toHaveBeenCalledWith('disable_own_calendar_feed');
  });

  it('builds the public calendar feed function URL', () => {
    expect(getCalendarFeedUrl('token with spaces')).toBe('https://questboard.example.supabase.co/functions/v1/calendar-feed/token%20with%20spaces.ics');
  });
});
