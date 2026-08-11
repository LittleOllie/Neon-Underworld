import Link from 'next/link';
import type { AttentionItem } from '@local/lib/attention-items';
import { GameIcon } from './GameIcon';
import type { GameIconName } from '@local/config/game-icons';

const ALERT_ICONS: Record<NonNullable<AttentionItem['icon']>, GameIconName> = {
  reports: 'reports',
  warning: 'warning',
  info: 'turns',
};

function AlertContent({ item }: { item: AttentionItem }) {
  const iconName = item.icon ? ALERT_ICONS[item.icon] : undefined;

  return (
    <span className="g-alert-inner">
      {iconName && (
        <GameIcon
          name={iconName}
          size={18}
          tone={item.severity === 'alert' ? 'warn' : 'muted'}
        />
      )}
      <span>
        {item.headline && <strong className="g-alert-headline">{item.headline}</strong>}
        {item.value && (
          <>
            <span className="g-alert-value">{item.value}</span>{' '}
          </>
        )}
        <span className="g-alert-text">{item.label ?? item.text}</span>
      </span>
    </span>
  );
}

export function AlertList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="g-section">
      {items.map((item) => {
        const severityClass =
          item.severity === 'critical'
            ? ' g-alert--critical'
            : item.severity === 'alert'
              ? ' g-alert--warn'
              : ' g-alert--info';
        const className = `g-alert${severityClass}`;

        return item.href ? (
          <Link key={item.id} href={item.href} className={className}>
            <AlertContent item={item} />
          </Link>
        ) : (
          <p key={item.id} className={className}>
            <AlertContent item={item} />
          </p>
        );
      })}
    </div>
  );
}
