import { ActionButton } from './ActionButton';

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <section className="g-empty-state" aria-label={title}>
      <p className="g-empty-state__title">{title}</p>
      {body ? <p className="g-empty-state__body">{body}</p> : null}
      {actionHref && actionLabel ? (
        <ActionButton href={actionHref}>{actionLabel}</ActionButton>
      ) : null}
    </section>
  );
}
