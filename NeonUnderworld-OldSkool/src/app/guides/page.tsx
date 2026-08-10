import Link from 'next/link';
import { GameShell, PageTitle, SectionLabel, Divider } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';
import { CITY_SHOP_ITEMS, PERSONNEL_CATALOG } from '@core/config/game/shop-rules';
import { REDLITE_TURNS } from '@core/config/game/redlite-rules';

export default async function GuidesPage() {
  const { ctx } = await requireGameSession();
  const scoutAreas = getScoutAreaDisplays();

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="guides">
      <PageTitle icon="guides">Guides</PageTitle>

      <SectionLabel>Core Loop</SectionLabel>
      <p className="g-note g-guide-body">
        Scout → recruit · Produce → drugs & income · Shop → supplies · Attack → rivals with intel.
      </p>
      <p className="g-note g-guide-body">
        <Link href="/scout">Scout</Link>
        {' · '}
        <Link href="/produce">Produce</Link>
        {' · '}
        <Link href="/shop">Shop</Link>
      </p>

      <Divider />

      <SectionLabel>Personnel</SectionLabel>
      <p className="g-note g-guide-body">
        Workers and thugs are recruited via Scout — not sold in the shop.
      </p>
      <p className="g-note g-guide-body">
        Worker ${PERSONNEL_CATALOG[0]?.netWorthValue.toLocaleString()} · Thug ${PERSONNEL_CATALOG[1]?.netWorthValue.toLocaleString()} valuation.
      </p>

      <Divider />

      <SectionLabel>City Shop</SectionLabel>
      <p className="g-note g-guide-body">
        {CITY_SHOP_ITEMS.length} support items. Hash is affordable; other drugs are intentionally inefficient vs producing.
      </p>

      <Divider />

      <SectionLabel>Scout Areas</SectionLabel>
      {scoutAreas.map((a) => (
        <p key={a.slug} className="g-note g-guide-body">
          <strong>{a.name}</strong> — Workers: {a.workers}, Thugs: {a.thugs}, Risk: {a.risk}
        </p>
      ))}

      <Divider />

      <SectionLabel>Payout</SectionLabel>
      <p className="g-note g-guide-body">
        1–100% worker payout. Lower keeps more cash; higher improves stability and future defence.
      </p>

      <Divider />

      <SectionLabel>Turns</SectionLabel>
      <p className="g-note g-guide-body">
        {REDLITE_TURNS.turnsPerInterval} every {REDLITE_TURNS.intervalMinutes} minutes.
      </p>

      <Divider />

      <SectionLabel>More Systems</SectionLabel>
      <p className="g-note g-guide-body">
        <Link href="/market">Market</Link>
        {' · '}
        <Link href="/travel">Travel</Link>
        {' · '}
        <Link href="/cartels">Cartel</Link>
      </p>
    </GameShell>
  );
}
