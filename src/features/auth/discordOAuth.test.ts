import { describe, expect, it } from 'vitest';
import { getInvalidDiscordClientIdMessage } from './discordOAuth';

describe('getInvalidDiscordClientIdMessage', () => {
  it('flags Discord OAuth URLs with a non-snowflake client_id', () => {
    expect(getInvalidDiscordClientIdMessage('https://discord.com/oauth2/authorize?client_id=questboard&response_type=code')).toContain(
      'invalid client ID (questboard)',
    );
  });

  it('allows Discord OAuth URLs with a numeric snowflake client_id', () => {
    expect(getInvalidDiscordClientIdMessage('https://discord.com/oauth2/authorize?client_id=123456789012345678&response_type=code')).toBeNull();
  });

  it('ignores non-Discord URLs and malformed URLs', () => {
    expect(getInvalidDiscordClientIdMessage('https://example.com/oauth2/authorize?client_id=questboard')).toBeNull();
    expect(getInvalidDiscordClientIdMessage('not a url')).toBeNull();
  });
});
