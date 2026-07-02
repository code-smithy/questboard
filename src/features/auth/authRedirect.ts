export function getAuthRedirectUrl(origin = window.location.origin, basePath = import.meta.env.BASE_URL) {
  return new URL(`${basePath}#/auth/callback`, origin).toString();
}
