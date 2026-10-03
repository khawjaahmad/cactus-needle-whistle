import type { ReactNode } from 'react';

/** A labelled control; the studio's driver and the exported specs find controls by these labels. */
export function Field({
  id,
  label,
  className = 'field',
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}
