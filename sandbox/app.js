/*
 * Acme Admin: the app under test. A small but real admin UI (sign-in, dashboard, users, settings)
 * with the behaviour test cases exercise: validation errors, guarded routes, redirects, a search
 * filter, invites, removal and saved settings. State lives in localStorage (store.js); ?reset
 * starts clean.
 *
 * The ids, labels and roles here are what the studio's driver and the exported Playwright specs
 * find controls by (src/acme/driver.js), so change them together.
 */
import { h } from '../src/shared/dom.js';
import * as store from './store.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['Viewer', 'Editor', 'Admin'];
const THEMES = ['Light', 'Dark'];
const TOAST_MS = 3000;

store.resetIfRequested(location.search);

let users = store.loadUsers();
let settings = store.loadSettings();
let query = '';
let inviting = false;
let loginError = '';

const root = document.getElementById('app');

// ── Shared pieces ────────────────────────────────────────────────────────────────────────────

function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), TOAST_MS);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelector('.toast')?.remove();
});

function go(path) {
  location.hash = `#${path}`;
}

const field = (id, label, control) => h('div', { class: 'field' }, h('label', { for: id }, label), control);

function nav(current) {
  const link = (path, label) =>
    h('a', { href: `#${path}`, ...(current === path && { 'aria-current': 'page' }) }, label);
  const signOut = () => {
    store.setSignedIn(false);
    go('/login');
  };
  return h(
    'nav',
    { class: 'nav' },
    h('strong', {}, 'Acme Admin'),
    link('/dashboard', 'Dashboard'),
    link('/users', 'Users'),
    link('/settings', 'Settings'),
    h('button', { class: 'btn', id: 'sign-out', type: 'button', onclick: signOut }, 'Sign out'),
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────────────────────

function loginPage() {
  const form = h(
    'form',
    { class: 'card login', novalidate: '' },
    h('h1', {}, 'Sign in to Acme'),
    loginError ? h('div', { class: 'error', role: 'alert' }, loginError) : null,
    field('email', 'Email', h('input', { id: 'email', type: 'email', autocomplete: 'username' })),
    field('password', 'Password', h('input', { id: 'password', type: 'password', autocomplete: 'current-password' })),
    h('label', { class: 'check' }, h('input', { id: 'remember', type: 'checkbox' }), 'Remember me'),
    h('button', { class: 'btn btn-primary', id: 'sign-in', type: 'submit' }, 'Sign in'),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#password').value;
    if (email === store.CREDENTIALS.email && password === store.CREDENTIALS.password) {
      loginError = '';
      store.setSignedIn(true);
      go('/dashboard');
    } else {
      loginError = 'Invalid email or password';
      render();
    }
  });
  return h('main', {}, form);
}

function dashboardPage() {
  const pending = users.filter((u) => u.status === 'Pending').length;
  const stat = (label, value) => h('div', { class: 'card stat' }, h('b', {}, String(value)), label);
  return h(
    'main',
    {},
    h('h1', {}, 'Dashboard'),
    h('p', {}, 'Welcome back, Admin'),
    h(
      'div',
      { class: 'stats' },
      stat('Users', users.length),
      stat('Pending invites', pending),
      stat('Two-factor', settings.twoFactor ? 'On' : 'Off'),
    ),
  );
}

function removeUser(user) {
  users = users.filter((u) => u !== user);
  store.saveUsers(users);
  toast(`${user.email} removed`);
  render();
}

function userRow(user) {
  return h(
    'tr',
    {},
    h('td', {}, user.name),
    h('td', {}, user.email),
    h('td', {}, user.role),
    h('td', {}, user.status),
    h(
      'td',
      {},
      h(
        'button',
        {
          class: 'btn btn-danger',
          type: 'button',
          'aria-label': `Remove ${user.email}`,
          onclick: () => removeUser(user),
        },
        'Remove',
      ),
    ),
  );
}

function usersPage() {
  const shown = users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase()));
  const search = h('input', { id: 'search', type: 'search', value: query, placeholder: 'Name or email' });
  search.addEventListener('input', () => {
    query = search.value;
    renderKeepingFocus('search');
  });
  const openInvite = () => {
    inviting = true;
    render();
  };

  return h(
    'main',
    {},
    h('h1', {}, 'Users'),
    h(
      'div',
      { class: 'toolbar' },
      h('div', { class: 'field toolbar-search' }, h('label', { for: 'search' }, 'Search'), search),
      h(
        'div',
        { class: 'toolbar-action' },
        h(
          'button',
          { class: 'btn btn-primary', id: 'invite-open', type: 'button', onclick: openInvite },
          'Invite user',
        ),
      ),
    ),
    inviting ? inviteForm() : null,
    // Scrolls sideways on a narrow screen instead of widening the page.
    h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        {},
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            ['Name', 'Email', 'Role', 'Status', ''].map((t) => h('th', {}, t)),
          ),
        ),
        h('tbody', {}, shown.map(userRow)),
      ),
    ),
    shown.length ? null : h('p', {}, 'No users match your search.'),
  );
}

function inviteForm() {
  const error = h('div', { class: 'error', role: 'alert', hidden: '' });
  const showError = (message) => {
    error.textContent = message;
    error.hidden = false;
  };
  const cancel = () => {
    inviting = false;
    render();
  };
  const form = h(
    'form',
    { class: 'card invite', novalidate: '' },
    h('h2', {}, 'Invite a user'),
    error,
    h(
      'div',
      { class: 'row' },
      field('invite-name', 'Name', h('input', { id: 'invite-name', type: 'text' })),
      field('invite-email', 'Email', h('input', { id: 'invite-email', type: 'email' })),
      field(
        'invite-role',
        'Role',
        h(
          'select',
          { id: 'invite-role' },
          ROLES.map((r) => h('option', { value: r }, r)),
        ),
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn btn-primary', id: 'invite-send', type: 'submit' }, 'Send invite'),
      h('button', { class: 'btn', type: 'button', onclick: cancel }, 'Cancel'),
    ),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('#invite-name').value.trim();
    const email = form.querySelector('#invite-email').value.trim();
    if (!EMAIL.test(email)) return showError('Enter a valid email');
    if (users.some((u) => u.email === email)) return showError(`${email} is already a member`);
    const role = form.querySelector('#invite-role').value;
    users = [...users, { name: name || email, email, role, status: 'Pending' }];
    store.saveUsers(users);
    inviting = false;
    toast('Invitation sent');
    render();
  });
  return form;
}

function settingsPage() {
  const box = (id, label, checked) =>
    h('label', { class: 'check' }, h('input', { id, type: 'checkbox', ...(checked && { checked: '' }) }), label);
  const themes = THEMES.map((t) => h('option', { value: t, ...(t === settings.theme && { selected: '' }) }, t));
  const form = h(
    'form',
    { class: 'card' },
    box('two-factor', 'Two-factor authentication', settings.twoFactor),
    box('alerts', 'Email alerts', settings.alerts),
    field('theme', 'Theme', h('select', { id: 'theme' }, themes)),
    h('button', { class: 'btn btn-primary', id: 'settings-save', type: 'submit' }, 'Save'),
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    settings = {
      twoFactor: form.querySelector('#two-factor').checked,
      alerts: form.querySelector('#alerts').checked,
      theme: form.querySelector('#theme').value,
    };
    store.saveSettings(settings);
    applyTheme();
    toast('Settings saved');
    render();
  });
  return h('main', {}, h('h1', {}, 'Settings'), form);
}

// ── Routing ──────────────────────────────────────────────────────────────────────────────────

const PAGES = { '/login': loginPage, '/dashboard': dashboardPage, '/users': usersPage, '/settings': settingsPage };

function applyTheme() {
  document.documentElement.classList.toggle('dark', settings.theme === 'Dark');
}

function render() {
  const path = location.hash.slice(1) || '/login';
  // Guarded routes send a signed-out visitor to sign in; a signed-in one skips the login page.
  if (path !== '/login' && !store.isSignedIn()) return go('/login');
  if (path === '/login' && store.isSignedIn()) return go('/dashboard');
  const page = PAGES[path];
  root.replaceChildren(
    ...(path === '/login' ? [] : [nav(path)]),
    page ? page() : h('main', {}, h('h1', {}, 'Page not found')),
  );
  document.title = `${path.slice(1) || 'login'} · Acme Admin`;
}

function renderKeepingFocus(id) {
  const caret = document.getElementById(id)?.selectionStart;
  render();
  const el = document.getElementById(id);
  el?.focus();
  if (caret != null) el?.setSelectionRange(caret, caret);
}

window.addEventListener('hashchange', () => {
  loginError = '';
  inviting = false;
  render();
});
applyTheme();
render();
