# OldSkool Routes

## Public

| Route | Description |
|-------|-------------|
| `/` | Redirect to `/command` or `/login` |
| `/login` | Classic three-column login |
| `/register` | Invite registration with district radio buttons |
| `/rankings` | Season leaderboard (public; highlights you when logged in) |
| `/players/[alias]` | Public intelligence dossier |

## Authenticated — playable

| Route | Description |
|-------|-------------|
| `/command` | Homepage — attention, continue playing, latest events |
| `/operations` | Core loop hub — Scout, Produce, City Shop + contextual hints |
| `/scout` | Five-area recruitment; turn spend; scout report |
| `/produce` | Drug production with worker income and payout split |
| `/shop` | NPC City Shop — support supplies only (no Workers/Thugs) |
| `/underworld` | Competitive hub — Attack, Market, Rankings, Players |
| `/social` | Social hub — Cartel, Messages, Reports, Online |
| `/attack` | PvP combat — Drive-By, Home Invasion, Raid Drug Labs |
| `/empire` | Management centre — personnel bands, finances, readiness, inventory |
| `/guides` | In-game rules — Neon vs Redlite adaptations |
| `/reports` | Intelligence reports list with filters |
| `/reports/[id]` | Report detail — marks read on open |

## Coming soon placeholders

| Route | Feature |
|-------|---------|
| `/coming/travel` | Travel |
| `/coming/market` | Black Market (player auctions) |
| `/coming/businesses` | Businesses |
| `/coming/cartel` | Cartel |
| `/coming/messages` | Messages |

## API

| Route | Description |
|-------|-------------|
| `/api/auth/[...nextauth]` | Auth.js handlers (shared authorize logic) |

## Modern equivalents

| OldSkool | Modern |
|----------|--------|
| `/scout` | `/operations/scout` |
| `/command` | `/command` |
| `/empire` | `/empire` |
| `/rankings` | `/rankings` |
