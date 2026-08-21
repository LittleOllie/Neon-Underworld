/** Default NU purple theme — fallback when no custom or character theme applies. */
export const NU_DEFAULT_THEME = {
  primary: '#9b59d0',
  secondary: '#6a0dad',
  glow: 'rgba(155, 89, 208, 0.45)',
  muted: 'rgba(155, 89, 208, 0.1)',
  mutedStrong: 'rgba(155, 89, 208, 0.18)',
} as const;

export type ThemePalette = {
  primary: string;
  secondary: string;
  glow: string;
  muted: string;
  mutedStrong: string;
};

export const NU_THEME_PRESETS: ThemePalette[] = [
  NU_DEFAULT_THEME,
  {
    primary: '#ff1493',
    secondary: '#6a0dad',
    glow: 'rgba(255, 20, 147, 0.45)',
    muted: 'rgba(255, 20, 147, 0.1)',
    mutedStrong: 'rgba(255, 20, 147, 0.18)',
  },
  {
    primary: '#00e5ff',
    secondary: '#0066cc',
    glow: 'rgba(0, 229, 255, 0.4)',
    muted: 'rgba(0, 229, 255, 0.1)',
    mutedStrong: 'rgba(0, 229, 255, 0.18)',
  },
  {
    primary: '#c9a962',
    secondary: '#8b6914',
    glow: 'rgba(201, 169, 98, 0.45)',
    muted: 'rgba(201, 169, 98, 0.1)',
    mutedStrong: 'rgba(201, 169, 98, 0.18)',
  },
  {
    primary: '#39ff14',
    secondary: '#1a5c0e',
    glow: 'rgba(57, 255, 20, 0.35)',
    muted: 'rgba(57, 255, 20, 0.1)',
    mutedStrong: 'rgba(57, 255, 20, 0.16)',
  },
];
