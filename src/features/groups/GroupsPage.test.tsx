import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { GroupsPage } from './GroupsPage';
import type { GroupInvite, GroupMember, GroupSummary } from './groupApi';

const {
  archiveGroup,
  archiveGroupLocation,
  createGroup,
  createGroupInvite,
  createGroupLocation,
  deactivateGroupInvite,
  listGroupInvites,
  listGroupLocations,
  listGroupMembers,
  listPendingEventJoinRequests,
  listUserGroups,
  leaveGroup,
  removeGroupMember,
  reviewEventJoinRequest,
} = vi.hoisted(() => ({
  archiveGroup: vi.fn(),
  archiveGroupLocation: vi.fn(),
  createGroup: vi.fn(),
  createGroupInvite: vi.fn(),
  createGroupLocation: vi.fn(),
  deactivateGroupInvite: vi.fn(),
  listGroupInvites: vi.fn(),
  listGroupLocations: vi.fn(),
  listGroupMembers: vi.fn(),
  listPendingEventJoinRequests: vi.fn(),
  listUserGroups: vi.fn(),
  leaveGroup: vi.fn(),
  removeGroupMember: vi.fn(),
  reviewEventJoinRequest: vi.fn(),
}));

vi.mock('./groupApi', () => ({
  archiveGroup,
  archiveGroupLocation,
  createGroup,
  createGroupInvite,
  createGroupLocation,
  deactivateGroupInvite,
  listGroupInvites,
  listGroupLocations,
  listGroupMembers,
  listPendingEventJoinRequests,
  listUserGroups,
  leaveGroup,
  removeGroupMember,
  reviewEventJoinRequest,
}));

const baseAuthState: AuthState = {
  isConfigured: true,
  isLoading: false,
  session: null,
  user: { id: 'user-1', email: 'user@example.com' } as AuthState['user'],
  profile: null,
  refreshProfile: vi.fn(),
  signOut: vi.fn(),
};

const adminGroup: GroupSummary = {
  id: 'group-1',
  name: 'Friday Night Guild',
  description: 'Board games and one-shots.',
  theme: 'Board Games',
  created_at: '2026-07-03T12:00:00.000Z',
  role: 'group_admin',
  joined_at: '2026-07-03T12:00:00.000Z',
};

const regularGroup: GroupSummary = {
  ...adminGroup,
  role: 'regular',
};

const invite: GroupInvite = {
  id: 'invite-1',
  group_id: 'group-1',
  token: 'invite-token',
  expires_at: null,
  max_uses: null,
  used_count: 0,
  is_active: true,
  created_at: '2026-07-03T12:30:00.000Z',
};

const location = {
  id: 'location-1',
  group_id: 'group-1',
  name: 'The Game Room',
  address: '42 Tabletop Lane',
  latitude: null,
  longitude: null,
  map_url: 'https://maps.example/game-room',
  notes: 'Ring the side bell.',
  created_by: 'user-1',
  created_at: '2026-07-03T12:35:00.000Z',
  archived_at: null,
};


const members: GroupMember[] = [
  {
    id: 'member-1',
    group_id: 'group-1',
    user_id: 'user-1',
    role: 'group_admin',
    joined_at: '2026-07-03T12:00:00.000Z',
    profiles: { display_name: 'Quest Keeper', avatar_url: null },
  },
  {
    id: 'member-2',
    group_id: 'group-1',
    user_id: 'user-2',
    role: 'regular',
    joined_at: '2026-07-04T12:00:00.000Z',
    profiles: { display_name: 'Map Maker', avatar_url: null },
  },
];

const joinRequest = {
  id: 'request-1',
  event_id: 'event-1',
  requester_id: 'user-2',
  status: 'pending',
  created_at: '2026-07-04T12:00:00.000Z',
  reviewed_at: null,
  events: {
    id: 'event-1',
    title: 'Open painting night',
    start_at: '2026-07-10T18:00:00.000Z',
    timezone: 'UTC',
    group_id: 'group-1',
  },
  profiles: {
    display_name: 'New Adventurer',
    avatar_url: null,
  },
};

function renderGroups(authState: Partial<AuthState> = {}) {
  return render(
    <AuthContext.Provider value={{ ...baseAuthState, ...authState }}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <GroupsPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('GroupsPage', () => {
  beforeEach(() => {
    archiveGroup.mockReset();
    archiveGroupLocation.mockReset();
    createGroup.mockReset();
    createGroupInvite.mockReset();
    createGroupLocation.mockReset();
    deactivateGroupInvite.mockReset();
    listGroupInvites.mockReset();
    listGroupLocations.mockReset();
    listGroupMembers.mockReset();
    listPendingEventJoinRequests.mockReset();
    listUserGroups.mockReset();
    leaveGroup.mockReset();
    removeGroupMember.mockReset();
    reviewEventJoinRequest.mockReset();

    archiveGroup.mockResolvedValue(undefined);
    listUserGroups.mockResolvedValue([adminGroup]);
    listGroupInvites.mockResolvedValue([invite]);
    listGroupLocations.mockResolvedValue([location]);
    listGroupMembers.mockResolvedValue(members);
    listPendingEventJoinRequests.mockResolvedValue([joinRequest]);
    createGroup.mockResolvedValue({ id: 'group-2' });
    createGroupInvite.mockResolvedValue({ ...invite, id: 'invite-2', token: 'new-token' });
    createGroupLocation.mockResolvedValue({ ...location, id: 'location-2', name: 'Community Hall' });
    archiveGroupLocation.mockResolvedValue(undefined);
    deactivateGroupInvite.mockResolvedValue(undefined);
    leaveGroup.mockResolvedValue(undefined);
    removeGroupMember.mockResolvedValue(undefined);
    reviewEventJoinRequest.mockResolvedValue('event-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the signed-in user groups and admin invite links', async () => {
    renderGroups();

    expect(await screen.findByText('Board games and one-shots.')).toBeInTheDocument();
    expect(await screen.findByText(/#\/join\/invite-token/)).toBeInTheDocument();
    expect(await screen.findByText('The Game Room')).toBeInTheDocument();
    expect(listUserGroups).toHaveBeenCalledWith('user-1');
    expect(listGroupInvites).toHaveBeenCalledWith('group-1');
    expect(listGroupLocations).toHaveBeenCalledWith('group-1');
    expect(listGroupMembers).toHaveBeenCalledWith('group-1');
    expect(listPendingEventJoinRequests).toHaveBeenCalledWith('group-1');
  });

  it('shows guild members and lets admins remove other members', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderGroups();

    expect(await screen.findByText('Quest Keeper')).toBeInTheDocument();
    expect(await screen.findByText('Map Maker')).toBeInTheDocument();
    const memberCard = screen.getByText('Map Maker').closest('article');
    if (!memberCard) throw new Error('Expected member card.');
    fireEvent.click(within(memberCard).getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      expect(removeGroupMember).toHaveBeenCalledWith('group-1', 'user-2');
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Map Maker'));
    expect(await screen.findByText('Member removed.')).toBeInTheDocument();
    expect(screen.queryByText('Map Maker')).not.toBeInTheDocument();
  });

  it('does not let guild admins leave guilds themselves', async () => {
    renderGroups();

    expect(await screen.findByText('Board games and one-shots.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /leave guild/i })).not.toBeInTheDocument();
  });

  it('lets members leave guilds', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    listUserGroups.mockResolvedValueOnce([regularGroup]).mockResolvedValueOnce([]);
    listGroupInvites.mockResolvedValue([]);
    listPendingEventJoinRequests.mockResolvedValue([]);

    renderGroups();

    await screen.findByText('Board games and one-shots.');
    fireEvent.click(screen.getByRole('button', { name: /leave guild/i }));

    await waitFor(() => {
      expect(leaveGroup).toHaveBeenCalledWith('group-1');
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Friday Night Guild'));
    expect(await screen.findByText('Left guild.')).toBeInTheDocument();
    expect(await screen.findByText(/create a guild or join one/i)).toBeInTheDocument();
  });

  it('shows pending public event join requests and admits them', async () => {
    renderGroups();

    expect(await screen.findByText('New Adventurer')).toBeInTheDocument();
    expect(screen.getByText(/Open painting night/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Admit' }));

    await waitFor(() => {
      expect(reviewEventJoinRequest).toHaveBeenCalledWith('request-1', 'approved');
    });
    expect(await screen.findByText('Join request admitted.')).toBeInTheDocument();
    expect(screen.queryByText('New Adventurer')).not.toBeInTheDocument();
  });

  it('creates a group for the current user', async () => {
    listUserGroups.mockResolvedValueOnce([adminGroup]).mockResolvedValueOnce([
      adminGroup,
      {
        ...adminGroup,
        id: 'group-2',
        name: 'Mini Painting Crew',
        theme: 'Mini Painting',
      },
    ]);

    renderGroups();

    fireEvent.change(screen.getByLabelText(/guild name/i), { target: { value: 'Mini Painting Crew' } });
    fireEvent.change(screen.getByLabelText(/theme/i), { target: { value: 'Mini Painting' } });
    fireEvent.click(screen.getByRole('button', { name: /create guild/i }));

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith({
        name: 'Mini Painting Crew',
        description: '',
        theme: 'Mini Painting',
        createdBy: 'user-1',
      });
    });
    expect(await screen.findByText(/guild created/i)).toBeInTheDocument();
  });

  it('creates and disables reusable invite links', async () => {
    renderGroups();

    await screen.findByText('Board games and one-shots.');
    fireEvent.change(screen.getByLabelText(/max uses/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /create invite/i }));

    await waitFor(() => {
      expect(createGroupInvite).toHaveBeenCalledWith({
        groupId: 'group-1',
        createdBy: 'user-1',
        expiresAt: null,
        maxUses: 3,
      });
    });
    expect(await screen.findByText(/#\/join\/new-token/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /disable/i })[0]);
    await waitFor(() => {
      expect(deactivateGroupInvite).toHaveBeenCalledWith('invite-2');
    });
  });

  it('archives guilds for guild admins', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    listUserGroups.mockResolvedValueOnce([adminGroup]).mockResolvedValueOnce([]);

    renderGroups();

    await screen.findByText('Board games and one-shots.');
    fireEvent.click(screen.getByRole('button', { name: /archive guild/i }));

    await waitFor(() => {
      expect(archiveGroup).toHaveBeenCalledWith('group-1');
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Friday Night Guild'));
    expect(await screen.findByText('Guild archived.')).toBeInTheDocument();
    expect(await screen.findByText(/create a guild or join one/i)).toBeInTheDocument();
  });

  it('does not show guild archive actions to regular members', async () => {
    listUserGroups.mockResolvedValue([{ ...adminGroup, role: 'regular' }]);

    renderGroups();

    expect(await screen.findByText('Board games and one-shots.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive guild/i })).not.toBeInTheDocument();
  });

  it('creates and archives reusable locations', async () => {
    renderGroups();

    await screen.findByText('The Game Room');
    fireEvent.change(screen.getByLabelText(/location name/i), { target: { value: 'Community Hall' } });
    fireEvent.change(screen.getByLabelText(/address/i), { target: { value: 'Main Street 5' } });
    fireEvent.change(screen.getByLabelText(/map url/i), { target: { value: 'https://maps.example/community' } });
    fireEvent.change(screen.getByLabelText(/notes/i), { target: { value: 'Use the north entrance.' } });
    fireEvent.click(screen.getByRole('button', { name: /save location/i }));

    await waitFor(() => {
      expect(createGroupLocation).toHaveBeenCalledWith({
        groupId: 'group-1',
        createdBy: 'user-1',
        name: 'Community Hall',
        address: 'Main Street 5',
        latitude: null,
        longitude: null,
        mapUrl: 'https://maps.example/community',
        notes: 'Use the north entrance.',
      });
    });
    expect(await screen.findByText('Location saved.')).toBeInTheDocument();

    const existingLocationCard = screen.getByText('The Game Room').closest('article');
    if (!existingLocationCard) throw new Error('Expected existing location card.');
    fireEvent.click(within(existingLocationCard).getByRole('button', { name: /archive/i }));
    await waitFor(() => {
      expect(archiveGroupLocation).toHaveBeenCalledWith('location-1');
    });
  });
});
