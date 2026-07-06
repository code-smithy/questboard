import { supabase, supabaseUrl } from '../../lib/supabase';
import { normalizeTimezone } from '../../lib/timezones';
import type { Profile } from '../auth/types';

export type CalendarFeedScope = 'rsvp' | 'visible';

export type CalendarFeed = {
  id: string;
  owner_id: string;
  token: string;
  scope: CalendarFeedScope;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
};

const calendarFeedColumns = 'id, owner_id, token, scope, is_active, created_at, updated_at, last_accessed_at';

export async function updateOwnProfileDisplayName(profileId: string, displayName: string) {
  const trimmedDisplayName = displayName.trim();

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: trimmedDisplayName })
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function updateOwnProfileDefaultEventDuration(profileId: string, durationHours: number) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ default_event_duration_hours: durationHours })
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function updateOwnProfileTimezone(profileId: string, timezone: string) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ timezone: normalizeTimezone(timezone) })
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}

export async function getOwnCalendarFeed(profileId: string) {
  const { data, error } = await supabase
    .from('calendar_feeds')
    .select(calendarFeedColumns)
    .eq('owner_id', profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CalendarFeed | null;
}

export async function ensureOwnCalendarFeed(scope: CalendarFeedScope) {
  const { data, error } = await supabase.rpc('ensure_own_calendar_feed', { feed_scope: scope });

  if (error) {
    throw error;
  }

  return data as CalendarFeed;
}

export async function regenerateOwnCalendarFeed() {
  const { data, error } = await supabase.rpc('regenerate_own_calendar_feed');

  if (error) {
    throw error;
  }

  return data as CalendarFeed;
}

export async function disableOwnCalendarFeed() {
  const { error } = await supabase.rpc('disable_own_calendar_feed');

  if (error) {
    throw error;
  }
}

export function getCalendarFeedUrl(token: string) {
  return `${supabaseUrl}/functions/v1/calendar-feed/${encodeURIComponent(token)}.ics`;
}
