# Monthly economy simulation (dev-only)

**Not imported by the production app.** Run manually:

```bash
npx tsx scripts/monthly-game-sim.ts
```

## Safety

- **No database** — does not import Prisma or touch Player records.
- **No server actions** — uses pure `src/lib/game-engine/*` and `src/config/*` helpers only.
- **In-memory state** — all empire data lives in local `SimState` objects during a run.
- **File output only** — writes `scripts/output/monthly-sim-results.json` when the CLI is executed.
- **No auto-execute on import** — the runner script executes only when invoked via `tsx`; the engine module exports functions only.

Re-run after rule changes to refresh balance analysis. Gameplay constants are read from live config, never mutated by the sim.
