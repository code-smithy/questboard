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

function getHashParamSources(hashValue: string) {
  const hash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
  const nestedHashStart = hash.indexOf('#');
  const routeHash = nestedHashStart >= 0 ? hash.slice(0, nestedHashStart) : hash;
  const nestedHash = nestedHashStart >= 0 ? hash.slice(nestedHashStart + 1) : '';
  const queryStart = routeHash.indexOf('?');
  const routeParams = queryStart >= 0 ? routeHash.slice(queryStart + 1) : routeHash;

  return [new URLSearchParams(routeParams), new URLSearchParams(nestedHash)].filter((params) =>
    Array.from(params).length > 0,
  );
}

function getOAuthParamSources(location: Pick<Location, 'hash' | 'search'>) {
  const searchParams = new URLSearchParams(location.search);
  const hashParamSources = getHashParamSources(location.hash);
  return [searchParams, ...hashParamSources].filter((params) => Array.from(params).length > 0);
}

export function getOAuthErrorFromLocation(location: Pick<Location, 'hash' | 'search'> = window.location) {
  for (const params of getOAuthParamSources(location)) {
    const error = readOAuthError(params);
    if (error) return error;
  }

  return null;
}

export function hasOAuthCallbackParams(location: Pick<Location, 'hash' | 'search'> = window.location) {
  return getOAuthParamSources(location).some((params) =>
    ['auth_callback', 'code', 'error', 'error_description', 'access_token', 'refresh_token'].some((key) =>
      params.has(key),
    ),
  );
}

export function getOAuthCodeFromLocation(location: Pick<Location, 'hash' | 'search'> = window.location) {
  for (const params of getOAuthParamSources(location)) {
    const code = params.get('code');
    if (code) return code;
  }

  return null;
}

export function getOAuthTokenSessionFromLocation(location: Pick<Location, 'hash' | 'search'> = window.location) {
  for (const params of getOAuthParamSources(location)) {
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      return {
        accessToken,
        refreshToken,
      };
    }
  }

  return null;
}
