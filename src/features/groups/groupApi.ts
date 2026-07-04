import { supabase } from '../../lib/supabase';

export type GroupRole = 'group_admin' | 'regular';

export type GroupSummary = {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  created_at: string;
  role: GroupRole;
  joined_at: string;
};

export type GroupInvite = {
  id: string;
  group_id: string;
  token: string;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
};

export type GroupLocation = {
  id: string;
  group_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
};

export type EventJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export type EventJoinRequest = {
  id: string;
  event_id: string;
  requester_id: string;
  status: EventJoinRequestStatus;
  created_at: string;
  reviewed_at: string | null;
  events: {
    id: string;
    title: string;
    start_at: string;
    timezone: string;
    group_id: string;
  } | null;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

type GroupMembershipRow = {
  role: GroupRole;
  joined_at: string;
  groups: {
    id: string;
    name: string;
    description: string | null;
    theme: string | null;
    created_at: string;
    archived_at: string | null;
  } | null;
};

type CreateGroupInput = {
  name: string;
  description?: string;
  theme?: string;
  createdBy: string;
};

type CreateInviteInput = {
  groupId: string;
  createdBy: string;
  expiresAt?: string | null;
  maxUses?: number | null;
};

type CreateLocationInput = {
  groupId: string;
  createdBy: string;
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  mapUrl?: string;
  notes?: string;
};

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function createInviteToken() {
  const randomValues = new Uint8Array(16);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues, (value) => value.toString(16).padStart(2, '0')).join('');
}

export async function listUserGroups(userId: string): Promise<GroupSummary[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(
      `
        role,
        joined_at,
        groups (
          id,
          name,
          description,
          theme,
          created_at,
          archived_at
        )
      `,
    )
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as GroupMembershipRow[])
    .filter((row) => row.groups && !row.groups.archived_at)
    .map((row) => ({
      id: row.groups!.id,
      name: row.groups!.name,
      description: row.groups!.description,
      theme: row.groups!.theme,
      created_at: row.groups!.created_at,
      role: row.role,
      joined_at: row.joined_at,
    }));
}

export async function createGroup({ name, description, theme, createdBy }: CreateGroupInput) {
  const { data, error } = await supabase.rpc('create_group_with_defaults', {
    group_name: name.trim(),
    group_description: normalizeOptionalText(description),
    group_theme: normalizeOptionalText(theme),
    group_created_by: createdBy,
  });

  if (error) throw error;

  return { id: data as string };
}

export async function archiveGroup(groupId: string) {
  const { error } = await supabase.rpc('archive_group', { target_group_id: groupId });

  if (error) throw error;
}

export async function listGroupInvites(groupId: string): Promise<GroupInvite[]> {
  const { data, error } = await supabase
    .from('group_invites')
    .select('id, group_id, token, expires_at, max_uses, used_count, is_active, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []) as GroupInvite[];
}

export async function createGroupInvite({ groupId, createdBy, expiresAt, maxUses }: CreateInviteInput) {
  const { data, error } = await supabase
    .from('group_invites')
    .insert({
      group_id: groupId,
      token: createInviteToken(),
      created_by: createdBy,
      expires_at: expiresAt ?? null,
      max_uses: maxUses ?? null,
    })
    .select('id, group_id, token, expires_at, max_uses, used_count, is_active, created_at')
    .single();

  if (error) throw error;

  return data as GroupInvite;
}

export async function deactivateGroupInvite(inviteId: string) {
  const { error } = await supabase.from('group_invites').update({ is_active: false }).eq('id', inviteId);

  if (error) throw error;
}

export async function acceptGroupInvite(inviteToken: string) {
  const { data, error } = await supabase.rpc('accept_group_invite', { invite_token: inviteToken });

  if (error) throw error;

  return data as string;
}

export async function listGroupLocations(groupId: string): Promise<GroupLocation[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, group_id, name, address, latitude, longitude, map_url, notes, created_by, created_at, archived_at')
    .eq('group_id', groupId)
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? []) as GroupLocation[];
}

export async function createGroupLocation({ groupId, createdBy, name, address, latitude, longitude, mapUrl, notes }: CreateLocationInput) {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      group_id: groupId,
      created_by: createdBy,
      name: name.trim(),
      address: normalizeOptionalText(address),
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      map_url: normalizeOptionalText(mapUrl),
      notes: normalizeOptionalText(notes),
    })
    .select('id, group_id, name, address, latitude, longitude, map_url, notes, created_by, created_at, archived_at')
    .single();

  if (error) throw error;

  return data as GroupLocation;
}

export async function archiveGroupLocation(locationId: string) {
  const { error } = await supabase
    .from('locations')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', locationId);

  if (error) throw error;
}

export async function listPendingEventJoinRequests(groupId: string): Promise<EventJoinRequest[]> {
  const { data, error } = await supabase
    .from('event_join_requests')
    .select(
      `
        id,
        event_id,
        requester_id,
        status,
        created_at,
        reviewed_at,
        events!inner (
          id,
          title,
          start_at,
          timezone,
          group_id
        ),
        profiles!event_join_requests_requester_id_fkey (
          display_name,
          avatar_url
        )
      `,
    )
    .eq('status', 'pending')
    .eq('events.group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as unknown as EventJoinRequest[];
}

export async function reviewEventJoinRequest(requestId: string, status: Extract<EventJoinRequestStatus, 'approved' | 'rejected'>) {
  const { data, error } = await supabase.rpc('review_event_join_request', {
    request_id: requestId,
    next_status: status,
  });

  if (error) throw error;

  return data as string;
}
