'use client';

import { GAME_ICONS, type GameIconName } from '@local/config/game-icons';

export type GameIconTone = 'default' | 'warn' | 'danger' | 'positive' | 'muted';

const TONE_CLASS: Record<GameIconTone, string> = {
  default: '',
  warn: 'g-icon--warn',
  danger: 'g-icon--danger',
  positive: 'g-icon--positive',
  muted: 'g-icon--muted',
};

export function GameIcon({
  name,
  size = 18,
  tone = 'default',
  className,
}: {
  name: GameIconName;
  size?: number;
  tone?: GameIconTone;
  className?: string;
}) {
  const Icon = GAME_ICONS[name];
  const classes = ['g-icon', TONE_CLASS[tone], className].filter(Boolean).join(' ');

  return <Icon size={size} strokeWidth={2} className={classes} aria-hidden="true" />;
}
