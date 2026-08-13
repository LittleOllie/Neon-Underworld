/** Stable avatar IDs — persisted on Player.avatar (never image numbers or URLs). */
export type PlayerAvatarId =
  | 'viper'
  | 'raven'
  | 'ghost'
  | 'razor'
  | 'venom'
  | 'deacon'
  | 'doll'
  | 'spectre'
  | 'mercer'
  | 'spark'
  | 'don'
  | 'anarchy'
  | 'knuckles'
  | 'siren'
  | 'midas'
  | 'cherry'
  | 'grimm'
  | 'hex'
  | 'saint'
  | 'zero';

export interface PlayerAvatarConfig {
  id: PlayerAvatarId;
  /** Internal character name — not the player's alias. */
  name: string;
  imagePath: string;
  primary: string;
  secondary: string;
  glow: string;
  muted: string;
  mutedStrong: string;
  tagline: string;
  /** Reserved for future unlock/rarity systems. */
  category: 'founding';
  locked: boolean;
}

export const DEFAULT_PLAYER_AVATAR_ID: PlayerAvatarId = 'viper';

const AVATAR_LIST: PlayerAvatarConfig[] = [
  {
    id: 'viper',
    name: 'Viper',
    imagePath: '/avatars/viper.png',
    primary: '#ff1493',
    secondary: '#1a1a1a',
    glow: 'rgba(255, 20, 147, 0.45)',
    muted: 'rgba(255, 20, 147, 0.1)',
    mutedStrong: 'rgba(255, 20, 147, 0.18)',
    tagline: 'Strike first. Stay venomous.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'raven',
    name: 'Raven',
    imagePath: '/avatars/raven.png',
    primary: '#6a0dad',
    secondary: '#800080',
    glow: 'rgba(106, 13, 173, 0.45)',
    muted: 'rgba(106, 13, 173, 0.1)',
    mutedStrong: 'rgba(106, 13, 173, 0.18)',
    tagline: 'Watches from the shadows.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'ghost',
    name: 'Ghost',
    imagePath: '/avatars/ghost.png',
    primary: '#87ceeb',
    secondary: '#191970',
    glow: 'rgba(135, 206, 235, 0.45)',
    muted: 'rgba(135, 206, 235, 0.1)',
    mutedStrong: 'rgba(135, 206, 235, 0.18)',
    tagline: 'Here one tick. Gone the next.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'razor',
    name: 'Razor',
    imagePath: '/avatars/razor.png',
    primary: '#dc143c',
    secondary: '#0a0a0a',
    glow: 'rgba(220, 20, 60, 0.45)',
    muted: 'rgba(220, 20, 60, 0.1)',
    mutedStrong: 'rgba(220, 20, 60, 0.18)',
    tagline: 'Cuts clean through noise.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'venom',
    name: 'Venom',
    imagePath: '/avatars/venom.png',
    primary: '#adff2f',
    secondary: '#50c878',
    glow: 'rgba(173, 255, 47, 0.4)',
    muted: 'rgba(173, 255, 47, 0.1)',
    mutedStrong: 'rgba(173, 255, 47, 0.18)',
    tagline: 'Toxic reputation. Earned.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'deacon',
    name: 'Deacon',
    imagePath: '/avatars/deacon.png',
    primary: '#cc5500',
    secondary: '#ffbf00',
    glow: 'rgba(204, 85, 0, 0.45)',
    muted: 'rgba(204, 85, 0, 0.1)',
    mutedStrong: 'rgba(204, 85, 0, 0.18)',
    tagline: 'Old sins. New sermons.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'doll',
    name: 'Doll',
    imagePath: '/avatars/doll.png',
    primary: '#ff69b4',
    secondary: '#ff007f',
    glow: 'rgba(255, 105, 180, 0.45)',
    muted: 'rgba(255, 105, 180, 0.1)',
    mutedStrong: 'rgba(255, 105, 180, 0.18)',
    tagline: 'Soft look. Hard ledger.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'spectre',
    name: 'Spectre',
    imagePath: '/avatars/spectre.png',
    primary: '#645394',
    secondary: '#1a1a1a',
    glow: 'rgba(100, 83, 148, 0.45)',
    muted: 'rgba(100, 83, 148, 0.1)',
    mutedStrong: 'rgba(100, 83, 148, 0.18)',
    tagline: 'Ultraviolet menace.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'mercer',
    name: 'Mercer',
    imagePath: '/avatars/mercer.png',
    primary: '#008080',
    secondary: '#00ffff',
    glow: 'rgba(0, 128, 128, 0.45)',
    muted: 'rgba(0, 128, 128, 0.1)',
    mutedStrong: 'rgba(0, 128, 128, 0.18)',
    tagline: 'Deals flow where Mercer walks.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'spark',
    name: 'Spark',
    imagePath: '/avatars/spark.png',
    primary: '#ffff00',
    secondary: '#800080',
    glow: 'rgba(255, 255, 0, 0.35)',
    muted: 'rgba(255, 255, 0, 0.1)',
    mutedStrong: 'rgba(255, 255, 0, 0.16)',
    tagline: 'Chaos with perfect timing.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'don',
    name: 'Don',
    imagePath: '/avatars/don.png',
    primary: '#ffbf00',
    secondary: '#cd7f32',
    glow: 'rgba(255, 191, 0, 0.45)',
    muted: 'rgba(255, 191, 0, 0.1)',
    mutedStrong: 'rgba(255, 191, 0, 0.18)',
    tagline: 'Respect is currency.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'anarchy',
    name: 'Anarchy',
    imagePath: '/avatars/anarchy.png',
    primary: '#dc143c',
    secondary: '#8b0000',
    glow: 'rgba(220, 20, 60, 0.45)',
    muted: 'rgba(220, 20, 60, 0.1)',
    mutedStrong: 'rgba(220, 20, 60, 0.18)',
    tagline: 'Order is the enemy.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'knuckles',
    name: 'Knuckles',
    imagePath: '/avatars/knuckles.png',
    primary: '#4169e1',
    secondary: '#0047ab',
    glow: 'rgba(65, 105, 225, 0.45)',
    muted: 'rgba(65, 105, 225, 0.1)',
    mutedStrong: 'rgba(65, 105, 225, 0.18)',
    tagline: 'Talk less. Break more.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'siren',
    name: 'Siren',
    imagePath: '/avatars/siren.png',
    primary: '#e8ffff',
    secondary: '#c0c0c0',
    glow: 'rgba(0, 255, 255, 0.35)',
    muted: 'rgba(232, 255, 255, 0.08)',
    mutedStrong: 'rgba(232, 255, 255, 0.14)',
    tagline: 'They hear you before they see you.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'midas',
    name: 'Midas',
    imagePath: '/avatars/midas.png',
    primary: '#ffd700',
    secondary: '#1a1a1a',
    glow: 'rgba(255, 215, 0, 0.45)',
    muted: 'rgba(255, 215, 0, 0.1)',
    mutedStrong: 'rgba(255, 215, 0, 0.18)',
    tagline: 'Everything touched turns profit.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'cherry',
    name: 'Cherry',
    imagePath: '/avatars/cherry.png',
    primary: '#de3163',
    secondary: '#ff7f50',
    glow: 'rgba(222, 49, 99, 0.45)',
    muted: 'rgba(222, 49, 99, 0.1)',
    mutedStrong: 'rgba(222, 49, 99, 0.18)',
    tagline: 'Sweet front. Bitter finish.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'grimm',
    name: 'Grimm',
    imagePath: '/avatars/grimm.png',
    primary: '#b0b8c0',
    secondary: '#f5f5f5',
    glow: 'rgba(176, 184, 192, 0.4)',
    muted: 'rgba(176, 184, 192, 0.1)',
    mutedStrong: 'rgba(176, 184, 192, 0.16)',
    tagline: 'Cold steel. Colder math.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'hex',
    name: 'Hex',
    imagePath: '/avatars/hex.png',
    primary: '#b0bf1a',
    secondary: '#0a0a0a',
    glow: 'rgba(176, 191, 26, 0.45)',
    muted: 'rgba(176, 191, 26, 0.1)',
    mutedStrong: 'rgba(176, 191, 26, 0.18)',
    tagline: 'Cursed luck for everyone else.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'saint',
    name: 'Saint',
    imagePath: '/avatars/saint.png',
    primary: '#40e0d0',
    secondary: '#faf0e6',
    glow: 'rgba(64, 224, 208, 0.45)',
    muted: 'rgba(64, 224, 208, 0.1)',
    mutedStrong: 'rgba(64, 224, 208, 0.18)',
    tagline: 'Forgiveness is a tactic.',
    category: 'founding',
    locked: false,
  },
  {
    id: 'zero',
    name: 'Zero',
    imagePath: '/avatars/zero.png',
    primary: '#00ffff',
    secondary: '#e6e6fa',
    glow: 'rgba(0, 255, 255, 0.4)',
    muted: 'rgba(0, 255, 255, 0.1)',
    mutedStrong: 'rgba(0, 255, 255, 0.16)',
    tagline: 'Reset the board.',
    category: 'founding',
    locked: false,
  },
];

export const PLAYER_AVATARS: Record<PlayerAvatarId, PlayerAvatarConfig> = Object.fromEntries(
  AVATAR_LIST.map((avatar) => [avatar.id, avatar]),
) as Record<PlayerAvatarId, PlayerAvatarConfig>;

export const FOUNDING_PLAYER_AVATARS: PlayerAvatarConfig[] = AVATAR_LIST;

export function isPlayerAvatarId(value: string): value is PlayerAvatarId {
  return value in PLAYER_AVATARS;
}

export function getPlayerAvatarConfig(id: PlayerAvatarId): PlayerAvatarConfig {
  return PLAYER_AVATARS[id];
}
