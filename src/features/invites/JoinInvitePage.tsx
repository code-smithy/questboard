import { useParams } from 'react-router-dom';

export function JoinInvitePage() {
  const { inviteToken } = useParams();

  return (
    <section className="panel">
      <p className="eyebrow">Invite</p>
      <h2>Join a guild</h2>
      <p>Questboard will validate reusable invite links and add authenticated users as regular members.</p>
      <p className="hint">Invite token: {inviteToken}</p>
    </section>
  );
}
