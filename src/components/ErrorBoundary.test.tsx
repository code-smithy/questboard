import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function BrokenChild() {
  throw new Error('Deliberate render failure');
  return null;
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a useful fallback instead of a blank page when rendering fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const preventLoggedException = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', preventLoggedException);

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Questboard could not finish loading/i)).toBeInTheDocument();
    expect(screen.getByText('Deliberate render failure')).toBeInTheDocument();

    window.removeEventListener('error', preventLoggedException);
  });
});
