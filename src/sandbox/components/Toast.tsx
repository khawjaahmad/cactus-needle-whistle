import type { ToastMessage } from '../useToast.ts';

/** Keyed by id, so the studio's driver sees every message as a new status node. */
export function Toast({ toast }: { toast: ToastMessage | null }) {
  return toast ? (
    <div key={toast.id} className="toast" role="status">
      {toast.text}
    </div>
  ) : null;
}
