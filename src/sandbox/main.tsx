import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import * as store from './store.ts';
import './styles.css';

// Read (and seed) storage before the first render: the studio reads the users as soon as the
// frame has loaded, which can be before React commits.
store.resetIfRequested(location.search);
const initial = { users: store.loadUsers(), settings: store.loadSettings(), signedIn: store.isSignedIn() };

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App initial={initial} />
  </StrictMode>,
);
