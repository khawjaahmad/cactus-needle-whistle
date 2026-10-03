/*
 * Acme Admin's persistence: users, settings and the session in localStorage. The studio's driver
 * reads the users through USERS_KEY, so the tool enums name the users the app really has.
 */
import { SEED, type AcmeUser } from '../acme/tools.ts';

export const CREDENTIALS = { email: 'admin@acme.com', password: 'Passw0rd!' };
export const USERS_KEY = 'acme-users';

export interface Settings {
  twoFactor: boolean;
  alerts: boolean;
  theme: string;
}

const KEYS = { users: USERS_KEY, settings: 'acme-settings', session: 'acme-session' };
const DEFAULT_SETTINGS: Settings = { twoFactor: true, alerts: false, theme: 'Light' };

const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is off: the app still works for this page load.
  }
};

/** `?reset` in the URL starts the app clean. */
export function resetIfRequested(search: string) {
  if (new URLSearchParams(search).has('reset')) Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

/** The users, seeded on first load and persisted from the start so the studio can read them. */
export function loadUsers() {
  const users = read(KEYS.users, SEED.users);
  write(KEYS.users, users);
  return users;
}

export const saveUsers = (users: AcmeUser[]) => write(KEYS.users, users);
export const loadSettings = () => read(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (settings: Settings) => write(KEYS.settings, settings);
export const isSignedIn = () => read<unknown>(KEYS.session, false) === true;
export const setSignedIn = (signedIn: boolean) => write(KEYS.session, signedIn);
