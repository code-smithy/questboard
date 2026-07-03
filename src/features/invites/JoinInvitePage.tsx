import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { acceptGroupInvite } from '../groups/groupApi';

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Questboard could not accept that invite.';
}

export function JoinInvitePage() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const { isConfigured, isLoading, user } = useAuth();
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAcceptInvite = async () => {
    if (!inviteToken || isAccepting) return;

    setIsAccepting(true);
    setErrorMessage(null);

    try {
      await acceptGroupInvite(inviteToken);
      navigate('/groups', { replace: true, state: { inviteAccepted: true } });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsAccepting(false);
    }
  };

  if (!inviteToken) {
    return <Navigate to="/groups" replace />;
  }

  if (!isConfigured) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">Invite</p>
        <h2>Supabase setup required</h2>
        <p>Questboard needs Supabase configuration before guild invite links can be accepted.</p>
        <Link className="login-link" to="/login">
          Go to login
        </Link>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">Invite</p>
        <h2>Checking your adventurer papers...</h2>
        <p>Questboard is confirming your Discord session before joining the guild.</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="panel hero-panel">
        <p className="eyebrow">Invite</p>
        <h2>Log in to join this guild</h2>
        <p>Connect Discord first, then Questboard can add you as a guild member through this invite.</p>
        <Link className="login-link" to="/login" state={{ from: { pathname: `/join/${inviteToken}` } }}>
          Login with Discord
        </Link>
      </section>
    );
  }

  return (
    <section className="panel hero-panel">
      <p className="eyebrow">Invite</p>
      <h2>Join a guild</h2>
      <p>Accept this reusable invite link to join the guild as a regular member.</p>
      <p className="hint">Invite token: {inviteToken}</p>
      <button type="button" onClick={handleAcceptInvite} disabled={isAccepting}>
        {isAccepting ? 'Joining...' : 'Join guild'}
      </button>
      {errorMessage && (
        <p className="error-text" role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
