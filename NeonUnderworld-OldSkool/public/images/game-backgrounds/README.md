# Game page backgrounds

Drop cinematic background illustrations here. Each file maps to a game page automatically.

## Filenames

| File | Page |
|------|------|
| `home.webp` or `home.png` | Home (`/command`) |
| `empire.webp` or `empire.png` | Empire |
| `scout.webp` or `scout.png` | Scout |
| `produce.webp` | Produce |
| `shop.webp` | Shop |
| `rankings.webp` | Rankings |
| `intel.webp` or `intel.png` | Player profile / intel (`/players/[alias]`) |
| `attack.webp` | Attack |
| `reports.webp` | Reports (list + detail) |
| `guides.webp` | Guides |
| `businesses.webp` or `businesses.png` | Businesses |
| `settings.webp` or `settings.png` | Settings |

**Reserved (art ready, page not live yet):**

| `markets.png` | Market — use `background="market"` when the Market page ships |
| `travel.png` | Travel — use `background="travel"` when the Travel page ships |
| `cartel.png` | Cartel — use `background="cartel"` when the Cartel page ships |

Do not wire reserved backgrounds to Coming Soon placeholders.

## Workflow

1. Save your artwork as e.g. `home.webp` or `home.png` in **this folder**
2. Refresh the game — Home uses it immediately

**Important:** files must be inside `game-backgrounds/`, not `public/images/` directly.

Expected names: `home`, `empire`, `scout`, `shop`, etc.

## Replacing an image

After overwriting a file (e.g. `intel.png`), bump its revision in `src/config/backgrounds.ts`:

```ts
GAME_BACKGROUND_REVISION: { intel: 3 }
```

This busts browser cache so the new art loads immediately.
3. Repeat for other pages — no code changes required

## Missing files

If a file does not exist yet, that page keeps the default dark background. No errors, no broken icons.

## Format

- **WebP** preferred (PNG acceptable)
- Target width ~1920px, compressed for mobile
- Central subject in the middle ~40–50% (portrait crop will trim sides)
- No text, logos, or UI in the artwork

## Tuning (optional)

- Art opacity: `--g-page-bg-opacity` in `src/styles/backgrounds.css`
- Per-page crop position: `GAME_BACKGROUND_POSITION` in `src/config/backgrounds.ts`
