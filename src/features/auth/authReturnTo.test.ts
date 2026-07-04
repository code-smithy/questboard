import { describe, expect, it, vi } from 'vitest';
import { consumeAuthReturnTo, saveAuthReturnTo } from './authReturnTo';

function createStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: vi.fn(() => value),
    removeItem: vi.fn(() => {
      value = null;
    }),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
  };
}

describe('auth return-to storage', () => {
  it('saves and consumes safe app paths', () => {
    const storage = createStorage();

    saveAuthReturnTo('/join/invite-token', storage);

    expect(storage.setItem).toHaveBeenCalledWith('questboard.authReturnTo', '/join/invite-token');
    expect(consumeAuthReturnTo(storage)).toBe('/join/invite-token');
    expect(storage.removeItem).toHaveBeenCalledWith('questboard.authReturnTo');
  });

  it('ignores absolute or protocol-relative paths', () => {
    const storage = createStorage('https://evil.example');

    saveAuthReturnTo('https://evil.example', storage);
    saveAuthReturnTo('//evil.example', storage);

    expect(storage.setItem).not.toHaveBeenCalled();
    expect(consumeAuthReturnTo(storage)).toBeNull();
  });
});
