import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_MS = 3000;

export interface ToastMessage {
  id: number;
  text: string;
}

/** One status message at a time, for 3 s or until Escape. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setToast(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const show = useCallback((text: string) => setToast({ id: (nextId.current += 1), text }), []);
  return [toast, show] as const;
}
