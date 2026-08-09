# OldSkool Design Philosophy

## Goal

Recreate the **structural feeling** of early-2000s browser strategy games — dense tables, permanent navigation, visible rankings — without copying third-party branding or sacrificing modern usability.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER — brand, operator, district, season, server status    │
├───────────────┬──────────────────────────────┬───────────────┤
│ LEFT NAV      │ MAIN CONTENT                 │ RIGHT SIDEBAR │
│ text links    │ tables, forms, reports       │ season, top 5 │
├───────────────┴──────────────────────────────┴───────────────┤
│ FOOTER — version, shared-database note                       │
└──────────────────────────────────────────────────────────────┘
```

## Palette

| Role        | Colour        |
|-------------|---------------|
| Background  | Deep charcoal |
| Panels      | Gunmetal      |
| Text        | Warm off-white|
| Accent      | Aged gold     |
| Links       | Muted cyan    |
| Success     | Operational green |
| Warning     | Amber         |
| Danger      | Hostile red   |

## Typography

- Body: Tahoma / Verdana / system sans-serif at 14px
- Headings: bold sans, 17–21px
- Tables: 13px compact rows
- Brand: Impact-style condensed display

## Interaction rules

- Page navigation over modals
- Form submit → result screen
- Simple "Processing operation…" loading text
- No heavy animation libraries
- No glass cards or large hero numbers

## Mobile

- Left nav collapses to `<select>` menu
- Sidebar moves below main content
- Tables remain readable; no horizontal page overflow

## What OldSkool is not

- Not a parody or intentionally ugly site
- Not a cyberpunk dashboard with retro font
- Not a Bootstrap clone
- Not a fake terminal

## Canonical Net Worth

Net worth is **always calculated server-side** and **never stored** on the player record. All valuations live in `src/config/valuations.ts`.

### Formula

```
Net Worth =
  cash × 1
+ bankCash × 1
+ thugs × thug valuation
+ workers × worker valuation
+ vehicles × vehicle valuation
+ drugUnits × drug unit valuation
+ businesses × business valuation (via businessNetWorth())
```

Default valuations (configurable in one module):

| Asset | Valuation |
|-------|-----------|
| Cash | 1 |
| Bank cash | 1 |
| Thug | 700 |
| Worker | 1,750 |
| Vehicle | 2,000 |
| Drug unit | 5 |
| Business | 3,500 |

### Excluded from net worth

- Weapons (glocks, uzis, AKs)
- Beer, condoms, consumables
- Temporary boosts
- Cartel-owned resources
- Resources owned by another player

### Auction compatibility (future)

- Goods locked in an active auction remain in the **seller's** net worth until the sale completes.
- Cash locked in an active bid remains in the **bidder's** net worth until the auction resolves.
- When an auction completes, ownership and net worth transfer **atomically**.

## Activity Types

Canonical activity types live in `src/config/activity-types.ts`:

`LOGIN`, `SCOUT`, `RECRUIT_THUGS`, `RECRUIT_WORKERS`, `PRODUCTION`, `SHOP_PURCHASE`, `MARKET_LISTING`, `MARKET_BID`, `MARKET_SALE`, `TRAVEL`, `ATTACK`, `DEFENCE`, `BUSINESS`, `CARTEL`, `SYSTEM`

- **Scouting** records `SCOUT` — never `RECRUIT_THUGS` or `RECRUIT_WORKERS`.
- Dedicated recruit actions (future) will use `RECRUIT_THUGS` or `RECRUIT_WORKERS` explicitly.
- Legacy `RECRUIT` rows are normalised to `SCOUT` on read and were migrated in the database.

## Terminology (player-facing)

Internal DB names are unchanged. UI copy uses `src/config/terminology.ts`:

| Internal | OldSkool UI |
|----------|-------------|
| prostitutes | Workers |
| thugs | Thugs |
| district (field label) | City |
| district (proper name) | Neon Strip, Docklands, Old Quarter |

The UI must never display “Prostitutes”.

## Reports

`ReportService` (`src/server/services/report.service.ts`) provides private player reports:

- Create, list, unread count, mark one/all read, get by id with ownership check
- Scout success creates a `SCOUT` report with a JSON snapshot (district, outcomes, resources, expiry)
- Command “Recent Reports” and `/reports` consume the same service

Report types supported now: `SCOUT`, `SYSTEM`. Schema reserves `ATTACK`, `DEFENCE`, `TRAVEL`, `MARKET`, etc.

## Empire management (Phase 2)

`/empire` uses `EmpireService.getManagementData()` — one loader for personnel, finances, weapons, vehicles, drugs, businesses, readiness and empire activity.

Rules are centralised in `src/config/empire-rules.ts`. See [GAMEPLAY_RULES.md](./GAMEPLAY_RULES.md).

Bank deposit/withdraw use local wrappers in `src/server/actions/bank.actions.ts`. Net worth is unchanged when moving cash ↔ bank.

## Core loop (City Shop / Scout / Produce)

**Turns create personnel. Personnel create drugs and income. Cash buys support. Support protects growth.**

| System | Role |
|--------|------|
| Scout | Primary route for Workers and Thugs |
| Produce | Turn spend → drugs + worker cash (payout split) |
| City Shop | NPC support only — weapons, vehicles, supplies, inefficient optional drugs |
| Future Market | Player auctions — personnel tradable, not sold by City Shop |

Personnel valuations ($1,750 Worker / $700 Thug) remain in the catalog for net worth, rankings, and future auctions.

## Visual components

Playable pages use the Command visual family where updated:

- `OldPanel`, `OldTable`, `StatBox`, `SectionHeader`, `NotificationBar`
- Classic density — square panels, thin borders, gold accents, minimal animation
