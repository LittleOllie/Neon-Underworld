'use client';

import Link from 'next/link';
import { OS_TERMS } from '@local/config/terminology';

interface SidebarPlayer {
  alias: string;
  city: string;
  turns: number;
  turnCap: number;
  cash: number;
  netWorth: number;
  rank: number;
  seasonLabel: string;
  seasonDay: string;
  daysRemaining: number;
}

interface Leader {
  rank: number;
  alias: string;
  netWorth: number;
}

export interface SidebarNotification {
  id: string;
  text: string;
  kind: 'alert' | 'info';
  href?: string;
}

interface OldSkoolRightSidebarProps {
  player: SidebarPlayer;
  leaders: Leader[];
  notifications: SidebarNotification[];
}

export function OldSkoolRightSidebar({ player, leaders, notifications }: OldSkoolRightSidebarProps) {
  return (
    <aside aria-label="Game sidebar">
      <SidebarModule title="Season">
        <p style={{ margin: 0, fontSize: 12 }}>{player.seasonLabel}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--os-text-dim)' }}>
          {player.seasonDay} · {player.daysRemaining} days left
        </p>
      </SidebarModule>

      <SidebarModule title="Your Status">
        <table className="os-table">
          <tbody>
            <tr><td>Alias</td><td className="num"><strong className="old-text-gold">{player.alias}</strong></td></tr>
            <tr><td>{OS_TERMS.city}</td><td className="num">{player.city}</td></tr>
            <tr><td>Turns</td><td className="num">{player.turns.toLocaleString()}</td></tr>
            <tr><td>Cash</td><td className="num old-text-gold">${player.cash.toLocaleString()}</td></tr>
            <tr><td>Net Worth</td><td className="num">${player.netWorth.toLocaleString()}</td></tr>
            <tr><td>Rank</td><td className="num">#{player.rank}</td></tr>
          </tbody>
        </table>
      </SidebarModule>

      <SidebarModule title="Top Players">
        <table className="os-table">
          <thead>
            <tr><th>#</th><th>Player</th><th className="num">NW</th></tr>
          </thead>
          <tbody>
            {leaders.map((l) => (
              <tr key={l.rank}>
                <td>{l.rank}</td>
                <td>
                  <Link href={`/players/${l.alias.toLowerCase()}`} className="os-link">
                    {l.alias}
                  </Link>
                </td>
                <td className="num">${l.netWorth.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SidebarModule>

      <SidebarModule title="Notifications">
        {notifications.length === 0 ? (
          <p className="old-empty">All clear.</p>
        ) : (
          <ul className="old-notify-list">
            {notifications.map((n) => (
              <li key={n.id} className={`old-notify-item old-notify-item--${n.kind}`}>
                {n.href ? (
                  <Link href={n.href} className="os-link" style={{ fontSize: 'inherit' }}>
                    {n.text}
                  </Link>
                ) : (
                  n.text
                )}
              </li>
            ))}
          </ul>
        )}
      </SidebarModule>
    </aside>
  );
}

function SidebarModule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="os-sidebar-module">
      <div className="os-sidebar-module-title">{title}</div>
      <div className="os-sidebar-module-body">{children}</div>
    </div>
  );
}
