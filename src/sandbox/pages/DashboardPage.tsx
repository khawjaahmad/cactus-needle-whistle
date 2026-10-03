import type { AcmeUser } from '../../acme/tools.ts';
import type { Settings } from '../store.ts';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card stat">
      <b>{value}</b>
      {label}
    </div>
  );
}

export function DashboardPage({ users, settings }: { users: AcmeUser[]; settings: Settings }) {
  const pending = users.filter((u) => u.status === 'Pending').length;
  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome back, Admin</p>
      <div className="stats">
        <Stat label="Users" value={users.length} />
        <Stat label="Pending invites" value={pending} />
        <Stat label="Two-factor" value={settings.twoFactor ? 'On' : 'Off'} />
      </div>
    </main>
  );
}
