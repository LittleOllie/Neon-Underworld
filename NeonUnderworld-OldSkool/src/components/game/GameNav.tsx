'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DESKTOP_NAV, MOBILE_NAV, navIsActive } from '@local/config/navigation';
import type { GlobalStats } from './GlobalStatus';
import { GameIcon } from './GameIcon';
import { MoreMenu } from './MoreMenu';

function NavLabel({
  label,
  icon,
  showAttentionDot,
}: {
  label: string;
  icon?: Parameters<typeof GameIcon>[0]['name'];
  showAttentionDot?: boolean;
}) {
  if (!icon) return <>{label}</>;
  return (
    <span className="g-nav-link-inner">
      <GameIcon name={icon} size={16} />
      <span>{label}</span>
      {showAttentionDot && <span className="g-nav-attention-dot" aria-hidden />}
    </span>
  );
}

export function GameNav({ stats }: { stats?: GlobalStats }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const attentionCount = stats?.attention?.total ?? 0;

  const openMore = () => setMoreOpen(true);
  const closeMore = () => setMoreOpen(false);

  return (
    <>
      <nav className="g-nav-desktop" aria-label="Main navigation">
        {DESKTOP_NAV.map((item) =>
          item.isMore ? (
            <button key={item.label} type="button" onClick={openMore} aria-label="More menu">
              <NavLabel
                label={item.label}
                icon={item.icon}
                showAttentionDot={attentionCount > 0}
              />
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={navIsActive(pathname, item.href) ? 'g-nav-active' : undefined}
            >
              <NavLabel label={item.label} icon={item.icon} />
            </Link>
          ),
        )}
      </nav>

      <nav className="g-nav-mobile" aria-label="Mobile navigation">
        <div className="g-nav-mobile-inner">
          {MOBILE_NAV.map((item) =>
            item.isMore ? (
              <button key={item.label} type="button" onClick={openMore} aria-label="More menu">
                <NavLabel
                  label={item.label}
                  icon={item.icon}
                  showAttentionDot={attentionCount > 0}
                />
              </button>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={navIsActive(pathname, item.href) ? 'g-nav-active' : undefined}
              >
                <NavLabel label={item.label} icon={item.icon} />
              </Link>
            ),
          )}
        </div>
      </nav>

      {moreOpen && (
        <MoreMenu
          onClose={closeMore}
          unreadReports={stats?.attention?.unreadReports ?? 0}
        />
      )}
    </>
  );
}
