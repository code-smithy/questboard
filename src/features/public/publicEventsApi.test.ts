import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPublicEventCards } from './publicEventsApi';

const { from, order, queryBuilder } = vi.hoisted(() => {
  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    order: vi.fn(),
  };

  return {
    from: vi.fn(() => queryBuilder),
    order: queryBuilder.order,
    queryBuilder,
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from },
}));

describe('listPublicEventCards', () => {
  beforeEach(() => {
    from.mockClear();
    queryBuilder.select.mockClear();
    order.mockReset();
  });

  it('loads safe public event cards from the public read model', async () => {
    order.mockResolvedValue({
      data: [
        {
          id: 'event-1',
          title: 'Open painting night',
          start_at: '2026-07-10T18:00:00Z',
          attending_count: 2,
          group_name: 'Painting Crew',
        },
      ],
      error: null,
    });

    await expect(listPublicEventCards()).resolves.toEqual([
      {
        id: 'event-1',
        title: 'Open painting night',
        start_at: '2026-07-10T18:00:00Z',
        attending_count: 2,
        group_name: 'Painting Crew',
      },
    ]);

    expect(from).toHaveBeenCalledWith('public_event_cards');
    expect(queryBuilder.select).toHaveBeenCalledWith(expect.stringContaining('attending_count'));
    expect(order).toHaveBeenCalledWith('start_at', { ascending: true });
  });
});
