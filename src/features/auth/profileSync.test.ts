import type { SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { getAvatarUrl, getDiscordUserId, getDisplayName, upsertProfileForUser } from './profileSync';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    user_metadata: {},
    ...overrides,
  } as User;
}

describe('profile sync helpers', () => {
  it('prefers Discord metadata for profile display values', () => {
    const user = makeUser({
      email: 'fallback@example.com',
      user_metadata: {
        full_name: '  Sir Corgi  ',
        name: 'Ignored Name',
        provider_id: '123456789012345678',
        avatar_url: 'https://cdn.example/avatar.png',
      },
    });

    expect(getDisplayName(user)).toBe('Sir Corgi');
    expect(getDiscordUserId(user)).toBe('123456789012345678');
    expect(getAvatarUrl(user)).toBe('https://cdn.example/avatar.png');
  });

  it('falls back through common Supabase Discord identity fields', () => {
    const user = makeUser({
      email: 'bard@example.com',
      user_metadata: { picture: 'https://cdn.example/picture.png' },
      identities: [
        {
          id: 'identity-row-id',
          identity_id: 'identity-uuid',
          user_id: 'user-1',
          provider: 'discord',
          identity_data: { sub: '987654321098765432' },
        },
      ] as User['identities'],
    });

    expect(getDisplayName(user)).toBe('bard@example.com');
    expect(getDiscordUserId(user)).toBe('identity-row-id');
    expect(getAvatarUrl(user)).toBe('https://cdn.example/picture.png');
  });

  it('syncs Discord profile fields without overwriting the shown display name', async () => {
    const savedProfile = {
      id: 'user-1',
      discord_user_id: '123456789012345678',
      display_name: 'Quest Keeper',
      synced_display_name: 'Discord Keeper',
      avatar_url: null,
      created_at: '2026-01-01T00:00:00Z',
      last_seen_at: '2026-01-02T00:00:00Z',
      is_site_admin: false,
      default_event_duration_hours: 4,
      timezone: null,
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: savedProfile, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const supabase = { from } as unknown as SupabaseClient;

    await expect(upsertProfileForUser(supabase, makeUser({
      user_metadata: { name: 'Quest Keeper', provider_id: '123456789012345678' },
    }))).resolves.toEqual(savedProfile);

    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        discord_user_id: '123456789012345678',
        synced_display_name: 'Quest Keeper',
        avatar_url: null,
      }),
    );
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('inserts a profile with matching shown and synced names when none exists yet', async () => {
    const savedProfile = {
      id: 'user-1',
      discord_user_id: '123456789012345678',
      display_name: 'Quest Keeper',
      synced_display_name: 'Quest Keeper',
      avatar_url: null,
      created_at: '2026-01-01T00:00:00Z',
      last_seen_at: '2026-01-02T00:00:00Z',
      is_site_admin: false,
      default_event_duration_hours: 4,
      timezone: null,
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSelect = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq });
    const single = vi.fn().mockResolvedValue({ data: savedProfile, error: null });
    const insertSelect = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const from = vi.fn().mockReturnValue({ update, insert });
    const supabase = { from } as unknown as SupabaseClient;

    await expect(upsertProfileForUser(supabase, makeUser({
      user_metadata: { name: 'Quest Keeper', provider_id: '123456789012345678' },
    }))).resolves.toEqual(savedProfile);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-1',
      discord_user_id: '123456789012345678',
      display_name: 'Quest Keeper',
      synced_display_name: 'Quest Keeper',
      avatar_url: null,
    }));
  });
});
