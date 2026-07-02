import { useParams } from 'react-router-dom';

export function EventDetailPage() {
  const { eventId } = useParams();

  return (
    <section className="panel">
      <p className="eyebrow">Event detail</p>
      <h2>Quest details</h2>
      <p>Event summary, RSVP controls, comments, history, and export actions will appear here.</p>
      <p className="hint">Event ID: {eventId}</p>
    </section>
  );
}
