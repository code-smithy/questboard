import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile } from './types';

function firstTextValue(...values: unknown[]) {
  return values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim();
}

export function getDiscordUserId(user: User) {
  const discordIdentity = user.identities?.find((identity) => identity.provider === 'discord');

  return firstTextValue(
    user.user_metadata.provider_id,
    user.user_metadata.sub,
    discordIdentity?.id,
    discordIdentity?.identity_data?.sub,
  ) ?? null;
}

export function getDisplayName(user: User) {
  return firstTextValue(
    user.user_metadata.full_name,
    user.user_metadata.name,
    user.user_metadata.preferred_username,
    user.email,
  ) ?? 'New adventurer';
}

export function getAvatarUrl(user: User) {
  return firstTextValue(user.user_metadata.avatar_url, user.user_metadata.picture) ?? null;
}

export async function upsertProfileForUser(supabase: SupabaseClient, user: User) {
  const profilePayload = {
    id: user.id,
    discord_user_id: getDiscordUserId(user),
    display_name: getDisplayName(user),
    avatar_url: getAvatarUrl(user),
    last_seen_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Profile;
}
