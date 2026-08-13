import Link from 'next/link';
import { StatusBar } from '@local/components/game/StatusBar';
import { BusinessHeatSummary } from '@local/components/game/BusinessHeatSummary';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { SectionHeadingRow } from '@local/components/game/SectionHeadingRow';
import { StatusValueFromLabel } from '@local/components/game/StatusValue';
import { Divider } from '@local/components/game/Divider';
import { PayoutForm } from '@local/features/empire/PayoutForm';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { OS_TERMS } from '@local/config/terminology';
import { shopHrefForItem } from '@local/config/shop-display';

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

  return (
    <>
      <SectionHeadingRow
        label={OS_TERMS.workers.toUpperCase()}
        value={data.personnel.totalWorkers.toLocaleString()}
        icon="workers"
      />
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
      <p className="g-note g-empire-hint">
        Street Workers earn Scout and Produce income. Business Workers generate passive business
        income and cannot do street work.
      </p>
      <StatusBar label="Street happiness" percent={workerHappy} />
      <StatRow label="Payout" value={`${data.personnel.workerPayoutPercent}%`} />
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

      <Divider />

      <SectionHeadingRow
        label={OS_TERMS.thugs.toUpperCase()}
        value={data.personnel.totalThugs.toLocaleString()}
        icon="thugs"
      />
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
      <p className="g-note g-empire-hint">
        Street Thugs fight, Produce, and protect Workers. Security Thugs protect Businesses and are
        unavailable for street actions.
      </p>
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

      {ops && ops.owned > 0 ? (
        <>
          <Divider />
          <SectionLabel>BUSINESSES</SectionLabel>
          <StatRow
            label="Owned"
            value={`${ops.owned.toLocaleString()} / ${(ops.maxOwned ?? 8).toLocaleString()}`}
          />
          <StatRow label="Workers assigned" value={ops.assignedWorkers.toLocaleString()} />
          <StatRow
            label="Security assigned"
            value={(ops.assignedSecurityThugs ?? 0).toLocaleString()}
          />
          <StatRow label="Safe cash" value={`$${ops.safeBalance.toLocaleString()}`} />
          {ops.totalStoredDrugs != null ? (
            <StatRow label="Stored drugs" value={ops.totalStoredDrugs.toLocaleString()} />
          ) : null}
          <StatRow label="Highest heat" value={ops.overallHeat} />
          <Link href="/businesses" className="g-business-heat-link">
            Manage Businesses →
          </Link>
        </>
      ) : null}

      {ops ? <BusinessHeatSummary operations={ops} variant="empire" /> : null}

      <Divider />

      <SectionLabel>{OS_TERMS.drugs.toUpperCase()}</SectionLabel>
      {data.drugs.byType.map((d) => (
        <StatRow key={d.key} label={d.name} value={d.quantity.toLocaleString()} />
      ))}

      <Divider />

      <SectionLabel>GEAR</SectionLabel>
      {data.weapons.byType.map((w) => (
        <StatRow key={w.key} label={w.name} value={w.quantity.toLocaleString()} />
      ))}
      <StatRow label="Rides" value={data.vehicles.totalVehicles.toLocaleString()} />

      <Divider />

      <SectionLabel>PAYOUT</SectionLabel>
      <PayoutForm initialPayout={data.personnel.workerPayoutPercent} />
    </>
  );
}
