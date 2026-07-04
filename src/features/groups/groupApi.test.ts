import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveGroup, archiveGroupLocation, createGroup, createGroupLocation, listGroupLocations } from './groupApi';

const { builders, from, rpc } = vi.hoisted(() => {
  const builders = {
    locations: {
      select: vi.fn(() => builders.locations),
      eq: vi.fn(() => builders.locations),
      is: vi.fn(() => builders.locations),
      order: vi.fn(),
      insert: vi.fn(() => builders.locations),
      single: vi.fn(),
      update: vi.fn(() => builders.locations),
    },
  };

  return {
    builders,
    from: vi.fn((table: 'locations') => builders[table]),
    rpc: vi.fn(),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from, rpc },
}));

describe('groupApi', () => {
  beforeEach(() => {
    vi.useRealTimers();
    from.mockClear();
    rpc.mockReset();
    Object.values(builders.locations).forEach((fn) => fn.mockClear?.());
    builders.locations.eq.mockImplementation(() => builders.locations);
  });

  it('creates groups through the RLS-safe database function', async () => {
    rpc.mockResolvedValue({ data: 'group-1', error: null });

    await expect(
      createGroup({
        name: '  Oneshot Company  ',
        description: ' Desc ',
        theme: ' DnD ',
        createdBy: 'user-1',
      }),
    ).resolves.toEqual({ id: 'group-1' });

    expect(rpc).toHaveBeenCalledWith('create_group_with_defaults', {
      group_name: 'Oneshot Company',
      group_description: 'Desc',
      group_theme: 'DnD',
      group_created_by: 'user-1',
    });
  });

  it('normalizes blank optional group fields before creating a group', async () => {
    rpc.mockResolvedValue({ data: 'group-2', error: null });

    await createGroup({ name: 'Guild', description: ' ', theme: '', createdBy: 'user-1' });

    expect(rpc).toHaveBeenCalledWith('create_group_with_defaults', {
      group_name: 'Guild',
      group_description: null,
      group_theme: null,
      group_created_by: 'user-1',
    });
  });

  it('archives groups through the RLS-safe database function', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(archiveGroup('group-1')).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('archive_group', { target_group_id: 'group-1' });
  });

  it('lists active reusable group locations', async () => {
    builders.locations.order.mockResolvedValue({ data: [{ id: 'location-1', name: 'Game Room' }], error: null });

    await expect(listGroupLocations('group-1')).resolves.toEqual([{ id: 'location-1', name: 'Game Room' }]);

    expect(from).toHaveBeenCalledWith('locations');
    expect(builders.locations.eq).toHaveBeenCalledWith('group_id', 'group-1');
    expect(builders.locations.is).toHaveBeenCalledWith('archived_at', null);
    expect(builders.locations.order).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('creates and archives reusable group locations', async () => {
    builders.locations.single.mockResolvedValue({ data: { id: 'location-1', name: 'Game Room' }, error: null });
    builders.locations.update.mockReturnValue(builders.locations);
    builders.locations.eq.mockImplementation(() => Promise.resolve({ error: null }) as unknown as ReturnType<typeof builders.locations.eq>);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T13:00:00.000Z'));

    await createGroupLocation({
      groupId: 'group-1',
      createdBy: 'user-1',
      name: ' Game Room ',
      address: ' 42 Tabletop Lane ',
      latitude: 46.2,
      longitude: 7.3,
      mapUrl: '',
      notes: ' Ring the bell ',
    });
    await archiveGroupLocation('location-1');

    expect(builders.locations.insert).toHaveBeenCalledWith({
      group_id: 'group-1',
      created_by: 'user-1',
      name: 'Game Room',
      address: '42 Tabletop Lane',
      latitude: 46.2,
      longitude: 7.3,
      map_url: null,
      notes: 'Ring the bell',
    });
    expect(builders.locations.update).toHaveBeenCalledWith({ archived_at: '2026-07-04T13:00:00.000Z' });
    expect(builders.locations.eq).toHaveBeenCalledWith('id', 'location-1');
  });
});
