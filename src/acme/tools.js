/*
 * The Needle 3 environment for Acme Admin, the app under test: its tool surface, system facts and
 * frozen test suite, shaped like the package's needle.environments (needle3-context.md §11).
 *
 * Designed by the rules in §10 and "How to Design Tools for Needle 3":
 *  - one tool per action, described by the actions it covers;
 *  - closed sets as enums named with the words people say, filled from the app's live state
 *    (the users that exist, the messages the app can show), so a step can only name real things;
 *  - free text (email, password, search) is copied verbatim, with its format in the description;
 *  - polar pairs as one enum (on / off);
 *  - checks carry triggers (§9) so a "verify" step reaches a check and can never change the app.
 *    Each check's trigger names the nouns it owns and excludes the others', using only negative
 *    lookaheads and plain patterns like the §9 examples.
 */

export const PAGES = ['dashboard', 'users', 'settings', 'login'];
export const ROLES = ['viewer', 'editor', 'admin'];

/** Everything Acme Admin can say to a person, so a check names a message that exists. */
export function messages(state) {
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

// minLength 1 is a grammar bound (§10): an empty string can't decode, so a required value the
// request doesn't give withholds the call instead of coming back as "".
const text = (description) => ({ type: 'string', minLength: 1, description });
// An email address as a grammar pattern (§10: bounds in the schema, not in prose).
const email = (description) => ({ ...text(description), pattern: '^[^@\\s]+@[^@\\s]+\\.[a-z]+$' });
const oneOf = (values, description) => ({
  type: 'string',
  enum: [...new Set(values)],
  ...(description && { description }),
});
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required });

const not = (pattern) => String.raw`(?![\s\S]*${pattern})`;

// Trigger pieces (§9): a verify verb, and the nouns each check owns.
const either = (a, b) => String.raw`(${a}[\s\S]*${b}|${b}[\s\S]*${a})`;
const VERIFY = String.raw`\b(verify|should|assert|expect|ensure|make sure|confirm|check that|check if)\b`;
const EMAIL = String.raw`[\w.+-]+@[\w-]+\.\w+`;
const SETTING = String.raw`\b(two-factor|2fa|alerts?|theme|dark mode|light mode)\b`;
const MESSAGE = String.raw`(["“]|\b(message|error|toast|notification|appears?|displayed|shown)\b)`;
const PAGE = String.raw`(\b(page|url|redirected|dashboard|users|settings|login)\b|\s/\w)`;

// Single-action triggers step aside for "and / then" so the model can emit several calls (§9),
// and never fire on a verify step, which belongs to a check.
const SINGLE_ACTION = String.raw`^(?![\s\S]*\b(and|then)\b)${not(VERIFY)}`;

// "and" joins a second action only when an action verb follows it; in "log in with X and Y" it
// just joins the credentials, so the sign-in trigger steps aside only for a following action.
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

/**
 * The tool schemas for the app as it is now. `state` is {users: [{email, name, role, status}]};
 * `known` adds emails the run has seen, so a check can name a user who was just removed.
 * Entries carry `risk` (gate only), which the engine never sees.
 */
export function acmeTools(state, known = []) {
  const emails = state.users.map((u) => u.email);
  const everyone = [...new Set([...emails, ...known])];
  // A tool whose enum would be empty (no users to remove) can't be called, so it isn't offered.
  const usable = (tool) => Object.values(tool.parameters.properties).every((p) => !p.enum || p.enum.length);
  return [
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
  ].filter(usable);
}

/**
 * The words the schemas above are built from, as keyword bias for dictation. Whistle favours
 * them during its search, so the names a tester says out loud survive it and land in the enum
 * the step has to match. Same source as the enums: the app's live state.
 */
export function vocabulary(state) {
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
export const SEED = {
  users: [
    { name: 'Ana Lopez', email: 'ana@acme.com', role: 'Admin', status: 'Active' },
    { name: 'Bob Smith', email: 'bob@acme.com', role: 'Editor', status: 'Active' },
    { name: 'Chen Wei', email: 'chen@acme.com', role: 'Viewer', status: 'Active' },
  ],
};
