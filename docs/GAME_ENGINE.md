# Game Engine

All game logic lives in `src/lib/game-engine/`. UI components must not duplicate formulas.

## Modules

| Module | Responsibility |
|--------|----------------|
| `turns.ts` | Regeneration, consumption, cap enforcement |
| `net-worth.ts` | Asset valuation |
| `scouting.ts` | Scout resolution and validation |
| `happiness.ts` | Prostitute/thug morale and departure risk |
| `rng.ts` | Deterministic seeded random numbers |
| `errors.ts` | Typed domain errors |
| `state.ts` | State snapshot helpers |

## Configuration

All balance values in `src/config/game/balance.ts`:

### Turns
- Starting: 500
- Regeneration: ~1,200/day (continuous, 50/hour)
- Cap: 12,000
- Scout min/max: 1 / 5,000

### Starting resources
- Cash: $2,500
- Prostitutes: 2, Thugs: 1
- Glocks: 1, Beer: 5, Condoms: 10, Hash: 5
- Payout: 50%

### Net worth values
- Cash: face value
- Prostitutes: $1,750 | Thugs: $700 | Rides: $2,000
- Hash/Shrooms/Coke/Heroin: $5 each
- Weapons, beer, condoms: excluded

### Scouting
- Base recruitment rates per turn with variance
- District modifiers (Neon Strip → prostitutes, Docklands → thugs, Old Quarter → consistency)
- Happiness affects recruitment multiplier
- Cash earned: prostitutes × $12 × turns spent
- Departure risk when happiness critical (reduced for new players)

## Turn engine

```
settleTurnRegeneration(state, now) → available turns (capped)
consumeTurns(settled, amount, now) → new anchor + remaining turns
```

Regeneration anchor advances proportionally when partial regeneration is consumed.

## Scouting flow

```
validateScoutAmount → resolveScouting (seeded) → update resources → audit
```

Idempotency: `GameAction` unique on `(playerId, idempotencyKey)`.

## Happiness (Sprint 1)

**Prostitutes:** hash coverage, condom coverage, thug protection ratio, payout percentage

**Thugs:** weapon points (glock=1, uzi=2, ak=3), beer per worker

Departure risk applied during scouting when happiness below thresholds.

## Testing

Unit tests cover turns, net worth, scouting determinism, happiness modifiers, and recommendations.
