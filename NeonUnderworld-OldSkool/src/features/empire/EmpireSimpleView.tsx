import Link from 'next/link';
import { StatusBar } from '@local/components/game/StatusBar';
import { BusinessHeatSummary } from '@local/components/game/BusinessHeatSummary';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { StatusValueFromLabel } from '@local/components/game/StatusValue';
import { PayoutForm } from '@local/features/empire/PayoutForm';
import { EmpireSection } from '@local/features/empire/EmpireSection';
import {
  empireBusinessesHeaderBadge,
  empireBusinessesOwned,
  empireDrugsHeaderBadge,
  empireGearHeaderBadge,
  empireStreetDrugUnits,
  empireThugsHeaderBadge,
  empireWorkersHeaderBadge,
  formatEmpireSummaryMoney,
} from '@local/features/empire/empire-helpers';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { OS_TERMS } from '@local/config/terminology';
import { shopHrefForItem } from '@local/config/shop-display';
import { formatRank } from '@local/lib/format-rank';

interface Props {
  data: EmpireManagementData;
}

function ShopSupplyLink({ itemKey, label }: { itemKey: string; label: React.ReactNode }) {
  return (
    <Link href={shopHrefForItem(itemKey)} className="g-empire-shop-link">
      {label}
    </Link>
  );
}

export function EmpireSimpleView({ data }: Props) {
  const workerHappy = Math.round(data.statusMeters.worker.stability.value);
  const thugHappy = Math.round(data.statusMeters.thug.stability.value);
  const suppliesLabel = data.statusMeters.worker.supplies.statusText;
  const beerLabel = data.supplySummary.thugs.beer;
  const ops = data.businessOperations;
  const streetDrugUnits = empireStreetDrugUnits(data.drugs);
  const businessesOwned = empireBusinessesOwned(data);

  return (
    <>
      <div className="g-empire-summary" aria-label="Empire summary">
        <StatRow label="Net Worth" value={formatEmpireSummaryMoney(data.player.netWorth)} />
        <StatRow label="District Rank" value={formatRank(data.player.rank)} />
        <StatRow label="Cash" value={formatEmpireSummaryMoney(data.player.cash)} />
        <StatRow label="Businesses" value={businessesOwned.toLocaleString()} />
      </div>

      <div className="g-empire-sections">
        <EmpireSection
          title={OS_TERMS.workers.toUpperCase()}
          badge={empireWorkersHeaderBadge(data.personnel.totalWorkers)}
        >
          <StatRow label="Total" value={data.personnel.totalWorkers.toLocaleString()} />
          <StatRow label="Street" value={data.personnel.streetWorkers.toLocaleString()} />
          <StatRow
            label="Business"
            value={
              data.personnel.businessWorkers > 0 ? (
                <Link href="/businesses" className="g-empire-shop-link">
                  {data.personnel.businessWorkers.toLocaleString()}
                </Link>
              ) : (
                data.personnel.businessWorkers.toLocaleString()
              )
            }
            valueTone="inherit"
          />
          <StatusBar label="Street happiness" percent={workerHappy} />
          <StatRow
            label="Supplies"
            value={
              <ShopSupplyLink
                itemKey="condom"
                label={<StatusValueFromLabel label={suppliesLabel} />}
              />
            }
            valueTone="inherit"
          />

          <SectionLabel>PAYOUT</SectionLabel>
          <StatRow label="Payout" value={`${data.personnel.workerPayoutPercent}%`} />
          <PayoutForm initialPayout={data.personnel.workerPayoutPercent} />
        </EmpireSection>

        <EmpireSection
          title={OS_TERMS.thugs.toUpperCase()}
          badge={empireThugsHeaderBadge(data.personnel.totalThugs)}
        >
          <StatRow label="Total" value={data.personnel.totalThugs.toLocaleString()} />
          <StatRow label="Street" value={data.personnel.streetThugs.toLocaleString()} />
          <StatRow
            label="Business Security"
            value={
              data.personnel.businessSecurity > 0 ? (
                <Link href="/businesses" className="g-empire-shop-link">
                  {data.personnel.businessSecurity.toLocaleString()}
                </Link>
              ) : (
                data.personnel.businessSecurity.toLocaleString()
              )
            }
            valueTone="inherit"
          />
          <StatusBar label="Street happiness" percent={thugHappy} />
          <StatRow
            label="Armed (street)"
            value={`${data.personnel.armedThugs} / ${data.personnel.streetThugs}`}
          />
          <StatRow
            label="Beer"
            value={
              <ShopSupplyLink
                itemKey="beer"
                label={<StatusValueFromLabel label={beerLabel} />}
              />
            }
            valueTone="inherit"
          />
        </EmpireSection>

        <EmpireSection
          title={OS_TERMS.drugs.toUpperCase()}
          badge={empireDrugsHeaderBadge(streetDrugUnits)}
        >
          {data.drugs.byType.map((d) => (
            <StatRow key={d.key} label={d.name} value={d.quantity.toLocaleString()} />
          ))}
        </EmpireSection>

        <EmpireSection
          title="GEAR"
          badge={empireGearHeaderBadge(data.weapons, data.vehicles)}
        >
          {data.weapons.byType.map((w) => (
            <StatRow key={w.key} label={w.name} value={w.quantity.toLocaleString()} />
          ))}
          <StatRow label="Rides" value={data.vehicles.totalVehicles.toLocaleString()} />
        </EmpireSection>

        <EmpireSection title="BUSINESSES" badge={empireBusinessesHeaderBadge(businessesOwned)}>
          <StatRow
            label="Owned"
            value={`${businessesOwned.toLocaleString()} / ${(ops?.maxOwned ?? 8).toLocaleString()}`}
          />
          <StatRow
            label="Workers assigned"
            value={(ops?.assignedWorkers ?? 0).toLocaleString()}
          />
          <StatRow
            label="Security assigned"
            value={(ops?.assignedSecurityThugs ?? 0).toLocaleString()}
          />
          <StatRow label="Safe cash" value={`$${(ops?.safeBalance ?? 0).toLocaleString()}`} />
          {ops?.totalStoredDrugs != null ? (
            <StatRow label="Stored drugs" value={ops.totalStoredDrugs.toLocaleString()} />
          ) : null}
          <StatRow label="Highest heat" value={ops?.overallHeat ?? '—'} />
          <Link href="/businesses" className="g-business-heat-link">
            Manage Businesses →
          </Link>
          {ops && ops.owned > 0 ? (
            <BusinessHeatSummary operations={ops} variant="empire" />
          ) : null}
        </EmpireSection>
      </div>
    </>
  );
}
