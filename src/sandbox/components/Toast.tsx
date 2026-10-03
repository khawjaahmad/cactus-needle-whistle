import type { ToastMessage } from '../useToast.ts';

/**
 * Keyed by id, so every message is a new element: the studio's driver watches for added
 * `role="status"` nodes to catch a toast that fades before its check runs.
 */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  return toast ? (
    <div key={toast.id} className="toast" role="status">
      {toast.text}
    </div>
  ) : null;
}
