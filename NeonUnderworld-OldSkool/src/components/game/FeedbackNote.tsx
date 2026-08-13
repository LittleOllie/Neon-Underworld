export type FeedbackTone = 'info' | 'error' | 'warn' | 'success';

export function FeedbackNote({
  tone = 'info',
  children,
  role,
}: {
  tone?: FeedbackTone;
  children: React.ReactNode;
  role?: 'alert' | 'status';
}) {
  const toneClass =
    tone === 'error'
      ? ' g-note-error'
      : tone === 'warn'
        ? ' g-note-warn'
        : tone === 'success'
          ? ' g-note-success'
          : '';
  return (
    <p className={`g-note${toneClass}`} role={role}>
      {children}
    </p>
  );
}
