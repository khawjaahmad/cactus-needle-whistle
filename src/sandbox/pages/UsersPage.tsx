import { useState } from 'react';
import type { AcmeUser } from '../../acme/tools.ts';
import { Field } from '../components/Field.tsx';
import { InviteForm } from './InviteForm.tsx';

interface Props {
  users: AcmeUser[];
  onInvite: (user: AcmeUser) => void;
  onRemove: (user: AcmeUser) => void;
}

export function UsersPage({ users, onInvite, onRemove }: Props) {
  const [query, setQuery] = useState('');
  const [inviting, setInviting] = useState(false);
  const shown = users.filter((u) => `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase()));

  const invite = (user: AcmeUser) => {
    setInviting(false);
    onInvite(user);
  };

  return (
    <main>
      <h1>Users</h1>
      <div className="toolbar">
        <Field id="search" label="Search" className="field toolbar-search">
          <input
            id="search"
            type="search"
            value={query}
            placeholder="Name or email"
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <div className="toolbar-action">
          <button className="btn btn-primary" id="invite-open" type="button" onClick={() => setInviting(true)}>
            Invite user
          </button>
        </div>
      </div>
      {inviting && <InviteForm users={users} onInvite={invite} onCancel={() => setInviting(false)} />}
      {/* Scrolls sideways on a narrow screen instead of widening the page. */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['Name', 'Email', 'Role', 'Status', ''].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((user) => (
              <tr key={user.email}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>
                  <button
                    className="btn btn-danger"
                    type="button"
                    aria-label={`Remove ${user.email}`}
                    onClick={() => onRemove(user)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && <p>No users match your search.</p>}
    </main>
  );
}
