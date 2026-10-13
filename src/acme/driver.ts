/** Carries out Acme Admin tool calls on the app in the studio's frame, through its real controls. */
import type { CallArguments, FunctionCall } from '../engine/types.ts';
import { USERS_KEY } from '../sandbox/store.ts';
import type { AcmeState } from './tools.ts';

const WAIT_MS = 3000;
const POLL_MS = 100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class StepError extends Error {}

/** What one call did. */
export interface Outcome {
  detail: string;
}

/** Where the agent is acting, in the frame's viewport coordinates, for the studio's cursor. */
export interface AgentTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AgentAction = 'click' | 'type' | 'select' | 'read';

export type AgentEvent =
  { type: 'target'; action: AgentAction; target: AgentTarget } | { type: 'navigate'; path: string } | { type: 'idle' };

export interface AcmeDriver {
  perform(call: FunctionCall): Promise<Outcome>;
  /** The users the app has now, for the tool enums. */
  state(): AcmeState;
  /** Loads the app fresh (?reset clears its data). */
  reset(): Promise<void>;
  /** Call on every frame load: drives that frame and watches it for status messages. */
  attach(frame: HTMLIFrameElement): void;
  /** Every move the agent makes, for whoever draws it; returns the unsubscribe. */
  onEvent(listener: (event: AgentEvent) => void): () => void;
}

interface DriverOptions {
  /** The app URL a path is appended to, e.g. '/sandbox/#'. */
  baseUrl: string;
  /** A pause before acting on a control, so a cursor drawn over the app gets there first. */
  paceMs?: number;
  /** A pause per typed character; 0 sets the whole value at once. */
  typeMs?: number;
}

/** The app's address with `?reset`, so it starts clean; a new token makes each reset a real load. */
export const resetUrl = (baseUrl: string, token: string | number = Date.now()) =>
  `${baseUrl.replace('#', `?reset=${token}#`)}/login`;

/** Polls until `find` returns something truthy, so a step waits for the app to catch up. */
async function waitFor<T>(find: () => T, timeout = WAIT_MS): Promise<T | null> {
  const until = performance.now() + timeout;
  for (;;) {
    const found = find();
    if (found) return found;
    if (performance.now() > until) return null;
    await sleep(POLL_MS);
  }
}

type Field = HTMLInputElement | HTMLSelectElement;

/** Sets a field the way typing does. */
function setValue(el: Field, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, value);
}

function fire(el: Element, type: string) {
  const view = el.ownerDocument.defaultView as Window & typeof globalThis;
  el.dispatchEvent(new view.Event(type, { bubbles: true }));
}

/** Drives the <iframe> holding Acme Admin, which it learns from `attach` on the frame's first load. */
export function createAcmeDriver({ baseUrl, paceMs = 0, typeMs = 0 }: DriverOptions) {
  let attached: HTMLIFrameElement | null = null;
  const frame = () => {
    if (!attached) throw new Error('The app has not loaded yet.');
    return attached;
  };
  const win = () => frame().contentWindow as Window & typeof globalThis;
  const doc = () => win().document;
  const $ = <T extends Element>(selector: string) => doc().querySelector<T>(selector);
  const path = () => win().location.hash.slice(1) || '/login';
  const visibleText = () => doc().body.innerText;

  const listeners = new Set<(event: AgentEvent) => void>();
  const emit = (event: AgentEvent) => listeners.forEach((listener) => listener(event));
  const aim = async (el: Element, action: AgentAction) => {
    const { x, y, width, height } = el.getBoundingClientRect();
    emit({ type: 'target', action, target: { x, y, width, height } });
    await sleep(paceMs);
  };

  let shown: string[] = [];
  function attach(el: HTMLIFrameElement) {
    attached = el;
    new (win().MutationObserver)((records) =>
      records.forEach((r) =>
        r.addedNodes.forEach((node) => {
          if ((node as Element).getAttribute?.('role') === 'status') shown.push(node.textContent ?? '');
        }),
      ),
    ).observe(doc().body, { childList: true, subtree: true });
  }

  async function flash(el: HTMLElement, action: AgentAction) {
    el.scrollIntoView({ block: 'nearest' });
    await aim(el, action);
    await sleep(150);
  }

  async function control<T extends HTMLElement>(selector: string, what: string, action: AgentAction) {
    const el = await waitFor(() => $<T>(selector));
    if (!el) throw new StepError(`${what} is not on ${path()}.`);
    await flash(el, action);
    return el;
  }

  async function fill(selector: string, label: string, value: string) {
    const el = await control<HTMLInputElement>(selector, `The ${label} field`, 'type');
    el.focus();
    const steps = typeMs && value ? [...value].map((_, i) => value.slice(0, i + 1)) : [value];
    for (const typed of steps) {
      setValue(el, typed);
      fire(el, 'input');
      if (typeMs) await sleep(typeMs);
    }
    fire(el, 'change');
  }

  async function select(selector: string, label: string, value: string) {
    const el = await control<HTMLSelectElement>(selector, `The ${label} dropdown`, 'select');
    setValue(el, value);
    fire(el, 'change');
  }

  async function click(selector: string, role: string, name: string) {
    const el = await control(selector, `The “${name}” ${role}`, 'click');
    el.click();
    await sleep(150);
  }

  async function go(page: string) {
    if (path() === `/${page}`) return;
    emit({ type: 'navigate', path: `/${page}` });
    win().location.hash = `#/${page}`;
    await sleep(150);
  }

  /** Settings are applied the way a person does it: change the control, then Save. */
  async function changeSetting(apply: () => Promise<void>) {
    await go('settings');
    await apply();
    await click('#settings-save', 'button', 'Save');
  }

  async function setCheckbox(selector: string, label: string, on: boolean) {
    const box = await control<HTMLInputElement>(selector, `The ${label} checkbox`, 'click');
    if (box.checked !== on) box.click();
  }

  const expectText = async (text: string) => {
    const ok = await waitFor(() => visibleText().includes(text) || shown.includes(text));
    if (!ok) throw new StepError(`Expected “${text}” to be shown on ${path()}; it is not.`);
    const where = [...doc().querySelectorAll('[role=status], h1, h2, p, td, span, div')]
      .reverse()
      .find((el) => el.textContent?.includes(text));
    if (where) await aim(where, 'read');
  };

  const userRow = (email: string) =>
    [...doc().querySelectorAll('tbody tr')].find(
      (tr) => (tr as HTMLTableRowElement).cells[1]?.textContent === email,
    ) as HTMLTableRowElement | undefined;

  const tools: Record<string, (args: CallArguments) => Promise<string>> = {
    async sign_in({ email, password }) {
      if (path() !== '/login') await tools.sign_out({});
      await go('login');
      await fill('#email', 'Email', email);
      await fill('#password', 'Password', password);
      await click('#sign-in', 'button', 'Sign in');
      return `Signed in as ${email} → ${path()}`;
    },
    async sign_out() {
      if (path() === '/login') return 'Already signed out';
      await click('#sign-out', 'button', 'Sign out');
      return 'Signed out';
    },
    async open_page({ page }) {
      await go(page);
      return `Opened /${page}${path() !== `/${page}` ? `, landed on ${path()}` : ''}`;
    },
    async search_users({ query }) {
      await go('users');
      await fill('#search', 'Search', query);
      return `Searched users for “${query}”`;
    },
    async invite_user({ email, role = 'viewer', name }) {
      await go('users');
      await click('#invite-open', 'button', 'Invite user');
      if (name) await fill('#invite-name', 'Name', name);
      await fill('#invite-email', 'Email', email);
      await select('#invite-role', 'Role', capitalize(role));
      await click('#invite-send', 'button', 'Send invite');
      return `Invited ${email} as ${role}`;
    },
    async remove_user({ email }) {
      await go('users');
      if ($<HTMLInputElement>('#search')?.value) await fill('#search', 'Search', '');
      await click(`[aria-label="Remove ${CSS.escape(email)}"]`, 'button', `Remove ${email}`);
      return `Removed ${email}`;
    },
    async set_two_factor({ state }) {
      await changeSetting(() => setCheckbox('#two-factor', 'Two-factor authentication', state === 'on'));
      return `Two-factor ${state}`;
    },
    async set_email_alerts({ state }) {
      await changeSetting(() => setCheckbox('#alerts', 'Email alerts', state === 'on'));
      return `Email alerts ${state}`;
    },
    async set_theme({ theme }) {
      await changeSetting(() => select('#theme', 'Theme', capitalize(theme)));
      return `Theme ${theme}`;
    },

    async check_page({ page }) {
      const ok = await waitFor(() => path() === `/${page}`);
      if (!ok) throw new StepError(`Expected to be on /${page}; on ${path()}.`);
      const heading = $('h1, h2');
      if (heading) await aim(heading, 'read');
      return `On /${page}`;
    },
    async check_message({ message }) {
      await expectText(message);
      return `“${message}” is shown`;
    },
    async check_user({ email, status }) {
      await go('users');
      if ($<HTMLInputElement>('#search')?.value) await fill('#search', 'Search', '');
      if (status === 'removed') {
        const gone = await waitFor(() => !userRow(email));
        if (!gone) throw new StepError(`Expected ${email} to be removed; it is still listed.`);
      } else {
        const tr = await waitFor(() => userRow(email));
        if (!tr) throw new StepError(`Expected ${email} to be ${status}; it is not listed.`);
        await aim(tr, 'read');
        const actual = tr.cells[3].textContent ?? '';
        if (status === 'pending' && actual !== 'Pending')
          throw new StepError(`Expected ${email} to be pending; it is ${actual.toLowerCase()}.`);
      }
      return `${email} is ${status}`;
    },
    async check_setting({ setting, value }) {
      const valid = setting === 'theme' ? ['light', 'dark'] : ['on', 'off'];
      if (!valid.includes(value)) throw new StepError(`${setting} can be ${valid.join(' or ')}, not ${value}.`);
      await go('settings');
      if (setting === 'theme') {
        const actual = (await control<HTMLSelectElement>('#theme', 'The Theme dropdown', 'read')).value.toLowerCase();
        if (actual !== value) throw new StepError(`Expected the theme to be ${value}; it is ${actual}.`);
      } else {
        const [selector, label] =
          setting === 'two-factor' ? ['#two-factor', 'Two-factor authentication'] : ['#alerts', 'Email alerts'];
        const on = (await control<HTMLInputElement>(selector, `The ${label} checkbox`, 'read')).checked;
        if (on !== (value === 'on'))
          throw new StepError(`Expected ${setting} to be ${value}; it is ${on ? 'on' : 'off'}.`);
      }
      return `${setting} is ${value}`;
    },
  };

  return {
    async perform(call) {
      const tool = tools[call.name];
      if (!tool) throw new StepError(`Acme Admin has no action ${call.name}.`);
      if (!call.name.startsWith('check_')) shown = [];
      try {
        const detail = await tool(call.arguments ?? {});
        return { detail };
      } finally {
        emit({ type: 'idle' });
      }
    },

    state() {
      try {
        return { users: JSON.parse(win().localStorage.getItem(USERS_KEY) ?? 'null') ?? [] };
      } catch {
        return { users: [] };
      }
    },

    async reset() {
      const el = frame();
      await new Promise((resolve) => {
        el.addEventListener('load', resolve, { once: true });
        el.src = resetUrl(baseUrl);
      });
      await sleep(100);
    },

    attach,

    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies AcmeDriver;
}
