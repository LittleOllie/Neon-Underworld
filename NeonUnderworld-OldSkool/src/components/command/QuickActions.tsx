import Link from 'next/link';
import { QUICK_ACTIONS } from '@local/config/game';

export function QuickActions() {
  return (
    <div className="old-quick-actions">
      {QUICK_ACTIONS.map((action) =>
        action.ready ? (
          <Link key={action.label} href={action.href} className="old-action-btn">
            {action.label}
          </Link>
        ) : (
          <span key={action.label} className="old-action-btn old-action-btn--soon" title="Coming soon">
            {action.label}
            <span className="old-action-soon">Soon</span>
          </span>
        ),
      )}
    </div>
  );
}
