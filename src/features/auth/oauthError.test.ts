import { describe, expect, it } from 'vitest';
import { getOAuthCodeFromLocation, getOAuthErrorFromLocation, hasOAuthCallbackParams } from './oauthError';

describe('getOAuthErrorFromLocation', () => {
  it('reads OAuth errors from the query string', () => {
    expect(getOAuthErrorFromLocation({ hash: '', search: '?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+miAD' })).toEqual({
      code: 'unexpected_failure',
      description: 'Unable to exchange external code: miAD',
    });
  });

  it('reads OAuth errors from a bare hash fragment', () => {
    expect(getOAuthErrorFromLocation({ hash: '#error=server_error&error_description=Unable+to+exchange+external+code%253A+miAD', search: '' })).toEqual({
      code: 'server_error',
      description: 'Unable to exchange external code: miAD',
    });
  });

  it('reads OAuth errors from the hash-router callback query', () => {
    expect(getOAuthErrorFromLocation({ hash: '#/auth/callback?error=access_denied&error_description=User+cancelled', search: '' })).toEqual({
      code: 'access_denied',
      description: 'User cancelled',
    });
  });
});

describe('OAuth callback helpers', () => {
  it('detects callback params in either the URL query or the hash-router query', () => {
    expect(hasOAuthCallbackParams({ hash: '', search: '?code=query-code' })).toBe(true);
    expect(hasOAuthCallbackParams({ hash: '#/auth/callback?auth_callback=1', search: '' })).toBe(true);
    expect(hasOAuthCallbackParams({ hash: '#/login', search: '' })).toBe(false);
  });

  it('reads the authorization code from either callback location', () => {
    expect(getOAuthCodeFromLocation({ hash: '', search: '?code=query-code' })).toBe('query-code');
    expect(getOAuthCodeFromLocation({ hash: '#/auth/callback?code=hash-code', search: '' })).toBe('hash-code');
  });
});
