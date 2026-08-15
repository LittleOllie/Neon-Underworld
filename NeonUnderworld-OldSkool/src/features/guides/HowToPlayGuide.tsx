import Link from 'next/link';
import { SectionLabel } from '@local/components/game';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';
import {
  REDLITE_TURNS,
  REDLITE_MARKET,
  REDLITE_PAYOUT,
  REDLITE_NET_WORTH,
  REDLITE_MARKET_STARTING_PRICES,
} from '@core/config/game/redlite-rules';
import {
  ATTACK_RULES,
  ATTACK_TYPE_LABELS,
  ATTACK_TYPE_PURPOSE,
} from '@core/config/game/attack-rules';
import { THUG_HIRE_PRICE } from '@core/config/game/hire-thugs-rules';
import { MAX_BUSINESSES_PER_PLAYER } from '@core/config/game/business-rules';
import { WORKER_POACHING_RULES } from '@core/config/game/worker-poaching-rules';
import { MARKET_RULES } from '@core/config/game/market-rules';
import {
  OFFLINE_ATTACK_LIMIT_STANDARD,
  OFFLINE_THRESHOLD_MS,
  OFFLINE_PROTECTION_RESET_ONLINE_MS,
} from '@core/config/game/offline-protection';
import { isPlaytestTurnsNavVisible } from '@core/config/game/playtest';

export interface HowToPlayGuideProps {
  districtName: string;
  districtSlug: string;
}

function GuideList({ children }: { children: React.ReactNode }) {
  return <ul className="g-guide-list">{children}</ul>;
}

function GuideSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="g-guide-section" aria-labelledby={`${id}-heading`}>
      <SectionLabel id={`${id}-heading`}>{title}</SectionLabel>
      {children}
    </section>
  );
}

function GuideScreen({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="g-guide-screen">
      <p className="g-note g-guide-body">
        <strong>
          <Link href={href}>{title}</Link>
        </strong>{' '}
        — {children}
      </p>
    </div>
  );
}

function formatMarketDurations(): string {
  const labels: Record<number, string> = {
    30: '30 min',
    60: '1 hour',
    180: '3 hours',
    360: '6 hours',
    720: '12 hours',
    1440: '24 hours',
  };
  return MARKET_RULES.allowedDurationMinutes.map((m) => labels[m] ?? `${m} min`).join(', ');
}

export function HowToPlayGuide({ districtName, districtSlug }: HowToPlayGuideProps) {
  const scoutAreas = getScoutAreaDisplays(districtSlug);
  const offlineMinutes = Math.round(OFFLINE_THRESHOLD_MS / 60_000);
  const resetOnlineMinutes = Math.round(OFFLINE_PROTECTION_RESET_ONLINE_MS / 60_000);

  const toc = [
    { id: 'quick-start', label: 'Quick start' },
    { id: 'core', label: 'Core ideas' },
    { id: 'screens', label: 'Every screen' },
    { id: 'crew', label: 'Crew & supplies' },
    { id: 'drugs', label: 'Drugs' },
    { id: 'shop', label: 'Shop' },
    { id: 'economy', label: 'Making money' },
    { id: 'combat', label: 'Attacks' },
    { id: 'market', label: 'Market' },
    { id: 'cartels', label: 'Cartels' },
    { id: 'travel', label: 'Travel' },
    { id: 'businesses', label: 'Businesses' },
    { id: 'wire', label: 'THE WIRE' },
    { id: 'rankings', label: 'Rankings' },
    { id: 'tips', label: 'Tips' },
    { id: 'reference', label: 'Your city' },
  ] as const;

  return (
    <>
      <p className="g-note g-guide-body">
        Neon Underworld is a turn-based street empire game. Spend turns to recruit crew, produce
        drugs and cash, buy gear, and fight rivals in your city. Tap a topic below, then scroll to
        read that section.
      </p>

      <nav className="g-guide-toc" aria-label="Guide sections">
        {toc.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="g-guide-toc-link">
            {item.label}
          </a>
        ))}
      </nav>

      <GuideSection id="quick-start" title="Quick start — your first hour">
        <p className="g-note g-guide-body">
          New here? Follow this order. Each step links to the screen you need.
        </p>
        <GuideList>
          <li>
            <strong>Check Home</strong> — Open <Link href="/command">Home</Link> for alerts, cash,
            turns, and unread reports.
          </li>
          <li>
            <strong>Scout for crew</strong> — Go to <Link href="/scout">Scout</Link>, pick an area,
            spend ~25 turns on <em>The Streets</em> to recruit Workers and Thugs.
          </li>
          <li>
            <strong>Stock supplies</strong> — Visit <Link href="/shop">Shop</Link> for weapons (1
            per Thug), beer, condoms, and hash.
          </li>
          <li>
            <strong>Produce</strong> — On <Link href="/produce">Produce</Link>, spend turns to earn
            cash and drugs.
          </li>
          <li>
            <strong>Set payout</strong> — On <Link href="/empire">Empire</Link>, adjust Worker
            payout % (lower = more profit, higher = happier crew).
          </li>
          <li>
            <strong>When ready to fight</strong> — Use <Link href="/attack">Attack</Link> in the
            More menu. Gather intel first, arm Thugs, bring rides.
          </li>
          <li>
            <strong>Read results</strong> — Check <Link href="/reports">Reports</Link> after
            attacks, market deals, and upgrades.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="core" title="Core ideas">
        <GuideList>
          <li>
            <strong>Turns</strong> — Most actions cost turns. You start with{' '}
            {REDLITE_TURNS.startingTurns.toLocaleString()} turns. You gain{' '}
            {REDLITE_TURNS.turnsPerInterval} every {REDLITE_TURNS.intervalMinutes} minutes, up to{' '}
            {REDLITE_TURNS.turnCap.toLocaleString()}.
            {isPlaytestTurnsNavVisible() ? (
              <>
                {' '}
                For testing only: <Link href="/playtest/turns">More → Add Turns</Link>.
              </>
            ) : null}
          </li>
          <li>
            <strong>Workers &amp; Thugs</strong> — Workers earn on Scout and Produce. Thugs fight,
            help Produce, and protect Workers. Recruit via Scout, or hire Thugs in Shop for $
            {THUG_HIRE_PRICE.toLocaleString()} each.
          </li>
          <li>
            <strong>Street vs Business crew</strong> — Crew assigned to a Business leaves street
            ops. Business Workers passively earn; Security Thugs protect the site.
          </li>
          <li>
            <strong>Net worth</strong> — Exposed empire value for rankings and attack eligibility.
            Includes cash, street crew, rides, street drugs, and business asset value. Safe cash and
            stored business drugs are hidden while stored in the business.
          </li>
          <li>
            <strong>Same city rule</strong> — Scout, Produce, and Attack only work in your current
            city ({districtName}). Travel to switch cities.
          </li>
          <li>
            <strong>While travelling</strong> — No Scout, Produce, or Attack until travel finishes (
            {REDLITE_TURNS.travelTurnCost} turns).
          </li>
        </GuideList>
        <p className="g-note g-guide-body">
          <strong>Net worth per unit (street assets)</strong>
        </p>
        <GuideList>
          <li>Cash — ${REDLITE_NET_WORTH.cash} each</li>
          <li>Worker — ${REDLITE_NET_WORTH.prostitutes.toLocaleString()}</li>
          <li>Thug — ${REDLITE_NET_WORTH.thugs.toLocaleString()}</li>
          <li>Ride — ${REDLITE_NET_WORTH.rides.toLocaleString()}</li>
          <li>
            Hash / Shrooms / Coke / Heroin — ${REDLITE_NET_WORTH.hash} unit value each on the street
          </li>
          <li>Weapons, beer, condoms — do not add to net worth</li>
        </GuideList>
      </GuideSection>

      <GuideSection id="screens" title="Every screen explained">
        <p className="g-note g-guide-body">
          Bottom nav: Home, Empire, Scout, Produce, and More. Everything else is under More.
        </p>
        <GuideScreen href="/command" title="Home">
          Dashboard — cash, turns, alerts (attacks, raids, full Safes, cartel invites, supply
          warnings), and quick links.
        </GuideScreen>
        <GuideScreen href="/empire" title="Empire">
          Full inventory, crew split (street vs business), happiness meters, Worker payout control,
          and net worth breakdown.
        </GuideScreen>
        <GuideScreen href="/scout" title="Scout">
          Spend turns in city areas to recruit Workers and Thugs plus some cash.
        </GuideScreen>
        <GuideScreen href="/produce" title="Produce">
          Spend turns to earn cash and drugs with your street crew.
        </GuideScreen>
        <GuideScreen href="/shop" title="Shop">
          Buy gear, sell drugs, hire Thugs. Workers come from Scout or Market, not Shop buy.
        </GuideScreen>
        <GuideScreen href="/attack" title="Attack">
          Intel, target pick, attack type, Thugs, rides, launch. Same city only.
        </GuideScreen>
        <GuideScreen href="/market" title="Market">
          Global auctions — browse, bid, list, My Auctions.
        </GuideScreen>
        <GuideScreen href="/travel" title="Travel">
          Move to another city ({REDLITE_TURNS.travelTurnCost} turns).
        </GuideScreen>
        <GuideScreen href="/businesses" title="Businesses">
          Buy and run up to {MAX_BUSINESSES_PER_PLAYER} businesses — income, storage, Safe.
        </GuideScreen>
        <GuideScreen href="/cartels" title="Cartels">
          Team treasury, armoury, join requests, defence bonuses.
        </GuideScreen>
        <GuideScreen href="/rankings" title="Rankings">
          City and global net worth leaderboards.
        </GuideScreen>
        <GuideScreen href="/reports" title="Reports">
          Inbox for combat, intel, market, raids, cartel, and business events.
        </GuideScreen>
        <GuideScreen href="/settings" title="Settings">
          Account and preferences.
        </GuideScreen>
        <p className="g-note g-guide-body">
          Tap a rival&apos;s alias on Rankings or Attack to open their{' '}
          <strong>player profile</strong> — public stats and online status.
        </p>
      </GuideSection>

      <GuideSection id="crew" title="Crew &amp; supplies">
        <p className="g-note g-guide-body">
          <strong>Workers</strong> — Need condoms, hash (supplies), enough Thugs for protection, and
          a fair payout %. Low happiness = walkouts, weak Produce/Scout, easier poaching. Set payout
          on Empire: {REDLITE_PAYOUT.minPercent}% max profit ↔ {REDLITE_PAYOUT.maxPercent}%
          protection.
        </p>
        <p className="g-note g-guide-body">
          <strong>Thugs</strong> — Need 1 weapon each (Glock, Uzi, or AK) and beer. Unarmed or dry
          Thugs leave. AKs hit hardest in combat.
        </p>
        <p className="g-note g-guide-body">
          <strong>Rides</strong> — Required for attacks: 1 ride per {ATTACK_RULES.thugsPerRide}{' '}
          attacking Thugs. Also used by cartel Response Force.
        </p>
        <p className="g-note g-guide-body">
          <strong>Protection ratio</strong> — More Thugs per Worker means safer scouting and
          producing. Too few Thugs and you lose crew to rivals or walkouts.
        </p>
      </GuideSection>

      <GuideSection id="drugs" title="Drugs — what each one is for">
        <GuideList>
          <li>
            <strong>Hash</strong> — Worker supply drug and Produce output. Keeps Workers happy.
            Large street stacks add net worth — do not hoard more than you need on the street.
          </li>
          <li>
            <strong>Shrooms</strong> — Produce output; sell in Shop or list on Market for profit.
          </li>
          <li>
            <strong>Coke</strong> — Higher-value Produce output; good for sales and business
            storage.
          </li>
          <li>
            <strong>Heroin</strong> — Highest-value drug from Produce; valuable but increases
            exposure on the street.
          </li>
        </GuideList>
        <p className="g-note g-guide-body">
          On Produce, hash used as Worker upkeep is not consumed during that run. Move bulk drugs
          into business storage or sell them — street drugs count toward net worth and raids.
        </p>
      </GuideSection>

      <GuideSection id="shop" title="Shop — buy, sell, hire">
        <GuideList>
          <li>
            <strong>Buy</strong> — Glocks, Uzis, AKs, rides, beer, condoms, hash. Stock up before
            big Scout/Produce sessions.
          </li>
          <li>
            <strong>Sell</strong> — Sell excess drugs to the Shop for instant cash (prices vary by
            drug type).
          </li>
          <li>
            <strong>Hire Thugs</strong> — ${THUG_HIRE_PRICE.toLocaleString()} each when you need
            muscle without scouting.
          </li>
          <li>
            <strong>Workers</strong> — Not sold in Shop. Scout or buy on Market.
          </li>
        </GuideList>
        <p className="g-note g-guide-body">
          <strong>Weapon power (combat)</strong> — AK strongest, then Uzi, then Glock. Arm every
          Thug before attacking.
        </p>
      </GuideSection>

      <GuideSection id="economy" title="Making money">
        <GuideList>
          <li>
            <strong>Scout</strong> — Fast crew + cash. Best first move every session.
          </li>
          <li>
            <strong>Produce</strong> — Main loop: cash + drugs scale with Workers, Thugs, and turns
            spent.
          </li>
          <li>
            <strong>Shop sell</strong> — Quick cash for spare drugs.
          </li>
          <li>
            <strong>Market</strong> — Player trades — often better prices than Shop for bulk.
          </li>
          <li>
            <strong>Businesses</strong> — Passive income from assigned Workers; Safes hide cash from
            net worth.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="combat" title="Attacks &amp; defence">
        <p className="g-note g-guide-body">
          <strong>Who you can hit</strong> — Same city. Target net worth ≥{' '}
          {Math.round(ATTACK_RULES.netWorthMinMultiplier * 100)}% of yours. No upper cap. Max{' '}
          {ATTACK_RULES.targetAttackCapPer24h} attacks per pair per 24 hours.
        </p>
        <p className="g-note g-guide-body">
          <strong>Intel</strong> — {ATTACK_RULES.intelGatherTurnCost} turns Basic Intel (
          {ATTACK_RULES.scoutReportExpiryHours}h report). Then {ATTACK_RULES.deepIntelTurnCost}{' '}
          turns Deep Intel (cash/drug bands, cartel hints, poaching outlook).
        </p>
        <p className="g-note g-guide-body">
          <strong>Before you launch</strong> — Arm Thugs, assign rides (1 per{' '}
          {ATTACK_RULES.thugsPerRide} Thugs), pick attack type.
        </p>
        <GuideList>
          {(
            Object.keys(ATTACK_RULES.turnCosts) as Array<keyof typeof ATTACK_RULES.turnCosts>
          ).map((type) => (
            <li key={type}>
              <strong>{ATTACK_TYPE_LABELS[type]}</strong> ({ATTACK_RULES.turnCosts[type]} turns) —{' '}
              {ATTACK_TYPE_PURPOSE[type]}
            </li>
          ))}
        </GuideList>
        <p className="g-note g-guide-body">
          <strong>Poach Workers</strong> — Target needs ≥ {WORKER_POACHING_RULES.minWorkersToPoach}{' '}
          street Workers. Steals crew, not cash/drugs.
        </p>
        <p className="g-note g-guide-body">
          <strong>Offline protection</strong> — After {offlineMinutes} min offline, up to{' '}
          {OFFLINE_ATTACK_LIMIT_STANDARD} damaging hits land; then protection while still offline.
          Stay online {resetOnlineMinutes} min straight to reset.
        </p>
        <p className="g-note g-guide-body">
          <strong>Cartel defence</strong> — Same-city cartel mates may add virtual defence Thugs +
          Response Force when you are attacked at home (not while travelling).
        </p>
      </GuideSection>

      <GuideSection id="market" title="Market — auctions">
        <GuideList>
          <li>
            <strong>Global</strong> — All cities share one Market. Browse, filter by category, bid
            on live listings.
          </li>
          <li>
            <strong>List items</strong> — Weapons, rides, drugs, supplies, Workers, Thugs. Set start
            price, quantity, duration ({formatMarketDurations()}).
          </li>
          <li>
            <strong>Bidding</strong> — Each bid raises price by {REDLITE_MARKET.bidIncrementPercent}
            %. Highest bid when time expires wins.
          </li>
          <li>
            <strong>My Auctions</strong> — Selling tab shows your active listings; history shows
            ended ones. Buying tab tracks bids you placed.
          </li>
          <li>
            <strong>Settlement</strong> — Won items and sale cash arrive via Reports when the
            auction ends.
          </li>
          <li>
            <strong>Reference floors</strong> — Worker from $
            {REDLITE_MARKET_STARTING_PRICES.whore.toLocaleString()}, Thug from $
            {REDLITE_MARKET_STARTING_PRICES.thug.toLocaleString()}, Ride from $
            {REDLITE_MARKET_STARTING_PRICES.ride.toLocaleString()} (players often bid above these).
          </li>
        </GuideList>
        <p className="g-note g-guide-body g-note-warn">
          Big cash on hand after winning an auction makes you a Home Invasion target — spend, Safe
          it, or buy gear quickly.
        </p>
      </GuideSection>

      <GuideSection id="cartels" title="Cartels — teams">
        <GuideList>
          <li>
            <strong>Join or create</strong> — Accept invites or request to join from the Cartels
            page. Leaders approve join requests.
          </li>
          <li>
            <strong>Treasury</strong> — Members deposit cash into a shared pool for cartel purchases.
          </li>
          <li>
            <strong>Armoury</strong> — Cartel buys shared Thugs, Glocks, Uzis, and rides. Stock
            protects all members in same-city defence. Armoury gear is not lost like personal weapons
            in some attack outcomes.
          </li>
          <li>
            <strong>Response Force</strong> — When a home member is attacked, the cartel may deploy
            extra virtual Thugs (limited by pool, rides, and city presence).
          </li>
          <li>
            <strong>Leadership</strong> — HQ roles manage invites, treasury, and armoury purchases.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="travel" title="Travel — change city">
        <GuideList>
          <li>
            Costs <strong>{REDLITE_TURNS.travelTurnCost} turns</strong> to move to another city.
          </li>
          <li>While travelling: no Scout, Produce, or Attack.</li>
          <li>Unlocks that city&apos;s scout areas and attack targets when you arrive.</li>
          <li>Cartel defence only applies at home — travelling members fight alone.</li>
        </GuideList>
      </GuideSection>

      <GuideSection id="businesses" title="Businesses">
        <GuideList>
          <li>
            <strong>Own up to {MAX_BUSINESSES_PER_PLAYER}</strong> — Nightclub (best passive income),
            Warehouse (big storage, lower heat), Drug Lab (production storage).
          </li>
          <li>
            <strong>Assign crew</strong> — Workers earn passively; Security Thugs reduce raid losses.
            Assigned crew leave street Scout/Produce.
          </li>
          <li>
            <strong>Safe</strong> — Store cash inside; hidden from street net worth until collected.
          </li>
          <li>
            <strong>Drug storage</strong> — Park bulk drugs off the street.
          </li>
          <li>
            <strong>Heat</strong> — Rises with activity and stored value. High heat = police raid
            risk (Report sent if hit).
          </li>
          <li>
            <strong>Upgrades</strong> — Levels 1–5: more capacity, bigger Safe, more storage. Cost
            cash + real time. Report when done.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="wire" title="THE WIRE — voice &amp; typed commands">
        <p className="g-note g-guide-body">
          Optional on Home — tap the mic or type natural commands instead of clicking menus.
        </p>
        <GuideList>
          <li>
            <strong>Navigation</strong> — &quot;go scout&quot;, &quot;open market&quot;, &quot;go
            empire&quot;, &quot;travel&quot;
          </li>
          <li>
            <strong>Actions</strong> — &quot;scout 25&quot;, &quot;produce 50&quot; (when supported
            by your current screen context)
          </li>
          <li>
            <strong>Help</strong> — &quot;how to play&quot; opens this guide
          </li>
        </GuideList>
        <p className="g-note g-guide-body">
          THE WIRE is optional — every action is still available through normal menus.
        </p>
      </GuideSection>

      <GuideSection id="rankings" title="Rankings &amp; reports">
        <p className="g-note g-guide-body">
          <strong>Rankings</strong> — See city and global leaders by net worth. Growing fast climbs
          the board but attracts attackers.
        </p>
        <p className="g-note g-guide-body">
          <strong>Reports</strong> — Permanent inbox: attacks, intel, market results, cartel events,
          police raids, upgrade completions. Unread count on Home and More menu. Open each report for
          full detail — outcomes are not always shown on the action screen.
        </p>
      </GuideSection>

      <GuideSection id="tips" title="Tips &amp; common mistakes">
        <GuideList>
          <li>Scout before Produce — no crew means no income.</li>
          <li>Buy weapons + beer before your first big Produce run.</li>
          <li>Check Empire happiness meters every session.</li>
          <li>Do not leave huge cash on the street after Market sales.</li>
          <li>Gather intel before attacking stronger rivals.</li>
          <li>Assign Security before storing big Safe or drug balances.</li>
          <li>Join a cartel before your net worth spikes.</li>
          <li>Read Reports — that is where wins, losses, and loot are recorded.</li>
          <li>Scroll this whole page — every topic in the menu above has a section below.</li>
        </GuideList>
      </GuideSection>

      <GuideSection id="reference" title={`Scout areas in ${districtName}`}>
        <p className="g-note g-guide-body">
          Five areas per city. Pick based on whether you need Workers or Thugs.
        </p>
        {scoutAreas.map((area) => (
          <p key={area.slug} className="g-note g-guide-body">
            <strong>{area.name}</strong> — Workers: {area.workers}, Thugs: {area.thugs}, Risk:{' '}
            {area.risk}
          </p>
        ))}
      </GuideSection>

      <p className="g-note g-guide-body g-guide-footer">
        <Link href="/command">Home</Link>
        {' · '}
        <Link href="/empire">Empire</Link>
        {' · '}
        <Link href="/scout">Scout</Link>
        {' · '}
        <Link href="/produce">Produce</Link>
        {' · '}
        <Link href="/shop">Shop</Link>
        {' · '}
        <Link href="/attack">Attack</Link>
        {' · '}
        <Link href="/market">Market</Link>
        {' · '}
        <Link href="/businesses">Businesses</Link>
        {' · '}
        <Link href="/cartels">Cartels</Link>
        {' · '}
        <Link href="/reports">Reports</Link>
      </p>
    </>
  );
}
