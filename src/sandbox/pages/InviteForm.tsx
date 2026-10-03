import { useState, type FormEvent } from 'react';
import type { AcmeUser } from '../../acme/tools.ts';
import { Field } from '../components/Field.tsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['Viewer', 'Editor', 'Admin'];

interface Props {
  users: AcmeUser[];
  onInvite: (user: AcmeUser) => void;
  onCancel: () => void;
}

export function InviteForm({ users, onInvite, onCancel }: Props) {
  const [error, setError] = useState('');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name')).trim();
    const email = String(form.get('email')).trim();
    if (!EMAIL.test(email)) return setError('Enter a valid email');
    if (users.some((u) => u.email === email)) return setError(`${email} is already a member`);
    onInvite({ name: name || email, email, role: String(form.get('role')), status: 'Pending' });
  };

  return (
    <form className="card invite" noValidate onSubmit={submit}>
      <h2>Invite a user</h2>
      <div className="error" role="alert" hidden={!error}>
        {error}
      </div>
      <div className="row">
        <Field id="invite-name" label="Name">
          <input id="invite-name" name="name" type="text" />
        </Field>
        <Field id="invite-email" label="Email">
          <input id="invite-email" name="email" type="email" />
        </Field>
        <Field id="invite-role" label="Role">
          <select id="invite-role" name="role">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="row">
        <button className="btn btn-primary" id="invite-send" type="submit">
          Send invite
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
