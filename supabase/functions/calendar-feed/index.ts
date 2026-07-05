import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

type CalendarFeedEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  status: 'open' | 'confirmed' | 'cancelled';
  recurrence_rule: string | null;
  updated_at: string;
  location_text: string | null;
  online_details: { platform?: string | null; url?: string | null; instructions?: string | null } | null;
  group_name: string;
  category_name: string | null;
  location_name: string | null;
  location_address: string | null;
};

function toIcsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldIcsLine(line: string) {
  const chunks: string[] = [];
  let remaining = line;

  while (remaining.length > 75) {
    chunks.push(remaining.slice(0, 75));
    remaining = ` ${remaining.slice(75)}`;
  }

  chunks.push(remaining);
  return chunks.join('\r\n');
}

function getLocation(event: CalendarFeedEvent) {
  return [
    event.location_name,
    event.location_address,
    event.location_text,
  ].filter(Boolean).join(', ');
}

function buildCalendarFeed(events: CalendarFeedEvent[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Questboard//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Questboard',
  ];

  for (const event of events) {
    const onlineDetails = event.online_details ?? {};
    const descriptionParts = [
      event.description,
      event.group_name ? `Guild: ${event.group_name}` : null,
      event.category_name ? `Category: ${event.category_name}` : null,
      onlineDetails.instructions,
    ].filter((part): part is string => Boolean(part));
    const location = getLocation(event);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@questboard`,
      `DTSTAMP:${toIcsDate(event.updated_at)}`,
      `LAST-MODIFIED:${toIcsDate(event.updated_at)}`,
      `DTSTART:${toIcsDate(event.start_at)}`,
      `DTEND:${toIcsDate(event.end_at)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
    );

    if (event.status === 'cancelled') lines.push('STATUS:CANCELLED');
    if (descriptionParts.length) lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n\n'))}`);
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    if (onlineDetails.url) lines.push(`URL:${onlineDetails.url}`);
    if (event.recurrence_rule) lines.push(`RRULE:${event.recurrence_rule}`);

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const pathToken = url.pathname.split('/').filter(Boolean).pop()?.replace(/\.ics$/, '');
  const token = url.searchParams.get('token') ?? pathToken;

  if (!token) {
    return new Response('Missing calendar feed token.', { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Calendar feed is not configured.', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc('get_calendar_feed_events', { feed_token: token });

  if (error) {
    console.error('Questboard calendar feed failed', error);
    return new Response('Calendar feed could not be loaded.', { status: 500 });
  }

  return new Response(buildCalendarFeed((data ?? []) as CalendarFeedEvent[]), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
    },
  });
});
