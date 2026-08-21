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
| Regeneration | 2 turns every 5 minutes |
| Turn cap | 5,000 |
| Starting turns | 500 |

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
- Turn spend selectable (1–5,000 per action); recruitment scales linearly with turns — **no per-action hard caps**
- Base recruitment tuned for ~5–10 Workers / ~4–8 Thugs per 100 turns at healthy morale (varies by area/district/happiness)
- Worker cash during scouting uses **starting roster** for that action (recruits from the same action do not boost cash)
- Low morale can cause walkouts; large spends show a warning before confirm; losses capped per action
- Creates `SCOUT` activity and private scout report

## Travel

- Instant relocation between cities for 10 turns
- Requires sufficient **ride capacity** for your crew (1 ride per 5 crew, minimum 1)
- **Rides are reusable** — travel checks capacity but does not consume/destroy vehicles

## Market

- Global player auctions for tradable items (weapons, rides, supplies, drugs, workers, thugs)
- 20% minimum bid increment; lazy settlement when listings expire
- Inventory escrowed on list; returned unsold or delivered to winning bidder exactly once

## Cartels

- Invite-only groups, max 5 members
- Optional cash donation 0–60% on Scout / Produce income
- Cartel treasury buys shared thugs, weapons, and rides
- **Response Force:** while at home, the cartel can send up to twice your personal thug count (minimum allowance 25), capped at 25% of current cartel thugs and limited by cartel rides (5 thugs per ride)
- Same-city cartel mates contribute 10% of their thugs as unarmed local backup
- Cartel thugs can die defending members — sustained attacks weaken the shared pool
- No cartel protection while travelling

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

- Gather **Basic Intel** on the target before attacking (5 turns; report valid 48 hours). Deep Intel is optional.
- Basic Intel does not lock eligibility — attack range is checked again live when you launch.
- Target net worth must be **60%–170% of your** canonical net worth.
- You cannot gather Basic Intel on players below your attack range (turns are not spent).
- Sufficient turns, thugs, and rides

### Attack types

| Type | Turns | Purpose |
|------|-------|---------|
| Drive-By Shooting | 2 | Win the force fight and inflict thug casualties; no asset theft |
| Home Invasion | 3 | Steal **cash on hand** only (bank protected) |
| Raid Drug Labs | 3 | Steal drugs proportionally from stock |
| Poach Workers | 4 | Steal Workers from a rival's street operation (minimum 25 Workers on target) |

### Logistics (Neon simplification)

- **1 ride per 5 attacking thugs** (`ceil(thugs / 5)`) — applies to all mobile attacks
- Weapons allocated strongest-first (AK → Uzi → Glock); **not consumed** in v1
- **20 attacks per target** per rolling 24h (all types combined)

### Offline protection

- Offline players (15+ minutes inactive) can receive up to **5 damaging attacks**, then offline protection activates.
- Non-damaging repulsed attacks do not count. Cartel thug losses count as damaging.
- Returning and staying **active for 30 continuous minutes** resets the protection cycle.
- Brief login/logout alone does not reset protection.

### Combat

- Server-authoritative resolution with seeded randomness (force composition dominates; luck is bounded)
- Both sides may lose thugs; no player death, hospital, or jail in v1
- **Drive-By:** success requires winning the force confrontation (strength + weapons) and inflicting at least one defender-side casualty — not merely losing fewer thugs than the defender
- **Cartel defence:** Response Force and local backup apply on defence only while the defender is **at home (not travelling)** — see Cartels section
- Private ATTACK / DEFENCE reports; Command notification for defenders

## Future Black Market (not live)

Player-to-player auctions only — no Buy Now. Personnel, rides, weapons, drugs may be listed. Tradability metadata preserved in `shop-rules.ts` / personnel catalog.

## Unavailable / deferred

Brothel/coffee-shop attacks, jack vehicles, tag-team, player death, hospital/jail timers, business attacks.
