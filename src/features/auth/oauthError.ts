export type OAuthError = {
  code: string | null;
  description: string;
};

function normalizeOAuthDescription(value: string) {
  const withSpaces = value.replace(/\+/g, ' ');

  try {
    return decodeURIComponent(withSpaces);
  } catch {
    return withSpaces;
  }
}

function readOAuthError(params: URLSearchParams): OAuthError | null {
  const error = params.get('error');
  const description = params.get('error_description');

  if (!error && !description) return null;

  return {
    code: params.get('error_code') ?? error,
    description: description ? normalizeOAuthDescription(description) : error ?? 'The OAuth provider returned an error.',
  };
}

function getHashParams(hashValue: string) {
  const hash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
  const queryStart = hash.indexOf('?');
  const params = queryStart >= 0 ? hash.slice(queryStart + 1) : hash;
  return new URLSearchParams(params);
}

export function getOAuthErrorFromLocation(location: Pick<Location, 'hash' | 'search'> = window.location) {
  const searchError = readOAuthError(new URLSearchParams(location.search));
  if (searchError) return searchError;

  return readOAuthError(getHashParams(location.hash));
}

export function hasOAuthCallbackParams(location: Pick<Location, 'hash' | 'search'> = window.location) {
  const searchParams = new URLSearchParams(location.search);
  const hashParams = getHashParams(location.hash);
  return [searchParams, hashParams].some((params) =>
    ['auth_callback', 'code', 'error', 'error_description'].some((key) => params.has(key)),
  );
}

export function getOAuthCodeFromLocation(location: Pick<Location, 'hash' | 'search'> = window.location) {
  return new URLSearchParams(location.search).get('code') ?? getHashParams(location.hash).get('code');
}
