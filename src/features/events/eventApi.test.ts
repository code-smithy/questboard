import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveEvent, createEvent, listGroupCategories, updateEvent } from './eventApi';

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
  };

  return {
    builders,
    from: vi.fn((table: 'categories' | 'events') => builders[table]),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}));

const input = {
  groupId: 'group-1',
  categoryId: 'category-1',
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
});
