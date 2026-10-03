import type { FormEvent } from 'react';
import { Field } from '../components/Field.tsx';
import type { Settings } from '../store.ts';

const THEMES = ['Light', 'Dark'];

/** Changes apply on Save; leaving the page without saving drops them. */
export function SettingsPage({ settings, onSave }: { settings: Settings; onSave: (settings: Settings) => void }) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSave({ twoFactor: form.has('twoFactor'), alerts: form.has('alerts'), theme: String(form.get('theme')) });
  };

  return (
    <main>
      <h1>Settings</h1>
      <form className="card" onSubmit={submit}>
        <label className="check">
          <input id="two-factor" name="twoFactor" type="checkbox" defaultChecked={settings.twoFactor} />
          Two-factor authentication
        </label>
        <label className="check">
          <input id="alerts" name="alerts" type="checkbox" defaultChecked={settings.alerts} />
          Email alerts
        </label>
        <Field id="theme" label="Theme">
          <select id="theme" name="theme" defaultValue={settings.theme}>
            {THEMES.map((theme) => (
              <option key={theme} value={theme}>
                {theme}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn btn-primary" id="settings-save" type="submit">
          Save
        </button>
      </form>
    </main>
  );
}
