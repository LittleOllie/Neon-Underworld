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
import {
  formatAttackTypeOptionLabel,
} from '@core/lib/game-engine/combat/attack-presentation';
import { THUG_HIRE_PRICE } from '@core/config/game/hire-thugs-rules';
import {
  MAX_BUSINESSES_PER_PLAYER,
  BUSINESS_TYPE_RULES,
} from '@core/config/game/business-rules';
import { WORKER_POACHING_RULES } from '@core/config/game/worker-poaching-rules';
import { MARKET_RULES } from '@core/config/game/market-rules';
import {
  OFFLINE_ATTACK_LIMIT_STANDARD,
  OFFLINE_THRESHOLD_MS,
  OFFLINE_PROTECTION_RESET_ONLINE_MS,
} from '@core/config/game/offline-protection';
import { isPlaytestTurnsNavVisible } from '@core/config/game/playtest';
import { TERMS } from '@core/config/game/terminology';
import { OS_TERMS, resourceLabel } from '@local/config/terminology';

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
    { id: 'drugs', label: TERMS.technology },
    { id: 'shop', label: OS_TERMS.shop },
    { id: 'economy', label: 'Making money' },
    { id: 'combat', label: 'Attacks' },
    { id: 'market', label: OS_TERMS.market },
    { id: 'cartels', label: OS_TERMS.factions },
    { id: 'travel', label: OS_TERMS.travel },
    { id: 'businesses', label: OS_TERMS.businesses },
    { id: 'wire', label: OS_TERMS.wire.toUpperCase() },
    { id: 'rankings', label: OS_TERMS.rankings },
    { id: 'tips', label: 'Tips' },
    { id: 'reference', label: 'Your city' },
  ] as const;

  return (
    <>
      <p className="g-note g-guide-body">
        Neon Underworld is a turn-based underground empire game. You are an {OS_TERMS.operator} —
        spend turns to recruit crew, run {TERMS.operations}, stock gear, and strike rivals in your
        city. Tap a topic below, then scroll to read that section.
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
          New {OS_TERMS.operator.toLowerCase()}? Follow this order. Each step links to the screen
          you need.
        </p>
        <GuideList>
          <li>
            <strong>Check Home</strong> — Open <Link href="/command">Home</Link> for alerts, cash,
            turns, and unread reports.
          </li>
          <li>
            <strong>Scout for crew</strong> — Go to <Link href="/scout">{OS_TERMS.scout}</Link>,
            pick an area, spend ~25 turns on <em>The Streets</em> to recruit{' '}
            {OS_TERMS.specialists} and {OS_TERMS.enforcers}.
          </li>
          <li>
            <strong>Stock supplies</strong> — Visit <Link href="/shop">{OS_TERMS.shop}</Link> for
            weapons (1 per {OS_TERMS.enforcer.toLowerCase()}), {OS_TERMS.rations.toLowerCase()},{' '}
            {OS_TERMS.kits.toLowerCase()}, and {resourceLabel('hash').toLowerCase()}.
          </li>
          <li>
            <strong>Run {TERMS.operations}</strong> — On{' '}
            <Link href="/produce">{TERMS.operations}</Link>, spend turns to earn cash and{' '}
            {OS_TERMS.technology.toLowerCase()}.
          </li>
          <li>
            <strong>Set payout</strong> — On <Link href="/empire">{OS_TERMS.empire}</Link>, adjust{' '}
            {OS_TERMS.specialist.toLowerCase()} payout % (lower = more profit, higher = steadier
            crew).
          </li>
          <li>
            <strong>When ready to fight</strong> — Use <Link href="/attack">{OS_TERMS.attack}</Link>{' '}
            in the More menu. Gather intel first, arm {OS_TERMS.enforcers.toLowerCase()}, bring{' '}
            {OS_TERMS.rides.toLowerCase()}.
          </li>
          <li>
            <strong>Read results</strong> — Check <Link href="/reports">{OS_TERMS.reports}</Link>{' '}
            after attacks, market deals, and upgrades.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="core" title="Core ideas">
        <GuideList>
          <li>
            <strong>{OS_TERMS.turns}</strong> — Most actions cost turns. You start with{' '}
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
            <strong>
              {OS_TERMS.specialists} &amp; {OS_TERMS.enforcers}
            </strong>{' '}
            — {OS_TERMS.specialists} earn on Scout and {TERMS.operations}. {OS_TERMS.enforcers}{' '}
            fight, support {TERMS.operations.toLowerCase()}, and protect{' '}
            {OS_TERMS.specialists.toLowerCase()}. Recruit via Scout, or hire{' '}
            {OS_TERMS.enforcers.toLowerCase()} in {OS_TERMS.shop} for $
            {THUG_HIRE_PRICE.toLocaleString()} each.
          </li>
          <li>
            <strong>Street vs business crew</strong> — Crew assigned to a {OS_TERMS.businesses.slice(0, -1).toLowerCase()}{' '}
            leaves street ops. Business {OS_TERMS.specialists.toLowerCase()} passively earn; security{' '}
            {OS_TERMS.enforcers.toLowerCase()} protect the site.
          </li>
          <li>
            <strong>{OS_TERMS.influence}</strong> — Exposed empire value for rankings and attack
            eligibility. Includes cash, street crew, {OS_TERMS.rides.toLowerCase()}, street{' '}
            {OS_TERMS.technology.toLowerCase()}, and business asset value. Safe cash and stored
            business {OS_TERMS.technology.toLowerCase()} are hidden while stored in the business.
          </li>
          <li>
            <strong>Same city rule</strong> — Scout, {TERMS.operations}, and {OS_TERMS.attack} only
            work in your current city ({districtName}). {OS_TERMS.travel} to switch cities.
          </li>
          <li>
            <strong>While travelling</strong> — No Scout, {TERMS.operations}, or {OS_TERMS.attack}{' '}
            until travel finishes ({REDLITE_TURNS.travelTurnCost} turns).
          </li>
        </GuideList>
        <p className="g-note g-guide-body">
          <strong>{OS_TERMS.influence} per unit (street assets)</strong>
        </p>
        <GuideList>
          <li>Cash — ${REDLITE_NET_WORTH.cash} each</li>
          <li>
            {OS_TERMS.specialist} — ${REDLITE_NET_WORTH.prostitutes.toLocaleString()}
          </li>
          <li>
            {OS_TERMS.enforcer} — ${REDLITE_NET_WORTH.thugs.toLocaleString()}
          </li>
          <li>
            {OS_TERMS.ride} — ${REDLITE_NET_WORTH.rides.toLocaleString()}
          </li>
          <li>
            {resourceLabel('hash')} / {resourceLabel('shrooms')} / {resourceLabel('coke')} /{' '}
            {resourceLabel('heroin')} — ${REDLITE_NET_WORTH.hash} unit value each on the street
          </li>
          <li>
            {OS_TERMS.weapons}, {OS_TERMS.rations.toLowerCase()}, {OS_TERMS.kits.toLowerCase()} — do
            not add to {OS_TERMS.influence.toLowerCase()}
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="screens" title="Every screen explained">
        <p className="g-note g-guide-body">
          Bottom nav: Home, {OS_TERMS.empire}, {OS_TERMS.scout}, {TERMS.operations}, and More.
          Everything else is under More.
        </p>
        <GuideScreen href="/command" title="Home">
          Command dashboard — cash, turns, alerts (attacks, raids, full Safes, faction invites,
          supply warnings), and quick links.
        </GuideScreen>
        <GuideScreen href="/empire" title={OS_TERMS.empire}>
          Full inventory, crew split (street vs business), morale meters, {OS_TERMS.specialist.toLowerCase()}{' '}
          payout control, and {OS_TERMS.influence.toLowerCase()} breakdown.
        </GuideScreen>
        <GuideScreen href="/scout" title={OS_TERMS.scout}>
          Spend turns in city areas to recruit {OS_TERMS.specialists.toLowerCase()} and{' '}
          {OS_TERMS.enforcers.toLowerCase()} plus some cash.
        </GuideScreen>
        <GuideScreen href="/produce" title={TERMS.operations}>
          Spend turns to earn cash and {OS_TERMS.technology.toLowerCase()} with your street crew.
        </GuideScreen>
        <GuideScreen href="/shop" title={OS_TERMS.shop}>
          Buy gear, sell {OS_TERMS.technology.toLowerCase()}, hire {OS_TERMS.enforcers.toLowerCase()}.{' '}
          {OS_TERMS.specialists} come from Scout or {OS_TERMS.market}, not {OS_TERMS.shop} buy.
        </GuideScreen>
        <GuideScreen href="/attack" title={OS_TERMS.attack}>
          Intel, target pick, attack type, {OS_TERMS.enforcers.toLowerCase()},{' '}
          {OS_TERMS.rides.toLowerCase()}, launch. Same city only.
        </GuideScreen>
        <GuideScreen href="/market" title={OS_TERMS.market}>
          Global auctions — browse, bid, list, My Auctions.
        </GuideScreen>
        <GuideScreen href="/travel" title={OS_TERMS.travel}>
          Move to another city ({REDLITE_TURNS.travelTurnCost} turns).
        </GuideScreen>
        <GuideScreen href="/businesses" title={OS_TERMS.businesses}>
          Buy and run up to {MAX_BUSINESSES_PER_PLAYER} businesses — income, storage, Safe.
        </GuideScreen>
        <GuideScreen href="/cartels" title={OS_TERMS.factions}>
          Team treasury, armoury, join requests, defence bonuses.
        </GuideScreen>
        <GuideScreen href="/rankings" title={OS_TERMS.rankings}>
          City and global {OS_TERMS.influence.toLowerCase()} leaderboards.
        </GuideScreen>
        <GuideScreen href="/reports" title={OS_TERMS.reports}>
          Inbox for combat, intel, market, raids, faction, and business events.
        </GuideScreen>
        <GuideScreen href="/settings" title="Settings">
          Account and preferences.
        </GuideScreen>
        <p className="g-note g-guide-body">
          Tap a rival&apos;s {OS_TERMS.alias.toLowerCase()} on {OS_TERMS.rankings} or {OS_TERMS.attack}{' '}
          to open their <strong>player profile</strong> — public stats and online status.
        </p>
      </GuideSection>

      <GuideSection id="crew" title="Crew &amp; supplies">
        <p className="g-note g-guide-body">
          <strong>{OS_TERMS.specialists}</strong> — Need {OS_TERMS.kits.toLowerCase()},{' '}
          {resourceLabel('hash').toLowerCase()} (supplies), enough {OS_TERMS.enforcers.toLowerCase()}{' '}
          for protection, and a fair payout %. Low morale = walkouts, weak {TERMS.operations.toLowerCase()}
          /Scout, easier poaching. Set payout on {OS_TERMS.empire}: {REDLITE_PAYOUT.minPercent}%
          max profit ↔ {REDLITE_PAYOUT.maxPercent}% protection.
        </p>
        <p className="g-note g-guide-body">
          <strong>{OS_TERMS.enforcers}</strong> — Need 1 weapon each ({OS_TERMS.glock},{' '}
          {OS_TERMS.uzi}, or {OS_TERMS.ak}) and {OS_TERMS.rations.toLowerCase()}. Unarmed or dry{' '}
          {OS_TERMS.enforcers.toLowerCase()} leave. {OS_TERMS.aks} hit hardest in combat.
        </p>
        <p className="g-note g-guide-body">
          <strong>{OS_TERMS.rides}</strong> — Required for attacks: 1 ride per{' '}
          {ATTACK_RULES.thugsPerRide} attacking {OS_TERMS.enforcers.toLowerCase()}. Also used by
          faction Response Force.
        </p>
        <p className="g-note g-guide-body">
          <strong>Protection ratio</strong> — More {OS_TERMS.enforcers.toLowerCase()} per{' '}
          {OS_TERMS.specialist.toLowerCase()} means safer scouting and operations. Too few{' '}
          {OS_TERMS.enforcers.toLowerCase()} and you lose crew to rivals or walkouts.
        </p>
      </GuideSection>

      <GuideSection id="drugs" title={`${TERMS.technology} — what each resource is for`}>
        <GuideList>
          <li>
            <strong>{resourceLabel('hash')}</strong> — {OS_TERMS.specialist.toLowerCase()} supply
            and {TERMS.operations.toLowerCase()} output. Keeps {OS_TERMS.specialists.toLowerCase()}{' '}
            steady. Large street stacks add {OS_TERMS.influence.toLowerCase()} — do not hoard more
            than you need on the street.
          </li>
          <li>
            <strong>{resourceLabel('shrooms')}</strong> — {TERMS.operations} output; sell in{' '}
            {OS_TERMS.shop} or list on {OS_TERMS.market} for profit.
          </li>
          <li>
            <strong>{resourceLabel('coke')}</strong> — Higher-value {TERMS.operations.toLowerCase()}{' '}
            output; good for sales and business storage.
          </li>
          <li>
            <strong>{resourceLabel('heroin')}</strong> — Highest-value output from{' '}
            {TERMS.operations}; valuable but increases exposure on the street.
          </li>
        </GuideList>
        <p className="g-note g-guide-body">
          On {TERMS.operations}, {resourceLabel('hash').toLowerCase()} used as{' '}
          {OS_TERMS.specialist.toLowerCase()} upkeep is not consumed during that run. Move bulk{' '}
          {OS_TERMS.technology.toLowerCase()} into business storage or sell it — street{' '}
          {OS_TERMS.technology.toLowerCase()} counts toward {OS_TERMS.influence.toLowerCase()} and
          raids.
        </p>
      </GuideSection>

      <GuideSection id="shop" title={`${OS_TERMS.shop} — buy, sell, hire`}>
        <GuideList>
          <li>
            <strong>Buy</strong> — {OS_TERMS.glocks}, {OS_TERMS.uzis}, {OS_TERMS.aks},{' '}
            {OS_TERMS.rides.toLowerCase()}, {OS_TERMS.rations.toLowerCase()},{' '}
            {OS_TERMS.kits.toLowerCase()}, {resourceLabel('hash').toLowerCase()}. Stock up before
            big Scout/{TERMS.operations} sessions.
          </li>
          <li>
            <strong>Sell</strong> — Sell excess {OS_TERMS.technology.toLowerCase()} to the{' '}
            {OS_TERMS.shop} for instant cash (prices vary by resource type).
          </li>
          <li>
            <strong>Hire {OS_TERMS.enforcers}</strong> — ${THUG_HIRE_PRICE.toLocaleString()} each
            when you need muscle without scouting.
          </li>
          <li>
            <strong>{OS_TERMS.specialists}</strong> — Not sold in {OS_TERMS.shop}. Scout or buy on{' '}
            {OS_TERMS.market}.
          </li>
        </GuideList>
        <p className="g-note g-guide-body">
          <strong>Weapon power (combat)</strong> — {OS_TERMS.ak} strongest, then {OS_TERMS.uzi}, then{' '}
          {OS_TERMS.glock}. Arm every {OS_TERMS.enforcer.toLowerCase()} before attacking.
        </p>
      </GuideSection>

      <GuideSection id="economy" title="Making money">
        <GuideList>
          <li>
            <strong>{OS_TERMS.scout}</strong> — Fast crew + cash. Best first move every session.
          </li>
          <li>
            <strong>{TERMS.operations}</strong> — Main loop: cash + {OS_TERMS.technology.toLowerCase()}{' '}
            scale with {OS_TERMS.specialists.toLowerCase()}, {OS_TERMS.enforcers.toLowerCase()}, and
            turns spent.
          </li>
          <li>
            <strong>{OS_TERMS.shop} sell</strong> — Quick cash for spare{' '}
            {OS_TERMS.technology.toLowerCase()}.
          </li>
          <li>
            <strong>{OS_TERMS.market}</strong> — Player trades — often better prices than{' '}
            {OS_TERMS.shop} for bulk.
          </li>
          <li>
            <strong>{OS_TERMS.businesses}</strong> — Passive income from assigned{' '}
            {OS_TERMS.specialists.toLowerCase()}; Safes hide cash from{' '}
            {OS_TERMS.influence.toLowerCase()}.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="combat" title="Attacks &amp; defence">
        <p className="g-note g-guide-body">
          <strong>Who you can hit</strong> — Same city. Target {OS_TERMS.influence.toLowerCase()}{' '}
          {Math.round(ATTACK_RULES.netWorthMinMultiplier * 100)}%–
          {Math.round(ATTACK_RULES.netWorthMaxMultiplier * 100)}% of yours. Max{' '}
          {ATTACK_RULES.targetAttackCapPer24h} attacks per pair per 24 hours.
        </p>
        <p className="g-note g-guide-body">
          <strong>{OS_TERMS.intel}</strong> — {ATTACK_RULES.intelGatherTurnCost} turns Basic{' '}
          {OS_TERMS.intel} ({ATTACK_RULES.scoutReportExpiryHours}h report). Then{' '}
          {ATTACK_RULES.deepIntelTurnCost} turns {OS_TERMS.deepIntel} (cash/technology bands, faction
          hints, poaching outlook).
        </p>
        <p className="g-note g-guide-body">
          <strong>Before you launch</strong> — Arm {OS_TERMS.enforcers.toLowerCase()}, assign{' '}
          {OS_TERMS.rides.toLowerCase()} (1 per {ATTACK_RULES.thugsPerRide}{' '}
          {OS_TERMS.enforcers.toLowerCase()}), pick attack type.
        </p>
        <GuideList>
          {(
            Object.keys(ATTACK_RULES.turnCosts) as Array<keyof typeof ATTACK_RULES.turnCosts>
          ).map((type) => (
            <li key={type}>
              <strong>{formatAttackTypeOptionLabel(type)}</strong> — {ATTACK_TYPE_PURPOSE[type]}
            </li>
          ))}
        </GuideList>
        <p className="g-note g-guide-body">
          <strong>{ATTACK_TYPE_LABELS.POACH_WORKERS}</strong> — Target needs ≥{' '}
          {WORKER_POACHING_RULES.minWorkersToPoach} street {OS_TERMS.specialists.toLowerCase()}.
          Steals crew, not cash or {OS_TERMS.technology.toLowerCase()}.
        </p>
        <p className="g-note g-guide-body">
          <strong>Offline protection</strong> — After {offlineMinutes} min offline, up to{' '}
          {OFFLINE_ATTACK_LIMIT_STANDARD} damaging hits land; then protection while still offline.
          Stay online {resetOnlineMinutes} min straight to reset.
        </p>
        <p className="g-note g-guide-body">
          <strong>Faction defence</strong> — Same-city faction mates may add virtual defence{' '}
          {OS_TERMS.enforcers.toLowerCase()} + Response Force when you are attacked at home (not
          while travelling).
        </p>
      </GuideSection>

      <GuideSection id="market" title={`${OS_TERMS.market} — auctions`}>
        <GuideList>
          <li>
            <strong>Global</strong> — All cities share one {OS_TERMS.market}. Browse, filter by
            category, bid on live listings.
          </li>
          <li>
            <strong>List items</strong> — {OS_TERMS.weapons}, {OS_TERMS.rides.toLowerCase()},{' '}
            {OS_TERMS.technology.toLowerCase()}, supplies, {OS_TERMS.specialists.toLowerCase()},{' '}
            {OS_TERMS.enforcers.toLowerCase()}. Set start price, quantity, duration (
            {formatMarketDurations()}).
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
            <strong>Settlement</strong> — Won items and sale cash arrive via {OS_TERMS.reports} when
            the auction ends.
          </li>
          <li>
            <strong>Reference floors</strong> — {OS_TERMS.specialist} from $
            {REDLITE_MARKET_STARTING_PRICES.whore.toLocaleString()},{' '}
            {OS_TERMS.enforcer.toLowerCase()} from $
            {REDLITE_MARKET_STARTING_PRICES.thug.toLocaleString()}, {OS_TERMS.ride.toLowerCase()}{' '}
            from ${REDLITE_MARKET_STARTING_PRICES.ride.toLocaleString()} (players often bid above
            these).
          </li>
        </GuideList>
        <p className="g-note g-guide-body g-note-warn">
          Big cash on hand after winning an auction makes you a Breach target — spend, Safe it, or buy
          gear quickly.
        </p>
      </GuideSection>

      <GuideSection id="cartels" title={`${OS_TERMS.factions} — teams`}>
        <GuideList>
          <li>
            <strong>Join or create</strong> — Accept invites or request to join from the{' '}
            {OS_TERMS.factions} page. Leaders approve join requests.
          </li>
          <li>
            <strong>Treasury</strong> — Members deposit cash into a shared pool for faction
            purchases.
          </li>
          <li>
            <strong>Armoury</strong> — Faction buys shared {OS_TERMS.enforcers.toLowerCase()},{' '}
            {OS_TERMS.glocks.toLowerCase()}, {OS_TERMS.uzis.toLowerCase()}, and{' '}
            {OS_TERMS.rides.toLowerCase()}. Stock protects all members in same-city defence. Armoury
            gear is not lost like personal weapons in some attack outcomes.
          </li>
          <li>
            <strong>Response Force</strong> — When a home member is attacked, the faction may
            deploy extra virtual {OS_TERMS.enforcers.toLowerCase()} (limited by pool,{' '}
            {OS_TERMS.rides.toLowerCase()}, and city presence).
          </li>
          <li>
            <strong>Leadership</strong> — HQ roles manage invites, treasury, and armoury purchases.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="travel" title={`${OS_TERMS.travel} — change city`}>
        <GuideList>
          <li>
            Costs <strong>{REDLITE_TURNS.travelTurnCost} turns</strong> to move to another city.
          </li>
          <li>
            While travelling: no {OS_TERMS.scout}, {TERMS.operations}, or {OS_TERMS.attack}.
          </li>
          <li>Unlocks that city&apos;s scout areas and attack targets when you arrive.</li>
          <li>
            Faction defence only applies at home — travelling members fight alone.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="businesses" title={OS_TERMS.businesses}>
        <GuideList>
          <li>
            <strong>Own up to {MAX_BUSINESSES_PER_PLAYER}</strong> —{' '}
            {BUSINESS_TYPE_RULES.NIGHTCLUB.displayName} ({BUSINESS_TYPE_RULES.NIGHTCLUB.blurb}),
            {BUSINESS_TYPE_RULES.WAREHOUSE.displayName} (
            {BUSINESS_TYPE_RULES.WAREHOUSE.blurb}), {BUSINESS_TYPE_RULES.DRUG_LAB.displayName} (
            {BUSINESS_TYPE_RULES.DRUG_LAB.blurb}).
          </li>
          <li>
            <strong>Assign crew</strong> — {OS_TERMS.specialists} earn passively; security{' '}
            {OS_TERMS.enforcers.toLowerCase()} reduce raid losses. Assigned crew leave street
            Scout/{TERMS.operations}.
          </li>
          <li>
            <strong>Safe</strong> — Store cash inside; hidden from street{' '}
            {OS_TERMS.influence.toLowerCase()} until collected.
          </li>
          <li>
            <strong>{OS_TERMS.technology} storage</strong> — Park bulk{' '}
            {OS_TERMS.technology.toLowerCase()} off the street.
          </li>
          <li>
            <strong>{OS_TERMS.heat}</strong> — Rises with activity and stored value. High{' '}
            {OS_TERMS.heat.toLowerCase()} = {OS_TERMS.securitySweep.toLowerCase()} risk (report sent
            if hit).
          </li>
          <li>
            <strong>Upgrades</strong> — Levels 1–5: more capacity, bigger Safe, more storage. Cost
            cash + real time. Report when done.
          </li>
          <li>
            <strong>Business Network</strong> — Owning and upgrading expands your city connections,
            improving {OS_TERMS.specialist.toLowerCase()} and/or {OS_TERMS.enforcer.toLowerCase()}{' '}
            recruitment while Scouting. {BUSINESS_TYPE_RULES.WAREHOUSE.displayName} favours{' '}
            {OS_TERMS.specialists.toLowerCase()}, {BUSINESS_TYPE_RULES.NIGHTCLUB.displayName} helps
            both, {BUSINESS_TYPE_RULES.DRUG_LAB.displayName} favours{' '}
            {OS_TERMS.enforcers.toLowerCase()}. Recruitment bonuses do not increase Scout cash.
          </li>
        </GuideList>
      </GuideSection>

      <GuideSection id="wire" title={`${OS_TERMS.wire.toUpperCase()} — voice & typed commands`}>
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
          {OS_TERMS.wire} is optional — every action is still available through normal menus.
        </p>
      </GuideSection>

      <GuideSection id="rankings" title={`${OS_TERMS.rankings} & ${OS_TERMS.reports.toLowerCase()}`}>
        <p className="g-note g-guide-body">
          <strong>{OS_TERMS.rankings}</strong> — See city and global leaders by{' '}
          {OS_TERMS.influence.toLowerCase()}. Growing fast climbs the board but attracts attackers.
        </p>
        <p className="g-note g-guide-body">
          <strong>{OS_TERMS.reports}</strong> — Permanent inbox: attacks, intel, market results,
          faction events, {OS_TERMS.securitySweep.toLowerCase()}s, upgrade completions. Unread count
          on Home and More menu. Open each report for full detail — outcomes are not always shown on
          the action screen.
        </p>
      </GuideSection>

      <GuideSection id="tips" title="Tips &amp; common mistakes">
        <GuideList>
          <li>
            Scout before {TERMS.operations} — no crew means no income.
          </li>
          <li>
            Buy {OS_TERMS.weapons.toLowerCase()} + {OS_TERMS.rations.toLowerCase()} before your first
            big {TERMS.operations} run.
          </li>
          <li>Check {OS_TERMS.empire} morale meters every session.</li>
          <li>
            Do not leave huge cash on the street after {OS_TERMS.market} sales.
          </li>
          <li>Gather intel before attacking stronger rivals.</li>
          <li>
            Assign security before storing big Safe or {OS_TERMS.technology.toLowerCase()} balances.
          </li>
          <li>
            Join a {OS_TERMS.faction.toLowerCase()} before your {OS_TERMS.influence.toLowerCase()}{' '}
            spikes.
          </li>
          <li>
            Read {OS_TERMS.reports} — that is where wins, losses, and loot are recorded.
          </li>
          <li>Scroll this whole page — every topic in the menu above has a section below.</li>
        </GuideList>
      </GuideSection>

      <GuideSection id="reference" title={`Scout areas in ${districtName}`}>
        <p className="g-note g-guide-body">
          Five areas per city. Pick based on whether you need {OS_TERMS.specialists.toLowerCase()} or{' '}
          {OS_TERMS.enforcers.toLowerCase()}.
        </p>
        {scoutAreas.map((area) => (
          <p key={area.slug} className="g-note g-guide-body">
            <strong>{area.name}</strong> — {OS_TERMS.specialists}: {area.workers},{' '}
            {OS_TERMS.enforcers}: {area.thugs}, Risk: {area.risk}
          </p>
        ))}
      </GuideSection>

      <p className="g-note g-guide-body g-guide-footer">
        <Link href="/command">Home</Link>
        {' · '}
        <Link href="/empire">{OS_TERMS.empire}</Link>
        {' · '}
        <Link href="/scout">{OS_TERMS.scout}</Link>
        {' · '}
        <Link href="/produce">{TERMS.operations}</Link>
        {' · '}
        <Link href="/shop">{OS_TERMS.shop}</Link>
        {' · '}
        <Link href="/attack">{OS_TERMS.attack}</Link>
        {' · '}
        <Link href="/market">{OS_TERMS.market}</Link>
        {' · '}
        <Link href="/businesses">{OS_TERMS.businesses}</Link>
        {' · '}
        <Link href="/cartels">{OS_TERMS.factions}</Link>
        {' · '}
        <Link href="/reports">{OS_TERMS.reports}</Link>
      </p>
    </>
  );
}
