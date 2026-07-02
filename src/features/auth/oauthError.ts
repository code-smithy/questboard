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

export function getOAuthErrorFromLocation(location: Pick<Location, 'hash' | 'search'> = window.location) {
  const searchError = readOAuthError(new URLSearchParams(location.search));
  if (searchError) return searchError;

  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  return readOAuthError(new URLSearchParams(hash));
}
