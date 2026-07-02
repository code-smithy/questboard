export function getAuthRedirectUrl(origin = window.location.origin, basePath = import.meta.env.BASE_URL) {
  const url = new URL(basePath, origin);
  url.searchParams.set('auth_callback', '1');
  return url.toString();
}
