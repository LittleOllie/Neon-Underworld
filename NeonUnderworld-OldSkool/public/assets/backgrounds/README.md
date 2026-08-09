# Background images

Drop artwork here. Files in `public/` are served from the site root, e.g.:

`public/assets/backgrounds/global/bg.webp` → `http://localhost:3302/assets/backgrounds/global/bg.webp`

## Folders

| Folder | Use |
|--------|-----|
| `global/` | Site-wide backdrop (shell / body) |
| `pages/` | Optional per-screen art (home, scout, shop, etc.) |
| `auth/` | Login / register |

## Suggested filenames

**Global**

- `bg.webp` or `bg.jpg` — main backdrop

**Pages** (optional)

- `command.webp` — Home
- `scout.webp`
- `produce.webp`
- `shop.webp`
- `rankings.webp`
- `empire.webp`
- `attack.webp`

**Auth**

- `login.webp`

Use whatever names you prefer; wire them in `src/config/backgrounds.ts`.

## Formats

Prefer **WebP** or **JPEG** for photos. Use **PNG** only if you need transparency.

Target width: **1920px** (mobile will scale down). Keep files reasonably compressed for mobile.

## Enable backgrounds

1. Drop your file(s) into the folder above.
2. Open `src/config/backgrounds.ts` and set the matching path(s), e.g. `'/assets/backgrounds/global/bg.webp'`.
3. Save — the dev server picks up new files in `public/` automatically.

CSS hooks live in `src/styles/backgrounds.css` (overlay, cover, fixed attachment). Defaults keep the current flat colour until you set a path.

## Notes

- Do not commit huge uncompressed originals if you can avoid it.
- Text/UI readability: use a dark overlay in `backgrounds.css` (`--os-bg-overlay`) if the art is busy.
- Per-page backgrounds are optional; global alone is enough for most cases.
