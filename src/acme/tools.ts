/** The Needle 3 environment for Acme Admin: its tool schemas, vocabulary and system facts. */
import type { PropertySchema, ToolEntry } from '../engine/types.ts';

export interface AcmeUser {
  name: string;
  email: string;
  role: string;
  status: string;
}

/** What the tools are built from: the app's users right now. */
export interface AcmeState {
  users: AcmeUser[];
}

export const PAGES = ['dashboard', 'users', 'settings', 'login'];
export const ROLES = ['viewer', 'editor', 'admin'];

/** Everything Acme Admin can say to a person, so a check names a message that exists. */
export function messages(state: AcmeState) {
  return [
    'Invalid email or password',
    'Welcome back, Admin',
    'Invitation sent',
    'Enter a valid email',
    'Settings saved',
    'No users match your search',
    ...state.users.map((u) => `${u.email} removed`),
    ...state.users.map((u) => `${u.email} is already a member`),
  ];
}

const text = (description: string): PropertySchema => ({ type: 'string', minLength: 1, description });
const email = (description: string): PropertySchema => ({
  ...text(description),
  pattern: '^[^@\\s]+@[^@\\s]+\\.[a-z]+$',
});
const oneOf = (values: string[], description?: string): PropertySchema => ({
  type: 'string',
  enum: [...new Set(values)],
  ...(description && { description }),
});
const object = (properties: Record<string, PropertySchema>, required = Object.keys(properties)) => ({
  type: 'object' as const,
  properties,
  required,
});

const not = (pattern: string) => String.raw`(?![\s\S]*${pattern})`;

const either = (a: string, b: string) => String.raw`(${a}[\s\S]*${b}|${b}[\s\S]*${a})`;
const VERIFY = String.raw`\b(verify|should|assert|expect|ensure|make sure|confirm|check that|check if)\b`;
const EMAIL = String.raw`[\w.+-]+@[\w-]+\.\w+`;
const SETTING = String.raw`\b(two-factor|2fa|alerts?|theme|dark mode|light mode)\b`;
const MESSAGE = String.raw`(["“]|\b(message|error|toast|notification|appears?|displayed|shown)\b)`;
const PAGE = String.raw`(\b(page|url|redirected|dashboard|users|settings|login)\b|\s/\w)`;

const SINGLE_ACTION = String.raw`^(?![\s\S]*\b(and|then)\b)${not(VERIFY)}`;

const ANOTHER_ACTION = String.raw`\b(and|then)\s+(open|go|navigate|invite|remove|delete|turn|switch|enable|disable|search|sign out|log out)\b`;

const TRIGGERS = {
  signIn: String.raw`^${not(ANOTHER_ACTION)}${not(VERIFY)}[\s\S]*\b(sign|log)\s*in\b`,
  twoFactor: String.raw`${SINGLE_ACTION}[\s\S]*\b(two-factor|2fa)\b`,
  alerts: String.raw`${SINGLE_ACTION}[\s\S]*\balerts?\b`,
  user: String.raw`^[\s\S]*${either(VERIFY, EMAIL)}`,
  setting: String.raw`^${not(EMAIL)}[\s\S]*${either(VERIFY, SETTING)}`,
  message: String.raw`^${not(EMAIL)}${not(SETTING)}[\s\S]*${either(VERIFY, MESSAGE)}`,
  page: String.raw`^${not(EMAIL)}${not(SETTING)}${not(MESSAGE)}[\s\S]*${either(VERIFY, PAGE)}`,
};

/** The tool schemas for the app as it is now. */
export function acmeTools(state: AcmeState, known: string[] = []): ToolEntry[] {
  const emails = state.users.map((u) => u.email);
  const everyone = [...new Set([...emails, ...known])];
  const usable = (tool: ToolEntry) => Object.values(tool.parameters.properties).every((p) => !p.enum || p.enum.length);
  const tools: ToolEntry[] = [
    {
      name: 'sign_in',
      description: 'Sign in or log in to Acme Admin with an email address and a password.',
      triggers: [TRIGGERS.signIn],
      parameters: object({
        email: email('Email address, e.g. sam@example.com'),
        password: text('The password, verbatim'),
      }),
    },
    {
      name: 'sign_out',
      description: 'Sign out or log out of Acme Admin.',
      parameters: object({}),
    },
    {
      name: 'open_page',
      description: 'Open or go to a page of Acme Admin: the dashboard, users, settings or login page.',
      parameters: object({ page: oneOf(PAGES) }),
    },
    {
      name: 'search_users',
      description: 'Search or filter the users list by a name or an email.',
      parameters: object({ query: text('The name or email to search for, verbatim') }),
    },
    {
      name: 'invite_user',
      description: 'Invite a new user by email address, with a role and optionally a name.',
      parameters: object(
        {
          email: email('Email address of the new user, e.g. dana@acme.com'),
          role: { ...oneOf(ROLES), default: 'viewer' },
          name: text('Full name, verbatim'),
        },
        ['email'],
      ),
    },
    {
      name: 'remove_user',
      description: 'Remove or delete an existing user from Acme Admin.',
      risk: 'high',
      parameters: object({ email: oneOf(emails) }),
    },
    {
      name: 'set_two_factor',
      description: 'Turn two-factor authentication (2FA) on or off, and save the settings.',
      triggers: [TRIGGERS.twoFactor],
      parameters: object({ state: oneOf(['on', 'off']) }),
    },
    {
      name: 'set_email_alerts',
      description: 'Turn email alerts on or off, and save the settings.',
      triggers: [TRIGGERS.alerts],
      parameters: object({ state: oneOf(['on', 'off']) }),
    },
    {
      name: 'set_theme',
      description: 'Switch the Acme Admin theme to light or dark, and save the settings.',
      parameters: object({ theme: oneOf(['light', 'dark']) }),
    },
    {
      name: 'check_page',
      description: 'Verify which page of Acme Admin is open: dashboard, users, settings or login.',
      triggers: [TRIGGERS.page],
      parameters: object({ page: oneOf(PAGES) }),
    },
    {
      name: 'check_message',
      description: 'Verify that a message, error or notification is shown.',
      triggers: [TRIGGERS.message],
      parameters: object({ message: oneOf(messages(state)) }),
    },
    {
      name: 'check_user',
      description: "Verify a user's status in the users list: listed, pending, or removed.",
      triggers: [TRIGGERS.user],
      parameters: object({ email: oneOf(everyone), status: oneOf(['listed', 'pending', 'removed']) }),
    },
    {
      name: 'check_setting',
      description: 'Verify a setting: two-factor authentication or email alerts on or off, or the theme.',
      triggers: [TRIGGERS.setting],
      parameters: object({
        setting: oneOf(['two-factor', 'email alerts', 'theme']),
        value: oneOf(['on', 'off', 'light', 'dark']),
      }),
    },
  ];
  return tools.filter(usable);
}

/** The words the schemas above are built from, as keyword bias for dictation. */
export function vocabulary(state: AcmeState) {
  return [
    ...state.users.flatMap((u) => [u.name, u.email]),
    ...PAGES,
    ...ROLES,
    'two-factor',
    'email alerts',
    'theme',
    'dark mode',
    'light mode',
    ...messages(state),
  ];
}

/** Facts, not instructions (§8). */
export const SYSTEM = 'date: 2026-09-25 Thu 10:00; locale: en-US; device: desktop';

/** The seeded app, as the suite and a fresh sandbox start. */
export const SEED: AcmeState = {
  users: [
    { name: 'Ana Lopez', email: 'ana@acme.com', role: 'Admin', status: 'Active' },
    { name: 'Bob Smith', email: 'bob@acme.com', role: 'Editor', status: 'Active' },
    { name: 'Chen Wei', email: 'chen@acme.com', role: 'Viewer', status: 'Active' },
  ],
};
