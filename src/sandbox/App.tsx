/** Acme Admin: the app under test. */
import { useEffect, useState, type ReactNode } from 'react';
import type { AcmeUser } from '../acme/tools.ts';
import { Nav } from './components/Nav.tsx';
import { Toast } from './components/Toast.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { navigate, useHashPath } from './router.ts';
import * as store from './store.ts';
import { useToast } from './useToast.ts';

export interface InitialState {
  users: AcmeUser[];
  settings: store.Settings;
  signedIn: boolean;
}

export function App({ initial }: { initial: InitialState }) {
  const path = useHashPath();
  const [users, setUsers] = useState(initial.users);
  const [settings, setSettings] = useState(initial.settings);
  const [signedIn, setSignedIn] = useState(initial.signedIn);
  const [toast, showToast] = useToast();

  const redirect = path !== '/login' && !signedIn ? '/login' : path === '/login' && signedIn ? '/dashboard' : null;
  useEffect(() => {
    if (redirect) navigate(redirect);
  }, [redirect]);

  useEffect(() => {
    document.title = `${path.slice(1) || 'login'} · Acme Admin`;
  }, [path]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'Dark');
  }, [settings.theme]);

  const updateUsers = (next: AcmeUser[]) => {
    setUsers(next);
    store.saveUsers(next);
  };
  const changeSession = (next: boolean, to: string) => {
    setSignedIn(next);
    store.setSignedIn(next);
    navigate(to);
  };

  const pages: Record<string, () => ReactNode> = {
    '/login': () => <LoginPage onSignIn={() => changeSession(true, '/dashboard')} />,
    '/dashboard': () => <DashboardPage users={users} settings={settings} />,
    '/users': () => (
      <UsersPage
        users={users}
        onInvite={(user) => {
          updateUsers([...users, user]);
          showToast('Invitation sent');
        }}
        onRemove={(user) => {
          updateUsers(users.filter((u) => u !== user));
          showToast(`${user.email} removed`);
        }}
      />
    ),
    '/settings': () => (
      <SettingsPage
        settings={settings}
        onSave={(next) => {
          setSettings(next);
          store.saveSettings(next);
          showToast('Settings saved');
        }}
      />
    ),
  };

  if (redirect) return null;
  const page = pages[path];
  return (
    <>
      {path !== '/login' && <Nav current={path} onSignOut={() => changeSession(false, '/login')} />}
      {page ? (
        page()
      ) : (
        <main>
          <h1>Page not found</h1>
        </main>
      )}
      <Toast toast={toast} />
    </>
  );
}
