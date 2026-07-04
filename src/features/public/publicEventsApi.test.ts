import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listPublicEventCards, requestPublicEventJoin } from './publicEventsApi';

const { from, order, queryBuilder, rpc } = vi.hoisted(() => {
  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    order: vi.fn(),
  };

  return {
    from: vi.fn(() => queryBuilder),
    order: queryBuilder.order,
    queryBuilder,
    rpc: vi.fn(),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from, rpc },
}));

describe('listPublicEventCards', () => {
  beforeEach(() => {
    from.mockClear();
    rpc.mockReset();
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
    expect(queryBuilder.select).toHaveBeenCalledWith(expect.stringContaining('current_user_request_status'));
    expect(order).toHaveBeenCalledWith('start_at', { ascending: true });
  });

  it('requests access to a public event through the database function', async () => {
    rpc.mockResolvedValue({ data: 'request-1', error: null });

    await expect(requestPublicEventJoin('event-1')).resolves.toBe('request-1');

    expect(rpc).toHaveBeenCalledWith('request_public_event_join', { target_event_id: 'event-1' });
  });
});
