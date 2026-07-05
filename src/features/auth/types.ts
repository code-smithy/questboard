export type Profile = {
  id: string;
  discord_user_id: string | null;
  display_name: string;
  synced_display_name: string;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null;
  is_site_admin: boolean;
  default_event_duration_hours: number;
};
