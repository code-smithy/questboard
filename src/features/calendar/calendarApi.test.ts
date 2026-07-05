import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCalendarReadModel } from './calendarApi';

const { listUserGroups, order, queryBuilder } = vi.hoisted(() => {
  const order = vi.fn();
  const queryBuilder = {
    select: vi.fn((columns: string) => {
      void columns;
      return queryBuilder;
    }),
    in: vi.fn(() => queryBuilder),
    is: vi.fn(() => queryBuilder),
    neq: vi.fn(() => queryBuilder),
    order,
  };

  return {
    listUserGroups: vi.fn(),
    order,
    queryBuilder,
  };
});

const { from } = vi.hoisted(() => ({
  from: vi.fn(() => queryBuilder),
}));

vi.mock('../groups/groupApi', () => ({
  listUserGroups,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}));

describe('getCalendarReadModel', () => {
  beforeEach(() => {
    listUserGroups.mockReset();
    from.mockClear();
    queryBuilder.select.mockClear();
    queryBuilder.in.mockClear();
    queryBuilder.is.mockClear();
    queryBuilder.neq.mockClear();
    order.mockReset();
  });

  it('loads active events for the signed-in user groups', async () => {
    listUserGroups.mockResolvedValue([{ id: 'group-1', name: 'Guild', role: 'group_admin' }]);
    order.mockResolvedValue({
      data: [
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
          categories: { id: 'category-1', name: 'Board Games', color: '#f0b35a', icon: '🎲' },
          event_rsvps: [{ user_id: 'user-1', status: 'attending' }],
        },
      ],
      error: null,
    });

    await expect(getCalendarReadModel('user-1')).resolves.toMatchObject({
      groups: [{ id: 'group-1' }],
      events: [{ id: 'event-1', group_name: 'Guild', category: { name: 'Board Games' }, rsvps: [{ user_id: 'user-1', status: 'attending' }] }],
    });

    expect(from).toHaveBeenCalledWith('events');
    expect(queryBuilder.select.mock.calls[0][0]).toContain('user_id');
    expect(queryBuilder.in).toHaveBeenCalledWith('group_id', ['group-1']);
    expect(queryBuilder.is).toHaveBeenCalledWith('archived_at', null);
    expect(queryBuilder.neq).toHaveBeenCalledWith('status', 'archived');
    expect(order).toHaveBeenCalledWith('start_at', { ascending: true });
  });

  it('skips the event query when the user has no groups', async () => {
    listUserGroups.mockResolvedValue([]);

    await expect(getCalendarReadModel('user-1')).resolves.toEqual({ groups: [], events: [] });

    expect(from).not.toHaveBeenCalled();
  });
});
