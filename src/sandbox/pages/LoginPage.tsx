import { useState, type FormEvent } from 'react';
import { Field } from '../components/Field.tsx';
import { CREDENTIALS } from '../store.ts';

export function LoginPage({ onSignIn }: { onSignIn: () => void }) {
  const [error, setError] = useState('');

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email')).trim();
    if (email === CREDENTIALS.email && form.get('password') === CREDENTIALS.password) onSignIn();
    else setError('Invalid email or password');
  };

  return (
    <main>
      <form className="card login" noValidate onSubmit={submit}>
        <h1>Sign in to Acme</h1>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <Field id="email" label="Email">
          <input id="email" name="email" type="email" autoComplete="username" />
        </Field>
        <Field id="password" label="Password">
          <input id="password" name="password" type="password" autoComplete="current-password" />
        </Field>
        <label className="check">
          <input id="remember" type="checkbox" />
          Remember me
        </label>
        <button className="btn btn-primary" id="sign-in" type="submit">
          Sign in
        </button>
      </form>
    </main>
  );
}
