import { supabase } from '../../lib/supabase';
import type { Profile } from '../auth/types';

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
