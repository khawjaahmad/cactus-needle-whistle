/*
 * Acme Admin's persistence: users, settings and the session in localStorage. The studio's driver
 * reads the users through USERS_KEY, so the tool enums name the users the app really has.
 */
import { SEED } from '../src/acme/tools.js';

export const CREDENTIALS = { email: 'admin@acme.com', password: 'Passw0rd!' };
export const USERS_KEY = 'acme-users';

const KEYS = { users: USERS_KEY, settings: 'acme-settings', session: 'acme-session' };
const DEFAULT_SETTINGS = { twoFactor: true, alerts: false, theme: 'Light' };

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is off: the app still works for this page load.
  }
};

/** `?reset` in the URL starts the app clean. */
export function resetIfRequested(search) {
  if (new URLSearchParams(search).has('reset')) Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}

/** The users, seeded on first load and persisted from the start so the studio can read them. */
export function loadUsers() {
  const users = read(KEYS.users, SEED.users);
  write(KEYS.users, users);
  return users;
}

export const saveUsers = (users) => write(KEYS.users, users);
export const loadSettings = () => read(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (settings) => write(KEYS.settings, settings);
export const isSignedIn = () => read(KEYS.session, false) === true;
export const setSignedIn = (signedIn) => write(KEYS.session, signedIn);
