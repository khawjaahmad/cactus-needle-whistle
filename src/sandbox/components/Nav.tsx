const LINKS = [
  ['/dashboard', 'Dashboard'],
  ['/users', 'Users'],
  ['/settings', 'Settings'],
] as const;

export function Nav({ current, onSignOut }: { current: string; onSignOut: () => void }) {
  return (
    <nav className="nav">
      <strong>Acme Admin</strong>
      {LINKS.map(([path, label]) => (
        <a key={path} href={`#${path}`} aria-current={current === path ? 'page' : undefined}>
          {label}
        </a>
      ))}
      <button className="btn" id="sign-out" type="button" onClick={onSignOut}>
        Sign out
      </button>
    </nav>
  );
}
