/*
 * Carries out Acme Admin tool calls (acme/tools.ts) on the app in the studio's frame, through the
 * app's real controls, and records each one as Playwright lines. The model picks the tool and
 * fills its arguments; this is the app's own automation layer, so it knows its controls by id and
 * label, the way a hand-written page object would.
 */
import type { CallArguments, FunctionCall } from '../engine/types.ts';
import { USERS_KEY } from '../sandbox/store.ts';
import type { AcmeState } from './tools.ts';

const WAIT_MS = 3000;
const POLL_MS = 100;
const q = JSON.stringify;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class StepError extends Error {}

/** What one call did, and the Playwright lines that repeat it. */
export interface Outcome {
  detail: string;
  lines: string[];
}

export interface AcmeDriver {
  perform(call: FunctionCall): Promise<Outcome>;
  /** The users the app has now, for the tool enums. */
  state(): AcmeState;
  /** Loads the app fresh (?reset clears its data). */
  reset(): Promise<void>;
  /** Call on every load of the frame: drives that frame, and watches its new document for status messages. */
  attach(frame: HTMLIFrameElement): void;
}

/** The app's address with `?reset`, so it starts clean; a new token makes each reset a real load. */
export const resetUrl = (baseUrl: string, token: string | number = Date.now()) =>
  `${baseUrl.replace('#', `?reset=${token}#`)}/login`;

/** Polls until `find` returns something truthy, like Playwright's auto-waiting. */
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

/**
 * Sets a field the way typing does. React (which Acme Admin is built with) tracks values assigned
 * through the element and would ignore the input event, so this goes through the prototype's setter.
 */
function setValue(el: Field, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, value);
}

function fire(el: Element, type: string) {
  const view = el.ownerDocument.defaultView as Window & typeof globalThis;
  el.dispatchEvent(new view.Event(type, { bubbles: true }));
}

/**
 * Drives the <iframe> holding Acme Admin, which it learns from `attach` on the frame's first load.
 *
 * @param baseUrl  the app URL a path is appended to, e.g. '/sandbox/#'
 */
export function createAcmeDriver({ baseUrl }: { baseUrl: string }) {
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

  let lines: string[] = [];
  const record = (...code: string[]) => lines.push(...code);

  // Status messages (toasts) the app showed since the last action. A toast lasts 3 s, and after a
  // step changes the app's users the engine re-reads every tool schema (about 4.6 s) before the
  // next step's check decodes, so a check also accepts a message that appeared and has gone.
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

  async function flash(el: HTMLElement) {
    el.scrollIntoView({ block: 'nearest' });
    el.classList.add('agent-hit');
    setTimeout(() => el.classList.remove('agent-hit'), 700);
    await sleep(150);
  }

  async function control<T extends HTMLElement>(selector: string, what: string) {
    const el = await waitFor(() => $<T>(selector));
    if (!el) throw new StepError(`${what} is not on ${path()}.`);
    await flash(el);
    return el;
  }

  async function fill(selector: string, label: string, value: string) {
    const el = await control<HTMLInputElement>(selector, `The ${label} field`);
    el.focus();
    setValue(el, value);
    fire(el, 'input');
    fire(el, 'change');
    record(`await page.getByLabel(${q(label)}, { exact: true }).fill(${q(value)});`);
  }

  async function select(selector: string, label: string, value: string) {
    const el = await control<HTMLSelectElement>(selector, `The ${label} dropdown`);
    setValue(el, value);
    fire(el, 'change');
    record(`await page.getByLabel(${q(label)}, { exact: true }).selectOption(${q(value)});`);
  }

  async function click(selector: string, role: string, name: string) {
    const el = await control(selector, `The “${name}” ${role}`);
    el.click();
    record(`await page.getByRole(${q(role)}, { name: ${q(name)}, exact: true }).click();`);
    await sleep(150);
  }

  async function go(page: string) {
    if (path() === `/${page}`) return;
    win().location.hash = `#/${page}`;
    record(`await page.goto(APP_URL + ${q(`/${page}`)});`);
    await sleep(150);
  }

  /** Settings are applied the way a person does it: change the control, then Save. */
  async function changeSetting(apply: () => Promise<void>) {
    await go('settings');
    await apply();
    await click('#settings-save', 'button', 'Save');
  }

  async function setCheckbox(selector: string, label: string, on: boolean) {
    const box = await control<HTMLInputElement>(selector, `The ${label} checkbox`);
    if (box.checked !== on) box.click();
    record(`await page.getByLabel(${q(label)}, { exact: true }).${on ? 'check' : 'uncheck'}();`);
  }

  const expectText = async (text: string) => {
    const ok = await waitFor(() => visibleText().includes(text) || shown.includes(text));
    if (!ok) throw new StepError(`Expected “${text}” to be shown on ${path()}; it is not.`);
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
      record(`await expect(page).toHaveURL(/\\/${page}$/);`);
      return `On /${page}`;
    },
    async check_message({ message }) {
      await expectText(message);
      record(`await expect(page.getByText(${q(message)}).first()).toBeVisible();`);
      return `“${message}” is shown`;
    },
    async check_user({ email, status }) {
      await go('users');
      if ($<HTMLInputElement>('#search')?.value) await fill('#search', 'Search', '');
      const row = `page.getByRole("row", { name: new RegExp(${q(email.replace(/[.+]/g, '\\$&'))}) })`;
      if (status === 'removed') {
        const gone = await waitFor(() => !userRow(email));
        if (!gone) throw new StepError(`Expected ${email} to be removed; it is still listed.`);
        record(`await expect(${row}).toHaveCount(0);`);
      } else {
        const tr = await waitFor(() => userRow(email));
        if (!tr) throw new StepError(`Expected ${email} to be ${status}; it is not listed.`);
        const actual = tr.cells[3].textContent ?? '';
        if (status === 'pending' && actual !== 'Pending')
          throw new StepError(`Expected ${email} to be pending; it is ${actual.toLowerCase()}.`);
        record(
          status === 'pending'
            ? `await expect(${row}).toContainText("Pending");`
            : `await expect(${row}).toBeVisible();`,
        );
      }
      return `${email} is ${status}`;
    },
    async check_setting({ setting, value }) {
      const valid = setting === 'theme' ? ['light', 'dark'] : ['on', 'off'];
      if (!valid.includes(value)) throw new StepError(`${setting} can be ${valid.join(' or ')}, not ${value}.`);
      await go('settings');
      if (setting === 'theme') {
        const actual = (await control<HTMLSelectElement>('#theme', 'The Theme dropdown')).value.toLowerCase();
        if (actual !== value) throw new StepError(`Expected the theme to be ${value}; it is ${actual}.`);
        record(`await expect(page.getByLabel("Theme", { exact: true })).toHaveValue(${q(capitalize(value))});`);
      } else {
        const [selector, label] =
          setting === 'two-factor' ? ['#two-factor', 'Two-factor authentication'] : ['#alerts', 'Email alerts'];
        const on = (await control<HTMLInputElement>(selector, `The ${label} checkbox`)).checked;
        if (on !== (value === 'on'))
          throw new StepError(`Expected ${setting} to be ${value}; it is ${on ? 'on' : 'off'}.`);
        record(
          `await expect(page.getByLabel(${q(label)}, { exact: true })).${value === 'on' ? '' : 'not.'}toBeChecked();`,
        );
      }
      return `${setting} is ${value}`;
    },
  };

  return {
    async perform(call) {
      const tool = tools[call.name];
      if (!tool) throw new StepError(`Acme Admin has no action ${call.name}.`);
      lines = [];
      if (!call.name.startsWith('check_')) shown = [];
      const detail = await tool(call.arguments ?? {});
      return { detail, lines };
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
  } satisfies AcmeDriver;
}
