import { supabase } from '../../lib/supabase';
import type { CalendarEventMode, CalendarEventStatus } from '../calendar/calendarApi';

export type PublicEventCard = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  mode: CalendarEventMode;
  location_text: string | null;
  online_details: { platform?: string | null; url?: string | null; instructions?: string | null };
  minimum_attendees: number;
  maximum_attendees: number | null;
  status: Extract<CalendarEventStatus, 'open' | 'confirmed'>;
  group_id: string;
  group_name: string;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  attending_count: number;
  viewer_is_group_member: boolean;
  current_user_request_status: 'pending' | 'approved' | 'rejected' | null;
};

export async function listPublicEventCards(): Promise<PublicEventCard[]> {
  const { data, error } = await supabase
    .from('public_event_cards')
    .select(
      `
        id,
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
        status,
        group_id,
        group_name,
        category_name,
        category_color,
        category_icon,
        attending_count,
        viewer_is_group_member,
        current_user_request_status
      `,
    )
    .order('start_at', { ascending: true });

  if (error) throw error;

  return (data ?? []) as PublicEventCard[];
}

export async function requestPublicEventJoin(eventId: string) {
  const { data, error } = await supabase.rpc('request_public_event_join', { target_event_id: eventId });

  if (error) throw error;

  return data as string;
}
