export function getAuthRedirectUrl(origin = window.location.origin, basePath = import.meta.env.BASE_URL) {
  const baseUrl = new URL(basePath, origin);
  const base = baseUrl.toString().replace(/\/?$/, '/');
  return `${base}#/auth/callback?auth_callback=1`;
}
