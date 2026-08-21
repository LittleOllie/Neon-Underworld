# Neon Underworld — Phase 3 Artwork

Approved NU visual assets live here, separate from legacy `game-backgrounds/`.

## Layout

```
backgrounds/   Page environment art ({page}.webp served; {page}.png kept for rollback)
brand/         Logos and brand marks (nu-logo.webp served; nu-logo.png kept for rollback)
characters/    Master atmospheric characters (operator.png)
```

## WebP delivery (performance)

Gameplay backgrounds and the brand logo are served as **WebP** from `nu-backgrounds.ts` / `nu-brand.ts`. Original PNG/JPEG-in-PNG files remain alongside for rollback. Revisions in config cache-bust browser fetches when assets change.

- **Backgrounds:** WebP quality **88**, effort 6, smartSubsample
- **Brand logo (RGBA):** WebP quality **92**, alphaQuality 92
- **Operator:** not converted (disabled layer; needs proper RGBA re-export first)

## Layer stack (gameplay pages)

1. Page environment — `NuScene` layer 1 (`backgrounds/{page}.webp`)
2. Optional atmosphere — reserved
3. Master Operator — `NuOperator` (`characters/operator.png`)
4. Readability overlays — gradients / vignette
5. Application UI — page content (z-index above scene)

Entry screens (login, boot) use `NuBackground` with `intro.webp` only — intro art includes its own cinematic figure. Do **not** composite the master Operator over intro.

## Replacing the master Operator

Replace `characters/operator.png` and bump `NU_OPERATOR_REVISION` in `src/config/nu-characters.ts`. Every gameplay page using `NuScene` / `<NuOperator />` updates automatically.

The Operator must be a **genuine RGBA PNG with transparency** for clean compositing over environments.

## Adding a page background

1. Add `{key}.webp` under `backgrounds/` (keep `{key}.png` for rollback during art iteration)
2. Register the key in `src/config/nu-backgrounds.ts` (set `showOperator: true` when appropriate)
3. Wire the page shell to `<NuScene background="key" />` instead of legacy `GamePageBackground`

Do not register keys until the file exists.

## Intro (Phase 3A)

- **File:** `backgrounds/intro.png`
- **Focal point:** `47% center` (desktop), `49% center` (mobile) — pans art right so silhouette sits under centered logo
- **Used by:** AuthShell (login/register/forgot-password), BootScreen entry
- **Operator:** off (built into cinematic art)

## Command (Phase 3B)

- **File:** `backgrounds/command.png` (revision 2 — rooftop cityscape)
- **Focal point:** `center center`
- **Used by:** `/command` via `NuScene`
- **Operator:** off

## Empire (Phase 3B)

- **File:** `backgrounds/empire.png` (revision 2 — compound courtyard)
- **Focal point:** `center center`
- **Used by:** `/empire` via `NuScene`
- **Operator:** off (environment-led)

## Scout (Phase 3B)

- **File:** `backgrounds/scout.png`
- **Focal point:** `center center`
- **Used by:** `/scout` via `NuScene`
- **Operator:** off

## Operations (Phase 3B)

- **File:** `backgrounds/operations.png`
- **Focal point:** `center center`
- **Used by:** `/produce` (Operations nav) via `NuScene`
- **Operator:** off

## Shop (Phase 3B)

- **File:** `backgrounds/shop.png`
- **Focal point:** `center center`
- **Used by:** `/shop` via `NuScene`
- **Operator:** off

## Market (Phase 3B)

- **File:** `backgrounds/market.png`
- **Focal point:** `center center`
- **Used by:** `/market` via `NuScene`
- **Operator:** off

## Attack (Phase 3B)

- **File:** `backgrounds/attack.png`
- **Focal point:** `center center`
- **Used by:** `/attack` via `NuScene`
- **Operator:** off

## Intel (Phase 3B)

- **File:** `backgrounds/intel.png`
- **Focal point:** `center center`
- **Used by:** reserved (unmapped)
- **Operator:** off

## Reports (Phase 3B)

- **File:** `backgrounds/reports.png`
- **Focal point:** `center center`
- **Used by:** `/reports` via `NuScene`
- **Operator:** off

## Factions (Phase 3B)

- **File:** `backgrounds/factions.png`
- **Focal point:** `center center`
- **Used by:** `/cartels` (Factions nav) via `NuScene`
- **Operator:** off

## Businesses (Phase 3B)

- **File:** `backgrounds/businesses.png`
- **Focal point:** `center center`
- **Used by:** `/businesses` via `NuScene`
- **Operator:** off

## Travel (Phase 3B)

- **File:** `backgrounds/travel.png`
- **Focal point:** `center center`
- **Used by:** `/travel` via `NuScene`
- **Operator:** off

## Rankings (Phase 3B)

- **File:** `backgrounds/rankings.png`
- **Focal point:** `center center`
- **Used by:** `/rankings` via `NuScene`
- **Operator:** off

## Guides / How to Play (Phase 3B)

- **File:** `backgrounds/guides.png`
- **Focal point:** `center center`
- **Used by:** `/how-to-play` (and legacy `/guides` redirect) via `NuScene`
- **Operator:** off

## Settings (Phase 3B)

- **File:** `backgrounds/settings.png`
- **Focal point:** `center center`
- **Used by:** `/settings` via `NuScene`
- **Operator:** off

## Identity (Phase 3B)

- **File:** `backgrounds/identity.png` → served as `identity.webp`
- **Focal point:** `center center`
- **Used by:** `/identity/select` (Choose / Change Your Identity) via `NuScene`
- **Operator:** off (environment includes portrait gallery walls)
