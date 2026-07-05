import { useCallback, useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';

const DISCLOSURE_STORAGE_PREFIX = 'questboard.disclosure.';

function readStoredDisclosureState(key: string) {
  if (typeof window === 'undefined') return null;

  try {
    const value = window.localStorage.getItem(`${DISCLOSURE_STORAGE_PREFIX}${key}`);
    if (value === 'open') return true;
    if (value === 'closed') return false;
  } catch {
    return null;
  }

  return null;
}

function writeStoredDisclosureState(key: string, isOpen: boolean) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(`${DISCLOSURE_STORAGE_PREFIX}${key}`, isOpen ? 'open' : 'closed');
  } catch {
    // Local storage can be unavailable in private browsing or tests.
  }
}

export function usePersistedDisclosureState(key: string, defaultOpen: boolean) {
  const [isOpen, setIsOpen] = useState(() => readStoredDisclosureState(key) ?? defaultOpen);

  useEffect(() => {
    setIsOpen(readStoredDisclosureState(key) ?? defaultOpen);
  }, [defaultOpen, key]);

  const handleToggle = useCallback((event: SyntheticEvent<HTMLDetailsElement>) => {
    const nextIsOpen = event.currentTarget.open;
    setIsOpen(nextIsOpen);
    writeStoredDisclosureState(key, nextIsOpen);
  }, [key]);

  return {
    onToggle: handleToggle,
    open: isOpen,
  };
}
