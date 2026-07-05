import { beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveGroup, archiveGroupLocation, createGroup, createGroupLocation, leaveGroup, listGroupLocations, listGroupMembers, listPendingEventJoinRequests, removeGroupMember, reviewEventJoinRequest, setGroupMemberRole } from './groupApi';

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
    event_join_requests: {
      select: vi.fn(() => builders.event_join_requests),
      eq: vi.fn(() => builders.event_join_requests),
      order: vi.fn(),
    },
    group_members: {
      select: vi.fn(() => builders.group_members),
      eq: vi.fn(() => builders.group_members),
      is: vi.fn(() => builders.group_members),
      order: vi.fn(),
    },
  };

  return {
    builders,
    from: vi.fn((table: 'locations' | 'event_join_requests' | 'group_members') => builders[table]),
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
    Object.values(builders.event_join_requests).forEach((fn) => fn.mockClear?.());
    Object.values(builders.group_members).forEach((fn) => fn.mockClear?.());
    builders.locations.eq.mockImplementation(() => builders.locations);
    builders.event_join_requests.eq.mockImplementation(() => builders.event_join_requests);
    builders.group_members.eq.mockImplementation(() => builders.group_members);
    builders.group_members.is.mockImplementation(() => builders.group_members);
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

  it('lists active guild members with profile details', async () => {
    builders.group_members.order
      .mockReturnValueOnce(builders.group_members)
      .mockResolvedValueOnce({ data: [{ id: 'member-1', user_id: 'user-1' }], error: null });

    await expect(listGroupMembers('group-1')).resolves.toEqual([{ id: 'member-1', user_id: 'user-1' }]);

    expect(from).toHaveBeenCalledWith('group_members');
    expect(builders.group_members.select).toHaveBeenCalledWith(expect.stringContaining('profiles'));
    expect(builders.group_members.eq).toHaveBeenCalledWith('group_id', 'group-1');
    expect(builders.group_members.is).toHaveBeenCalledWith('archived_at', null);
    expect(builders.group_members.order).toHaveBeenCalledWith('role', { ascending: true });
    expect(builders.group_members.order).toHaveBeenCalledWith('joined_at', { ascending: true });
  });

  it('leaves, removes, and changes guild member roles through RLS-safe database functions', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(leaveGroup('group-1')).resolves.toBeUndefined();
    await expect(removeGroupMember('group-1', 'user-2')).resolves.toBeUndefined();
    await expect(setGroupMemberRole('group-1', 'user-2', 'group_admin')).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('leave_group', { target_group_id: 'group-1' });
    expect(rpc).toHaveBeenCalledWith('remove_group_member', {
      target_group_id: 'group-1',
      target_user_id: 'user-2',
    });
    expect(rpc).toHaveBeenCalledWith('set_group_member_role', {
      target_group_id: 'group-1',
      target_user_id: 'user-2',
      next_role: 'group_admin',
    });
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

  it('lists pending event join requests for a guild', async () => {
    builders.event_join_requests.order.mockResolvedValue({
      data: [{ id: 'request-1', event_id: 'event-1', status: 'pending' }],
      error: null,
    });

    await expect(listPendingEventJoinRequests('group-1')).resolves.toEqual([{ id: 'request-1', event_id: 'event-1', status: 'pending' }]);

    expect(from).toHaveBeenCalledWith('event_join_requests');
    expect(builders.event_join_requests.select).toHaveBeenCalledWith(expect.stringContaining('events!inner'));
    expect(builders.event_join_requests.select).toHaveBeenCalledWith(expect.stringContaining('profiles!event_join_requests_requester_id_fkey'));
    expect(builders.event_join_requests.eq).toHaveBeenCalledWith('status', 'pending');
    expect(builders.event_join_requests.eq).toHaveBeenCalledWith('events.group_id', 'group-1');
    expect(builders.event_join_requests.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('reviews event join requests through the database function', async () => {
    rpc.mockResolvedValue({ data: 'event-1', error: null });

    await expect(reviewEventJoinRequest('request-1', 'approved')).resolves.toBe('event-1');

    expect(rpc).toHaveBeenCalledWith('review_event_join_request', {
      request_id: 'request-1',
      next_status: 'approved',
    });
  });
});
