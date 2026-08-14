'use client';

import Link from 'next/link';
import { buildMoreMenuSections } from '@local/config/navigation';
import { shouldPrefetchRoute } from '@local/config/prefetch-policy';
import { LogoutLink } from '@local/components/oldskool/LogoutLink';
import { GameIcon } from './GameIcon';

/** @deprecated Use prefetch-policy — kept for tests referencing the set name. */
const NO_PREFETCH_HREFS = new Set([
  '/produce',
  '/empire',
  '/attack',
  '/market',
  '/travel',
  '/cartels',
  '/businesses',
  '/reports',
]);
export { NO_PREFETCH_HREFS };

export function MoreMenu({
  onClose,
  unreadReports = 0,
}: {
  onClose: () => void;
  unreadReports?: number;
}) {
  const sections = buildMoreMenuSections({ unreadReports });

  return (
    <>
      <button type="button" className="g-more-overlay" aria-label="Close menu" onClick={onClose} />
      <div className="g-more-panel" role="dialog" aria-label="More">
        {sections.map((section) => (
          <div key={section.id} className="g-more-section">
            <p className="g-more-section-label">{section.label}</p>
            {section.items.map((item) =>
              item.action === 'logout' ? (
                <div key={item.label} className="g-more-link" onClick={onClose}>
                  <LogoutLink />
                </div>
              ) : item.unavailable ? (
                <span
                  key={item.href}
                  className="g-more-link g-more-muted g-more-unavailable"
                  aria-disabled="true"
                >
                  <span className="g-more-link-row">
                    <span className="g-icon-label">
                      {item.icon && <GameIcon name={item.icon} size={18} tone="muted" />}
                      <span>
                        {item.label} — {item.unavailable}
                      </span>
                    </span>
                  </span>
                </span>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={shouldPrefetchRoute(item.href) ? undefined : false}
                  className={`g-more-link${item.unavailable ? ' g-more-muted' : ''}`}
                  onClick={onClose}
                >
                  <span className="g-more-link-row">
                    <span className="g-icon-label">
                      {item.icon && (
                        <GameIcon
                          name={item.icon}
                          size={18}
                          tone={item.unavailable ? 'muted' : 'default'}
                        />
                      )}
                      <span>
                        {item.label}
                        {item.unavailable ? ` — ${item.unavailable}` : ''}
                      </span>
                    </span>
                    {item.badge != null && item.badge > 0 && (
                      <span className="g-more-badge" aria-label={`${item.badge} unread`}>
                        {item.badge}
                      </span>
                    )}
                  </span>
                </Link>
              ),
            )}
          </div>
        ))}
      </div>
    </>
  );
}
