/** Hash routing: the studio's driver navigates by `#/<page>`. */
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};
const currentPath = () => location.hash.slice(1) || '/login';

export const useHashPath = () => useSyncExternalStore(subscribe, currentPath);

export function navigate(path: string) {
  location.hash = `#${path}`;
}
