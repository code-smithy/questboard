const discordOAuthHosts = new Set(['discord.com', 'www.discord.com', 'discordapp.com', 'www.discordapp.com']);

export function getInvalidDiscordClientIdMessage(oauthUrl: string) {
  try {
    const url = new URL(oauthUrl);
    if (!discordOAuthHosts.has(url.hostname) || !url.pathname.includes('/oauth2/authorize')) {
      return null;
    }

    const clientId = url.searchParams.get('client_id')?.trim();
    if (!clientId || /^\d{17,20}$/.test(clientId)) {
      return null;
    }

    return `Discord OAuth is configured with an invalid client ID (${clientId}). In Supabase, set the Discord provider Client ID to the numeric Discord application ID, not the app name.`;
  } catch {
    return null;
  }
}
