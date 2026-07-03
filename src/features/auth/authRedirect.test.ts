import { describe, expect, it } from 'vitest';
import { getAuthRedirectUrl } from './authRedirect';

describe('getAuthRedirectUrl', () => {
  it('builds a redirect URL from the current origin and deployment base path', () => {
    expect(getAuthRedirectUrl('https://owner.github.io', '/questboard/')).toBe('https://owner.github.io/questboard/#/auth/callback?auth_callback=1');
  });

  it('supports root-hosted pages and custom domains', () => {
    expect(getAuthRedirectUrl('https://events.example.com', '/')).toBe('https://events.example.com/#/auth/callback?auth_callback=1');
  });
});
