import Link from 'next/link';
import { GameShell, PageTitle, SectionLabel, Divider } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { REDLITE_TURNS, REDLITE_ATTACK } from '@core/config/game/redlite-rules';

export default async function HowToPlayPage() {
  const { ctx } = await requireGameSession();

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="guides">
      <PageTitle icon="guides">How to Play</PageTitle>

      <p className="g-note g-guide-body">
        Welcome to Neon Underworld. Build your district empire, climb the rankings, and take on
        rivals — all on turns. This alpha is set up so you can explore without waiting around.
      </p>

      <Divider />

      <SectionLabel>The Goal</SectionLabel>
      <p className="g-note g-guide-body">
        Grow your <strong>net worth</strong> (cash + workers + thugs + rides + drugs). Higher net
        worth = higher rank. Scout recruits, produce earns cash and drugs, the shop equips your
        crew, and attacks let you hit rivals in your district.
      </p>

      <Divider />

      <SectionLabel>Your First Session — Step by Step</SectionLabel>
      <ol className="g-howto-steps">
        <li>
          Check <Link href="/empire">Empire</Link> to see what you own — workers, thugs, cash, and
          gear.
        </li>
        <li>
          Go to <Link href="/scout">Scout</Link>. Pick an area and spend turns to recruit workers and
          thugs (and earn a little cash).
        </li>
        <li>
          Open <Link href="/produce">Produce</Link>. With thugs on payroll, spend turns to make drugs
          and earn cash from your workers.
        </li>
        <li>
          Visit the <Link href="/shop">Shop</Link> for weapons, rides, beer, and supplies. You
          cannot buy workers here — recruit them via Scout.
        </li>
        <li>
          Open <Link href="/rankings">Rankings</Link>, tap a player in <strong>your district</strong>,
          then <strong>Scout Player</strong> on their profile. That creates attack intel in{' '}
          <Link href="/reports">Reports</Link>.
        </li>
        <li>
          From the report or intel alert, open <Link href="/attack">Attack</Link> and launch a hit
          on an eligible target.
        </li>
        <li>Watch your rank climb on Rankings as your net worth grows.</li>
      </ol>

      <Divider />

      <SectionLabel>Turns</SectionLabel>
      <p className="g-note g-guide-body">
        Almost everything costs turns. New players start with {REDLITE_TURNS.startingTurns.toLocaleString()}{' '}
        turns (the cap). In normal play, turns regenerate{' '}
        {REDLITE_TURNS.turnsPerInterval} every {REDLITE_TURNS.intervalMinutes} minutes.
      </p>
      <p className="g-note g-guide-body">
        <strong>Alpha tip:</strong> need more turns to test? Open{' '}
        <Link href="/playtest/turns">More → Add Turns</Link> and top up anytime.
      </p>

      <Divider />

      <SectionLabel>Scouting Rivals (for Attacks)</SectionLabel>
      <p className="g-note g-guide-body">
        District scouting (on the Scout page) recruits your crew. To attack someone, you need{' '}
        <strong>player intel</strong> first:
      </p>
      <ol className="g-howto-steps">
        <li>
          Go to <Link href="/rankings">Rankings</Link> and open a player in your district.
        </li>
        <li>
          On their profile, tap <strong>Scout Player</strong> (costs turns).
        </li>
        <li>
          Intel appears in <Link href="/reports">Reports</Link>. From there you can attack while it is
          valid.
        </li>
      </ol>
      <p className="g-note g-guide-body">
        Attacks only work against players in <strong>your same district</strong> whose net worth is
        between {REDLITE_ATTACK.minNetWorthMultiplier * 100}% and{' '}
        {REDLITE_ATTACK.maxNetWorthMultiplier * 100}% of yours. Check Reports if a target goes out
        of range.
      </p>

      <Divider />

      <SectionLabel>Combat Basics</SectionLabel>
      <ul className="g-howto-list">
        <li>Arm thugs with weapons from the Shop (glocks, uzis, AKs).</li>
        <li>Rides help move crews — you need enough rides for large attacks.</li>
        <li>Beer and worker payout % affect morale and long-term stability.</li>
        <li>Win or lose, results land in Reports.</li>
      </ul>

      <Divider />

      <SectionLabel>Quick Tips</SectionLabel>
      <ul className="g-howto-list">
        <li>
          <Link href="/command">Home</Link> shows alerts — unread reports, low supplies, and attack
          opportunities.
        </li>
        <li>Workers earn cash while you spend turns on Scout and Produce.</li>
        <li>Hash is cheap in the shop; serious profit usually comes from producing drugs.</li>
        <li>The rankings list is full of NPC rivals you can scout and attack during this alpha.</li>
      </ul>

      <Divider />

      <SectionLabel>More Detail</SectionLabel>
      <p className="g-note g-guide-body">
        Scout areas, shop items, and payout rules:{' '}
        <Link href="/guides">Guides</Link>.
      </p>
    </GameShell>
  );
}
