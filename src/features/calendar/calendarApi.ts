import { supabase } from '../../lib/supabase';
import { listUserGroups } from '../groups/groupApi';
import type { GroupSummary } from '../groups/groupApi';

export type CalendarEventMode = 'online' | 'offline' | 'hybrid';
export type CalendarEventStatus = 'draft' | 'open' | 'confirmed' | 'cancelled' | 'archived';
export type CalendarEventVisibility = 'private' | 'public';

export type CalendarEvent = {
  id: string;
  group_id: string;
  group_name: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  mode: CalendarEventMode;
  minimum_attendees: number;
  maximum_attendees: number | null;
  visibility: CalendarEventVisibility;
  status: CalendarEventStatus;
  category: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
  } | null;
  rsvps: Array<{ user_id: string; status: 'attending' | 'maybe' | 'declined' }>;
};

type CalendarEventRow = Omit<CalendarEvent, 'category' | 'rsvps'> & {
  categories: CalendarEvent['category'];
  event_rsvps: CalendarEvent['rsvps'];
};

export type CalendarReadModel = {
  groups: GroupSummary[];
  events: CalendarEvent[];
};

export async function getCalendarReadModel(userId: string): Promise<CalendarReadModel> {
  const groups = await listUserGroups(userId);
  const groupIds = groups.map((group) => group.id);
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  if (!groupIds.length) {
    return { groups, events: [] };
  }

  const { data, error } = await supabase
    .from('events')
    .select(
      `
        id,
        group_id,
        title,
        description,
        start_at,
        end_at,
        timezone,
        mode,
        minimum_attendees,
        maximum_attendees,
        visibility,
        status,
        categories (
          id,
          name,
          color,
          icon
        ),
        event_rsvps (
          user_id,
          status
        )
      `,
    )
    .in('group_id', groupIds)
    .is('archived_at', null)
    .neq('status', 'archived')
    .order('start_at', { ascending: true });

  if (error) throw error;

  const events = ((data ?? []) as unknown as CalendarEventRow[]).map((event) => ({
    id: event.id,
    group_id: event.group_id,
    group_name: groupNameById.get(event.group_id) ?? event.group_id,
    title: event.title,
    description: event.description,
    start_at: event.start_at,
    end_at: event.end_at,
    timezone: event.timezone,
    mode: event.mode,
    minimum_attendees: event.minimum_attendees,
    maximum_attendees: event.maximum_attendees,
    visibility: event.visibility,
    status: event.status,
    category: event.categories,
    rsvps: event.event_rsvps ?? [],
  }));

  return { groups, events };
}
