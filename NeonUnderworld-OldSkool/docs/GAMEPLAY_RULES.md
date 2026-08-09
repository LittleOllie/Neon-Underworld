# OldSkool Gameplay Rules

Central rules for the first playable loop. Numeric constants live in `src/config/empire-rules.ts`, `src/config/valuations.ts`, and shared `@core/config/game/shop-rules.ts`.

## Core loop

```text
Scout → recruit Workers and Thugs
Produce → drugs + worker cash (payout split)
City Shop → support supplies only
repeat
```

**Personnel rule:** Workers and Thugs are **not** sold by the NPC City Shop. Scout is the primary recruitment route. Future systems: attacks, player Market auctions, events.

## Turn rules (canonical)

| Rule | Value |
|------|-------|
| Regeneration | 2 turns every 6 minutes |
| Turn cap | 5,000 |
| Starting turns | 50 |

Legacy `PlayerTurnState` rows are migrated via `20260807010000_canonical_turn_state`. Balances above 5,000 are clamped. Report: `npm run db:backfill-turns`.

## City Shop

| Category | Items |
|----------|-------|
| Weapons | Glock, Uzi, AK-47 |
| Vehicles | Ride |
| Worker supplies | Condoms, Hash |
| Thug supplies | Beer |
| Drugs | Hash, Shrooms, Coke, Heroin (optional drugs priced inefficiently vs Produce) |

- Prices are server-authoritative in `@core/config/game/shop-rules.ts`
- **Hash $8** — above the $5 drug net-worth unit (no shop arbitrage)
- Convenience premium on all net-worth items — NPC shop never manufactures rank
- Purchases record `SHOP_PURCHASE` activity
- Weapons, beer, condoms do **not** affect net worth
- Rides and drugs use canonical valuations

## Scout

- Five areas per city with distinct Worker/Thug tendencies (High / Medium / Low — no raw multipliers in UI)
- Turn spend selectable; worker cash generated during turn use respects payout
- Creates `SCOUT` activity and private scout report

## Produce

- Thugs produce drugs; turns spent; workers generate cash
- Payout determines player vs worker cash split
- Output varies by drug type, thugs, and configured rules
- Estimated ranges shown before confirm; exact totals on result screen

## Worker payout

| Rule | Value |
|------|-------|
| Minimum | 1% |
| Maximum | 100% |
| Increment | 1% |

**Trade-off (no universal optimum):**

- **Lower payout** — player keeps more worker-generated cash; reduced worker stability
- **Higher payout** — less retained cash; improved worker stability and future defence
- **100%** — defensive; no retained worker income from operations

Morale/happiness uses status bands in UI: Excellent, Stable, Unsettled, Critical. Exact formulas stay in the shared happiness engine.

## Bank transfers

| Rule | Value |
|------|-------|
| Minimum transaction | $1 |
| Fee | 0% |
| Blocked while travelling | Yes |

Net worth unchanged when moving cash ↔ bank.

## Arming

```
armedThugs = min(thugs, glocks + uzis + aks)
```

Weapons excluded from OldSkool net worth.

## Attack v1 (live)

Central config: `@core/config/game/attack-rules.ts`

### Prerequisites

- Valid **player intel** Scout report (5 turns to gather; 48h expiry)
- Target within **0.5×–2×** canonical net worth (bank included in NW; banking does not remove you from range)
- Sufficient turns, thugs, and rides

### Attack types

| Type | Turns | Purpose |
|------|-------|---------|
| Drive-By Shooting | 2 | Kill defending thugs; no asset theft |
| Home Invasion | 3 | Steal **cash on hand** only (bank protected) |
| Raid Drug Labs | 3 | Steal drugs proportionally from stock |

### Logistics (Neon simplification)

- **1 ride per 5 attacking thugs** (`ceil(thugs / 5)`) — applies to all three v1 mobile attacks
- Weapons allocated strongest-first (AK → Uzi → Glock); **not consumed** in v1
- **20 attacks per target** per rolling 24h (all types combined)

### Combat

- Server-authoritative resolution with seeded randomness (force composition dominates; luck is bounded)
- Both sides may lose thugs; no player death, hospital, or jail in v1
- **Cartel defence:** structural support only — not active until cartel assets exist
- Private ATTACK / DEFENCE reports; Command notification for defenders

## Future Black Market (not live)

Player-to-player auctions only — no Buy Now. Personnel, rides, weapons, drugs may be listed. Tradability metadata preserved in `shop-rules.ts` / personnel catalog.

## Unavailable this sprint

Travel, cartels UI, brothel/coffee-shop attacks, steal workers, jack vehicles, tag-team, player death, hospital/jail timers, Black Market, business attacks.
