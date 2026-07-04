import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/AuthContext';
import type { AuthState } from '../auth/AuthContext';
import { GroupsPage } from './GroupsPage';
import type { GroupInvite, GroupSummary } from './groupApi';

const {
  archiveGroupLocation,
  createGroup,
  createGroupInvite,
  createGroupLocation,
  deactivateGroupInvite,
  listGroupInvites,
  listGroupLocations,
  listUserGroups,
} = vi.hoisted(() => ({
  archiveGroupLocation: vi.fn(),
  createGroup: vi.fn(),
  createGroupInvite: vi.fn(),
  createGroupLocation: vi.fn(),
  deactivateGroupInvite: vi.fn(),
  listGroupInvites: vi.fn(),
  listGroupLocations: vi.fn(),
  listUserGroups: vi.fn(),
}));

vi.mock('./groupApi', () => ({
  archiveGroupLocation,
  createGroup,
  createGroupInvite,
  createGroupLocation,
  deactivateGroupInvite,
  listGroupInvites,
  listGroupLocations,
  listUserGroups,
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
    archiveGroupLocation.mockReset();
    createGroup.mockReset();
    createGroupInvite.mockReset();
    createGroupLocation.mockReset();
    deactivateGroupInvite.mockReset();
    listGroupInvites.mockReset();
    listGroupLocations.mockReset();
    listUserGroups.mockReset();

    listUserGroups.mockResolvedValue([adminGroup]);
    listGroupInvites.mockResolvedValue([invite]);
    listGroupLocations.mockResolvedValue([location]);
    createGroup.mockResolvedValue({ id: 'group-2' });
    createGroupInvite.mockResolvedValue({ ...invite, id: 'invite-2', token: 'new-token' });
    createGroupLocation.mockResolvedValue({ ...location, id: 'location-2', name: 'Community Hall' });
    archiveGroupLocation.mockResolvedValue(undefined);
    deactivateGroupInvite.mockResolvedValue(undefined);
  });

  it('lists the signed-in user groups and admin invite links', async () => {
    renderGroups();

    expect(await screen.findByText('Board games and one-shots.')).toBeInTheDocument();
    expect(await screen.findByText(/#\/join\/invite-token/)).toBeInTheDocument();
    expect(await screen.findByText('The Game Room')).toBeInTheDocument();
    expect(listUserGroups).toHaveBeenCalledWith('user-1');
    expect(listGroupInvites).toHaveBeenCalledWith('group-1');
    expect(listGroupLocations).toHaveBeenCalledWith('group-1');
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
