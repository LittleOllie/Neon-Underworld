'use client';

import Link from 'next/link';
import { MORE_ITEMS } from '@local/config/navigation';
import { LogoutLink } from '@local/components/oldskool/LogoutLink';
import { GameIcon } from './GameIcon';

/** Routes that perform server-side mutations on load — never prefetch. */
const NO_PREFETCH_HREFS = new Set(['/market', '/travel', '/cartels']);

export function MoreMenu({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button type="button" className="g-more-overlay" aria-label="Close menu" onClick={onClose} />
      <div className="g-more-panel" role="dialog" aria-label="More">
        {MORE_ITEMS.map((item) =>
          item.action === 'logout' ? (
            <div key={item.label} className="g-more-link" onClick={onClose}>
              <LogoutLink />
            </div>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              prefetch={NO_PREFETCH_HREFS.has(item.href) ? false : undefined}
              className={`g-more-link${item.unavailable ? ' g-more-muted' : ''}`}
              onClick={onClose}
            >
              <span className="g-icon-label">
                {item.icon && <GameIcon name={item.icon} size={18} tone={item.unavailable ? 'muted' : 'default'} />}
                <span>
                  {item.label}
                  {item.unavailable ? ` — ${item.unavailable}` : ''}
                </span>
              </span>
            </Link>
          ),
        )}
      </div>
    </>
  );
}
