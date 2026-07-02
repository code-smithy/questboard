import { useAuth } from '../auth/AuthProvider';

export function ProfilePage() {
  const { profile, user } = useAuth();

  return (
    <section className="panel profile-card">
      <p className="eyebrow">Profile</p>
      <h2>Your adventurer profile</h2>
      <p>Discord profile details, notification preferences, timezone preferences, and theme settings will live here.</p>

      <dl className="details-list">
        <div>
          <dt>Display name</dt>
          <dd>{profile?.display_name ?? 'Not synced yet'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user?.email ?? 'Discord account email unavailable'}</dd>
        </div>
        <div>
          <dt>Discord user ID</dt>
          <dd>{profile?.discord_user_id ?? 'Not provided'}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{profile?.last_seen_at ? new Date(profile.last_seen_at).toLocaleString() : 'Not recorded yet'}</dd>
        </div>
      </dl>
    </section>
  );
}
