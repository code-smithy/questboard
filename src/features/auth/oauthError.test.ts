import { describe, expect, it } from 'vitest';
import { getOAuthErrorFromLocation } from './oauthError';

describe('getOAuthErrorFromLocation', () => {
  it('reads OAuth errors from the query string', () => {
    expect(getOAuthErrorFromLocation({ hash: '', search: '?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code%3A+miAD' })).toEqual({
      code: 'unexpected_failure',
      description: 'Unable to exchange external code: miAD',
    });
  });

  it('reads OAuth errors from the hash fragment', () => {
    expect(getOAuthErrorFromLocation({ hash: '#error=server_error&error_description=Unable+to+exchange+external+code%253A+miAD', search: '' })).toEqual({
      code: 'server_error',
      description: 'Unable to exchange external code: miAD',
    });
  });
});
