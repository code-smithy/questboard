const AUTH_RETURN_TO_KEY = 'questboard.authReturnTo';

function isSafeReturnPath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

export function saveAuthReturnTo(path: string, storage: Pick<Storage, 'setItem'> = window.sessionStorage) {
  if (isSafeReturnPath(path)) {
    storage.setItem(AUTH_RETURN_TO_KEY, path);
  }
}

export function consumeAuthReturnTo(storage: Pick<Storage, 'getItem' | 'removeItem'> = window.sessionStorage) {
  const path = storage.getItem(AUTH_RETURN_TO_KEY);
  storage.removeItem(AUTH_RETURN_TO_KEY);

  return path && isSafeReturnPath(path) ? path : null;
}
