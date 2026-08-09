import type { PlayerModel } from '@local/domain/player.model';

interface CommandHeaderProps {
  player: PlayerModel;
}

export function CommandHeader({ player }: CommandHeaderProps) {
  return (
    <header className="old-command-header">
      <div className="old-command-header-main">
        <h1 className="old-command-username">{player.username}</h1>
        <p className="old-command-meta">
          {player.city} · Rank #{player.rank} · Round {player.roundNumber}
        </p>
      </div>
      <div className="old-command-header-status">
        <span className={player.online ? 'old-status-online' : 'old-status-offline'}>
          {player.online ? '● Online' : '○ Offline'}
        </span>
        {player.lastSeen && (
          <span className="old-command-lastseen">
            Last seen {player.lastSeen.toLocaleString()}
          </span>
        )}
      </div>
    </header>
  );
}
