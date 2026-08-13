import Link from 'next/link';
import { PageTitle, SectionLabel, Divider } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';
import { REDLITE_TURNS, REDLITE_ATTACK } from '@core/config/game/redlite-rules';
import { ATTACK_RULES } from '@core/config/game/attack-rules';
import { THUG_HIRE_PRICE } from '@core/config/game/hire-thugs-rules';
import { MAX_BUSINESSES_PER_PLAYER } from '@core/config/game/business-rules';
import { isPlaytestTurnsNavVisible } from '@core/config/game/playtest';

export default async function HowToPlayPage() {
  const { ctx } = await requireGameSession();
  const scoutAreas = getScoutAreaDisplays(ctx.district.slug);

  return (
    <>
      <PageTitle icon="guides">How to Play</PageTitle>

      <p className="g-note g-guide-body">
        Neon Underworld is a turn-based district empire game. Scout to build your crew, produce drugs
        and cash, equip your people, and take on rivals — all in your city.
      </p>

      <Divider />

      <SectionLabel id="start-here">Start here</SectionLabel>

      <p className="g-note g-guide-body">
        <strong>What is Neon Underworld?</strong> Grow your street empire and net worth. Rankings
        track exposed wealth. Most actions cost turns.
      </p>
      <p className="g-note g-guide-body">
        <strong>Turns</strong> — New players start with {REDLITE_TURNS.startingTurns.toLocaleString()}{' '}
        turns (the cap). Turns regenerate {REDLITE_TURNS.turnsPerInterval} every{' '}
        {REDLITE_TURNS.intervalMinutes} minutes.
        {isPlaytestTurnsNavVisible() ? (
          <>
            {' '}
            For testing, use <Link href="/playtest/turns">More → Add Turns</Link>.
          </>
        ) : null}
      </p>
      <p className="g-note g-guide-body">
        <strong>Workers &amp; Thugs</strong> — Workers earn income on Scout and Produce. Thugs fight,
        help Produce, and protect Workers. Recruit both via <Link href="/scout">Scout</Link> (not the
        Shop). Hire Thugs in the Shop costs ${THUG_HIRE_PRICE.toLocaleString()} each.
      </p>
      <p className="g-note g-guide-body">
        <strong>Street vs Business crew</strong> — Workers and Thugs assigned to a Business leave
        street operations. Business Workers generate passive income. Security Thugs protect Businesses.
      </p>
      <p className="g-note g-guide-body">
        <strong>Net worth</strong> — A measure of your exposed street empire used for rankings and
        attack eligibility. Includes cash, street crew, rides, street drugs, and business asset value.
        Safe cash and stored business drugs are excluded while stored in the business.
      </p>

      <Divider />

      <SectionLabel id="build-empire">Build your empire</SectionLabel>

      <p className="g-note g-guide-body">
        <strong>Scout</strong> — Spend turns in city areas to recruit Workers and Thugs and earn some
        cash. Start with 25 turns on the Streets. Higher-risk areas can yield more but may cost crew.
      </p>
      <p className="g-note g-guide-body">
        <strong>Produce</strong> — With Workers and Thugs, spend turns to earn cash and drugs. Drug
        types matter — some drugs support Worker supplies, others are for profit or business storage.
      </p>
      <p className="g-note g-guide-body">
        <strong>Shop</strong> — Weapons, rides, beer, condoms, and hash. Workers are recruited via
        Scout, not bought here.
      </p>
      <p className="g-note g-guide-body">
        <strong>Supplies &amp; happiness</strong> — Workers care about condoms, hash (supplies),
        thug protection, and payout %. Thugs care about weapons and beer. Low happiness reduces
        efficiency, can cause walkouts, and makes Workers easier to poach.
      </p>
      <p className="g-note g-guide-body">
        <strong>Hire Thugs</strong> — ${THUG_HIRE_PRICE.toLocaleString()} per thug from the Shop when
        you need crew without scouting.
      </p>

      <Divider />

      <SectionLabel id="go-to-war">Go to war</SectionLabel>

      <p className="g-note g-guide-body">
        <strong>Intel</strong> — From a profile in your district, gather basic intel for{' '}
        {ATTACK_RULES.intelGatherTurnCost} turns. Reports show force estimates and last about{' '}
        {ATTACK_RULES.scoutReportExpiryHours} hours. You can also attack without intel.
      </p>
      <p className="g-note g-guide-body">
        <strong>Deep Intel</strong> — After basic intel on a same-city target, spend{' '}
        {ATTACK_RULES.deepIntelTurnCost} turns for deeper estimates (counts, cash/drug bands, cartel
        protection hints).
      </p>
      <p className="g-note g-guide-body">
        <strong>Attacks</strong> — Same district only. Target net worth must be at least{' '}
        {REDLITE_ATTACK.minNetWorthMultiplier * 100}% of yours — you can punch upward with no upper
        cap. Arm thugs, bring enough rides, and read results in <Link href="/reports">Reports</Link>.
      </p>
      <p className="g-note g-guide-body">
        <strong>Worker poaching</strong> — A dedicated attack type to steal Workers from a rival.
        Success depends on forces, protection, and defender Worker happiness. Low happiness makes
        poaching easier.
      </p>
      <p className="g-note g-guide-body">
        <strong>Protection</strong> — Offline players can be attacked. Cartel members in your city may
        add virtual defence thugs when you are attacked.
      </p>

      <Divider />

      <SectionLabel id="underworld">Underworld</SectionLabel>

      <p className="g-note g-guide-body">
        <strong>Travel</strong> — Costs {REDLITE_TURNS.travelTurnCost} turns to move districts. You
        cannot scout, produce, or attack while travelling.
      </p>
      <p className="g-note g-guide-body">
        <strong>Market</strong> — Global auction house for tradable items and personnel. List, bid, and
        collect results when auctions end.
      </p>
      <p className="g-note g-guide-body">
        <strong>Cartels</strong> — Team up for shared treasury, armoury, and same-city defence
        bonuses. Accept invites from <Link href="/cartels">Cartels</Link>.
      </p>
      <p className="g-note g-guide-body">
        <strong>Businesses</strong> — Own up to {MAX_BUSINESSES_PER_PLAYER} businesses for passive
        income, drug storage, and Safe cash. Assign Workers and Security from your street crew. Collect
        Safe cash to bring it into street cash. Heat rises with activity and stored value — high heat
        increases police raid risk.
      </p>
      <p className="g-note g-guide-body">
        <strong>Business upgrades</strong> — Levels 1–5 increase capacity, Safe size, and storage.
        Upgrades cost cash and take real time. You get a report when complete.
      </p>

      <Divider />

      <SectionLabel id="reference">Reference</SectionLabel>

      <p className="g-note g-guide-body">
        <strong>Home alerts</strong> — <Link href="/command">Home</Link> surfaces attacks, poaching,
        police raids, full Safes, upgrades, cartel invites, and supply warnings.
      </p>
      <p className="g-note g-guide-body">
        <strong>Scout areas ({ctx.district.name})</strong>
      </p>
      {scoutAreas.map((a) => (
        <p key={a.slug} className="g-note g-guide-body">
          <strong>{a.name}</strong> — Workers: {a.workers}, Thugs: {a.thugs}, Risk: {a.risk}
        </p>
      ))}

      <p className="g-note g-guide-body">
        <Link href="/empire">Empire</Link>
        {' · '}
        <Link href="/scout">Scout</Link>
        {' · '}
        <Link href="/produce">Produce</Link>
        {' · '}
        <Link href="/businesses">Businesses</Link>
        {' · '}
        <Link href="/reports">Reports</Link>
      </p>
    </>
  );
}
