import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import * as store from './store.ts';
import './styles.css';

store.resetIfRequested(location.search);
const initial = { users: store.loadUsers(), settings: store.loadSettings(), signedIn: store.isSignedIn() };

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App initial={initial} />
  </StrictMode>,
);
