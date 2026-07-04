import { supabase } from '../../lib/supabase';
import type { GroupLocation } from '../groups/groupApi';

export type EventMode = 'online' | 'offline' | 'hybrid';
export type EventStatus = 'draft' | 'open' | 'confirmed' | 'cancelled' | 'archived';
export type EventVisibility = 'private' | 'public';
export type EventRsvpStatus = 'attending' | 'maybe' | 'declined';

export type EventCategory = {
  id: string;
  group_id: string;
  name: string;
  color: string;
  icon: string | null;
};

export type QuestEvent = {
  id: string;
  group_id: string;
  category_id: string | null;
  location_id: string | null;
  owner_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  mode: EventMode;
  location_text: string | null;
  online_details: { platform?: string; url?: string; instructions?: string };
  minimum_attendees: number;
  maximum_attendees: number | null;
  visibility: EventVisibility;
  status: EventStatus;
  archived_at: string | null;
  categories: Pick<EventCategory, 'id' | 'name' | 'color' | 'icon'> | null;
  locations: Pick<GroupLocation, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'map_url' | 'notes'> | null;
  event_rsvps: EventRsvp[];
  event_comments: EventComment[];
  event_history: EventHistoryEntry[];
};

export type EventRsvp = {
  id: string;
  event_id: string;
  user_id: string;
  status: EventRsvpStatus;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type EventComment = {
  id: string;
  event_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type EventHistoryEntry = {
  id: string;
  event_id: string;
  changed_by: string | null;
  change_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

export type EventHistoryInput = {
  eventId: string;
  changedBy: string | null;
  changeType: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
};

export type AttendanceSummary = {
  attendingCount: number;
  maybeCount: number;
  declinedCount: number;
  remainingMinimum: number;
  isMinimumReached: boolean;
  isFull: boolean;
  label: string;
};

export type EventFormInput = {
  groupId: string;
  categoryId: string | null;
  locationId: string | null;
  ownerId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  timezone: string;
  mode: EventMode;
  locationText: string;
  onlinePlatform: string;
  onlineUrl: string;
  onlineInstructions: string;
  minimumAttendees: number;
  maximumAttendees: number | null;
  visibility: EventVisibility;
  status: Exclude<EventStatus, 'archived'>;
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toPayload(input: EventFormInput) {
  return {
    group_id: input.groupId,
    category_id: input.categoryId,
    location_id: input.locationId,
    owner_id: input.ownerId,
    title: input.title.trim(),
    description: optionalText(input.description),
    start_at: input.startAt,
    end_at: input.endAt,
    timezone: input.timezone.trim() || 'UTC',
    mode: input.mode,
    location_text: optionalText(input.locationText),
    online_details: {
      platform: optionalText(input.onlinePlatform),
      url: optionalText(input.onlineUrl),
      instructions: optionalText(input.onlineInstructions),
    },
    minimum_attendees: input.minimumAttendees,
    maximum_attendees: input.maximumAttendees,
    visibility: input.visibility,
    status: input.status,
  };
}

export function getAttendanceSummary(input: {
  rsvps: Array<{ status: EventRsvpStatus }>;
  minimumAttendees: number;
  maximumAttendees: number | null;
  status: EventStatus;
}): AttendanceSummary {
  const attendingCount = input.rsvps.filter((rsvp) => rsvp.status === 'attending').length;
  const maybeCount = input.rsvps.filter((rsvp) => rsvp.status === 'maybe').length;
  const declinedCount = input.rsvps.filter((rsvp) => rsvp.status === 'declined').length;
  const remainingMinimum = Math.max(input.minimumAttendees - attendingCount, 0);
  const isMinimumReached = remainingMinimum === 0;
  const isFull = input.maximumAttendees !== null && attendingCount >= input.maximumAttendees;
  const spotsLabel = input.maximumAttendees ? `${attendingCount}/${input.maximumAttendees} seats` : `${attendingCount} attending`;

  if (input.status === 'cancelled') {
    return { attendingCount, maybeCount, declinedCount, remainingMinimum, isMinimumReached, isFull, label: `${spotsLabel} - Cancelled` };
  }

  if (isFull) {
    return { attendingCount, maybeCount, declinedCount, remainingMinimum, isMinimumReached, isFull, label: `${spotsLabel} - Full` };
  }

  if (isMinimumReached) {
    return { attendingCount, maybeCount, declinedCount, remainingMinimum, isMinimumReached, isFull, label: `${spotsLabel} - Minimum reached` };
  }

  return { attendingCount, maybeCount, declinedCount, remainingMinimum, isMinimumReached, isFull, label: `${spotsLabel} - Needs ${remainingMinimum} more` };
}

export async function listGroupCategories(groupId: string): Promise<EventCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, group_id, name, color, icon')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;

  return (data ?? []) as EventCategory[];
}

export async function createEvent(input: EventFormInput) {
  const { data, error } = await supabase
    .from('events')
    .insert(toPayload(input))
    .select('id')
    .single();

  if (error) throw error;

  return { id: data.id as string };
}

export async function getEvent(eventId: string): Promise<QuestEvent> {
  const { data, error } = await supabase
    .from('events')
    .select(
      `
        id,
        group_id,
        category_id,
        location_id,
        owner_id,
        title,
        description,
        start_at,
        end_at,
        timezone,
        mode,
        location_text,
        online_details,
        minimum_attendees,
        maximum_attendees,
        visibility,
        status,
        archived_at,
        categories (
          id,
          name,
          color,
          icon
        ),
        locations (
          id,
          name,
          address,
          latitude,
          longitude,
          map_url,
          notes
        ),
        event_rsvps (
          id,
          event_id,
          user_id,
          status,
          profiles (
            display_name,
            avatar_url
          )
        ),
        event_comments (
          id,
          event_id,
          user_id,
          body,
          created_at,
          updated_at,
          archived_at,
          profiles (
            display_name,
            avatar_url
          )
        ),
        event_history (
          id,
          event_id,
          changed_by,
          change_type,
          old_value,
          new_value,
          created_at,
          profiles (
            display_name,
            avatar_url
          )
        )
      `,
    )
    .eq('id', eventId)
    .single();

  if (error) throw error;

  const row = data as unknown as Omit<QuestEvent, 'categories' | 'locations' | 'event_rsvps' | 'event_comments' | 'event_history'> & {
    categories: QuestEvent['categories'] | QuestEvent['categories'][];
    locations: QuestEvent['locations'] | QuestEvent['locations'][];
    event_rsvps: EventRsvp[] | null;
    event_comments: EventComment[] | null;
    event_history: EventHistoryEntry[] | null;
  };

  return {
    ...row,
    categories: Array.isArray(row.categories) ? row.categories[0] ?? null : row.categories,
    locations: Array.isArray(row.locations) ? row.locations[0] ?? null : row.locations,
    event_rsvps: row.event_rsvps ?? [],
    event_comments: (row.event_comments ?? [])
      .filter((comment) => !comment.archived_at)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    event_history: (row.event_history ?? [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}

export async function updateEvent(eventId: string, input: EventFormInput) {
  const { error } = await supabase
    .from('events')
    .update(toPayload(input))
    .eq('id', eventId);

  if (error) throw error;
}

export async function archiveEvent(eventId: string) {
  const { error } = await supabase
    .from('events')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', eventId);

  if (error) throw error;
}

export async function setEventRsvp(eventId: string, userId: string, status: EventRsvpStatus) {
  const { error } = await supabase
    .from('event_rsvps')
    .upsert({ event_id: eventId, user_id: userId, status }, { onConflict: 'event_id,user_id' });

  if (error) throw error;
}

export async function addEventComment(eventId: string, userId: string, body: string) {
  const trimmedBody = body.trim();
  if (!trimmedBody) throw new Error('Write a comment before posting.');

  const { error } = await supabase
    .from('event_comments')
    .insert({ event_id: eventId, user_id: userId, body: trimmedBody });

  if (error) throw error;
}

export async function archiveEventComment(commentId: string) {
  const { error } = await supabase
    .from('event_comments')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', commentId);

  if (error) throw error;
}

export async function recordEventHistory({ eventId, changedBy, changeType, oldValue = null, newValue = null }: EventHistoryInput) {
  const { error } = await supabase
    .from('event_history')
    .insert({
      event_id: eventId,
      changed_by: changedBy,
      change_type: changeType,
      old_value: oldValue,
      new_value: newValue,
    });

  if (error) throw error;
}
