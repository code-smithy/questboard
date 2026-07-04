import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { listUserGroups } from '../groups/groupApi';
import type { GroupSummary } from '../groups/groupApi';
import { useLanguage } from '../i18n/LanguageContext';
import { EventForm } from './EventForm';
import type { EventFormValues } from './EventForm';
import { createEvent } from './eventApi';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function NewEventPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadGroups = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setGroups(await listUserGroups(user.id));
      } catch (error) {
        setErrorMessage(getErrorMessage(error, t('event.saveError')));
      } finally {
        setIsLoading(false);
      }
    };

    void loadGroups();
  }, [t, user]);

  const handleSubmit = async (values: EventFormValues) => {
    if (!user) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const event = await createEvent({ ...values, ownerId: user.id });
      navigate(`/events/${event.id}`, { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t('event.saveError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <Navigate to="/login" replace />;

  return (
    <section className="panel">
      <p className="eyebrow">{t('event.createEyebrow')}</p>
      <h2>{t('event.createTitle')}</h2>
      <p>{t('event.createDescription')}</p>
      {errorMessage && <p className="error-text" role="alert">{errorMessage}</p>}
      {isLoading ? (
        <p className="hint">{t('event.loadGuilds')}</p>
      ) : groups.length ? (
        <EventForm groups={groups} isSubmitting={isSubmitting} submitLabel={t('event.postQuest')} onSubmit={handleSubmit} />
      ) : (
        <p className="hint">{t('event.noGuilds')}</p>
      )}
    </section>
  );
}
