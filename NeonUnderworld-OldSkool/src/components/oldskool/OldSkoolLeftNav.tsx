'use client';

import Link from 'next/link';
import { LogoutLink } from '@local/components/oldskool/LogoutLink';

const NAV_MAIN = [
  { href: '/command', label: 'Command' },
  { href: '/scout', label: 'Scout' },
  { href: '/empire', label: 'Empire' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/guides', label: 'Guides' },
];

const NAV_OPS = [
  { href: '/operations', label: 'Operations' },
  { href: '/produce', label: 'Produce' },
  { href: '/shop', label: 'City Shop' },
  { href: '/attack', label: 'Attack' },
  { href: '/travel', label: 'Travel' },
  { href: '/reports', label: 'Reports' },
];

const NAV_ECON = [
  { href: '/market', label: 'Black Market' },
  { href: '/coming/businesses', label: 'Businesses', soon: true },
];

const NAV_SOCIAL = [
  { href: '/cartels', label: 'Cartel' },
  { href: '/coming/messages', label: 'Messages', soon: true },
  { href: '/coming/online', label: 'Online Players', soon: true },
];

export function OldSkoolLeftNav({ activePath }: { activePath: string }) {
  return (
    <nav className="os-left-nav" aria-label="Main navigation">
      <NavGroup title="Main" items={NAV_MAIN} activePath={activePath} />
      <NavGroup title="Operations" items={NAV_OPS} activePath={activePath} />
      <NavGroup title="Economy" items={NAV_ECON} activePath={activePath} />
      <NavGroup title="Social" items={NAV_SOCIAL} activePath={activePath} />
      <div style={{ marginTop: 8, padding: '0 10px' }}>
        <LogoutLink />
      </div>
    </nav>
  );
}

function NavGroup({
  title,
  items,
  activePath,
}: {
  title: string;
  items: Array<{ href: string; label: string; soon?: boolean }>;
  activePath: string;
}) {
  return (
    <div className="os-nav-group">
      <p className="os-nav-group-title">{title}</p>
      <ul className="os-nav-list">
        {items.map((item) => {
          const active = activePath === item.href || activePath.startsWith(item.href + '/');
          const className = [
            'os-nav-link',
            active && 'os-nav-link--active',
            item.soon && 'os-nav-link--soon',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={`${title}-${item.href}`}>
              <Link href={item.href} className={className} aria-disabled={item.soon}>
                {item.label}
                {item.soon && <span className="os-coming-soon"> soon</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OldSkoolMobileNav({ activePath }: { activePath: string }) {
  return (
    <div
      className="os-mobile-nav"
      style={{ display: 'none', padding: '6px 10px', borderBottom: '1px solid var(--os-border)' }}
    >
      <select
        defaultValue={activePath}
        onChange={(e) => {
          window.location.href = e.target.value;
        }}
        className="os-input"
        style={{ width: '100%' }}
        aria-label="Navigate"
      >
        {[...NAV_MAIN, ...NAV_OPS, ...NAV_ECON, ...NAV_SOCIAL].map((item) => (
          <option key={`${item.label}-${item.href}`} value={item.href}>
            {item.label}{'soon' in item && item.soon ? ' (soon)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
