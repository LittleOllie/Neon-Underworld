# Premium UI Pass

## Summary

Transformed the Sprint 1 prototype from a functional Tailwind starter into a cohesive, mobile-native product experience while preserving all game-engine logic, authentication, and server-authoritative mutations.

## Design principles

- **Clean** — each screen scannable in seconds
- **Premium** — typography, spacing, materials over decoration
- **Focused** — one purpose per page
- **Mobile-first** — 320px–390px primary targets
- **Calm** — restrained palette, gold as accent not default border
- **Cohesive** — shared shell, icons, terminology across all routes

## Typography

| Role | Font |
|------|------|
| Display / headings | Manrope |
| UI body | Inter |
| Figures / resources | JetBrains Mono |

## Palette

- Background: `#080809`
- Surfaces: graphite `#111114` / `#18181c`
- Brand gold: `#c4a055`
- Status: green (positive), amber (warning), red (critical), cyan (intel), purple (cartel/rankings)

## Components created

- `GameAppShell`, `GameTopBar`, `GameBottomNav`
- `BrandMark`, `ResourceStrip`, `HeroAction`
- `StatusPill`, `AlertItem`, `OperationItem`, `IntelItem`
- `SegmentedControl`, `ResourceGroup`, `ResourceRow`
- `ActivityTimeline`, `AlphaPreview`, `ScreenHeader`
- `TurnAmountSelector`, `ScoutResultPanel`

## Navigation

Five bottom-nav destinations with Lucide icons:

Command · Empire · Market · Operations · Cartel

`/syndicate` redirects to `/cartel`.

## Terminology

Central module: `src/config/game/terminology.ts`

Cartel replaces Syndicate in all player-facing UI.

## Season correction

- Seed updated to **30-day** seasons
- Display derived from database `startsAt` / `endsAt`
- Format: `Season 1 · Day 1 of 30 · 29 days remaining`

**Reseed required** for existing local databases to fix 90-day seasons:

```bash
npm run db:seed
```

Or manually update the `Season` row `endsAt` to `startsAt + 30 days`.

## Screens redesigned

- Command Centre
- Empire (tabbed sections)
- Scout flow (confirmation + result panel)
- Operations landing
- Market placeholder (Black Market)
- Cartel placeholder
- Rankings
- Public player profile
- Login / Register

## Responsive strategy

- Mobile: full-width content, fixed bottom nav, safe-area padding
- Desktop: contained column up to `max-w-2xl` / `lg:max-w-4xl`, same hierarchy

## Known limitations

- Notifications button is visual-only
- Cartel/Market/Produce/Attack are placeholders
- Rank movement on Command uses snapshot approximation
- E2E tests require Playwright browsers installed

## Logic preserved

No changes to turn regeneration, scouting formulas, net worth, auth rules, idempotency, audit logging, or transaction logic.
