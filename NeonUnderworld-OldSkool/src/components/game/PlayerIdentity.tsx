import Link from 'next/link';
import { PlayerAvatar, type PlayerAvatarSize } from './PlayerAvatar';
import { resolvePlayerAvatarId } from '@core/lib/game-engine/resolve-player-avatar';

export interface PlayerIdentityData {
  alias: string;
  avatarId?: string | null;
  aliasNormalized?: string;
  cartelTag?: string | null;
  netWorth?: number;
  rank?: number;
  city?: string;
}

export interface PlayerIdentityProps {
  player: PlayerIdentityData;
  avatarSize?: PlayerAvatarSize;
  shape?: 'circle' | 'square';
  showCartel?: boolean;
  showNetWorth?: boolean;
  showRank?: boolean;
  showCity?: boolean;
  href?: string;
  suffix?: string;
  className?: string;
  /** When true, alias is not linked even if href is set. */
  static?: boolean;
}

function formatMeta(parts: Array<string | null | undefined>): string | null {
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(' · ') : null;
}

export function PlayerIdentity({
  player,
  avatarSize = 'sm',
  shape = 'circle',
  showCartel = false,
  showNetWorth = false,
  showRank = false,
  showCity = false,
  href,
  suffix,
  className,
  static: isStatic = false,
}: PlayerIdentityProps) {
  const resolvedHref =
    href ?? (player.aliasNormalized ? `/players/${player.aliasNormalized}` : undefined);
  const meta = formatMeta([
    showCity ? player.city : null,
    showCartel && player.cartelTag ? `[${player.cartelTag}]` : null,
    showRank && player.rank != null && player.rank > 0 ? `#${player.rank}` : null,
    showNetWorth && player.netWorth != null
      ? `$${player.netWorth.toLocaleString()}`
      : null,
  ]);

  const aliasNode = (
    <span className="g-player-identity__alias">
      {player.alias}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );

  return (
    <span
      className={['g-player-identity', className ?? ''].filter(Boolean).join(' ')}
      data-avatar-id={resolvePlayerAvatarId(player.avatarId)}
    >
      <PlayerAvatar avatarId={player.avatarId} alt={player.alias} size={avatarSize} shape={shape} />
      <span className="g-player-identity__text">
        {!isStatic && resolvedHref ? (
          <Link href={resolvedHref} className="g-player-identity__link">
            {aliasNode}
          </Link>
        ) : (
          aliasNode
        )}
        {meta && <span className="g-player-identity__meta">{meta}</span>}
      </span>
    </span>
  );
}
