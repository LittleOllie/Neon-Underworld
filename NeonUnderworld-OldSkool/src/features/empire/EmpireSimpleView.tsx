import Link from 'next/link';
import { StatusBar } from '@local/components/game/StatusBar';
import { BusinessHeatSummary } from '@local/components/game/BusinessHeatSummary';
import { StatRow } from '@local/components/game/StatRow';
import { PayoutForm } from '@local/features/empire/PayoutForm';
import { EmpireSection } from '@local/features/empire/EmpireSection';
import { EmpirePreferredSupplyBar } from '@local/features/empire/EmpirePreferredSupplyBar';
import { EmpireHero } from '@local/features/empire/EmpireHero';
import {
  empireBusinessesMetric,
  empireBusinessesOwned,
  empireDrugsMetric,
  empireGearMetric,
  empireStreetDrugUnits,
  empireThugsMetric,
  empireWorkersMetric,
} from '@local/features/empire/empire-helpers';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { OS_TERMS, resourceLabel, type ResourceDisplayKey } from '@local/config/terminology';
import { shopHrefForItem } from '@local/config/shop-display';

interface Props {
  data: EmpireManagementData;
}

function technologyResourceLabel(key: string, fallback: string): string {
  if (key === 'hash' || key === 'shrooms' || key === 'coke' || key === 'heroin') {
    return resourceLabel(key as ResourceDisplayKey);
  }
  return fallback;
}

function weaponResourceLabel(key: string, fallback: string): string {
  if (key === 'glocks') return OS_TERMS.glocks;
  if (key === 'uzis') return OS_TERMS.uzis;
  if (key === 'aks') return OS_TERMS.aks;
  return fallback;
}

export function EmpireSimpleView({ data }: Props) {
  const workerHappy = Math.round(data.statusMeters.worker.stability.value);
  const thugHappy = Math.round(data.statusMeters.thug.stability.value);
  const ops = data.businessOperations;
  const streetDrugUnits = empireStreetDrugUnits(data.drugs);
  const businessesOwned = empireBusinessesOwned(data);

  return (
    <>
      <EmpireHero data={data} />

      <div className="g-empire-sections">
        <EmpireSection
          title={OS_TERMS.workers.toUpperCase()}
          flavourLabel="Workforce"
          metric={empireWorkersMetric(data.personnel.totalWorkers)}
          summaryExtra={
            <EmpirePreferredSupplyBar
              itemKey={data.preferredSupplies.specialists.shopItemKey}
              label={data.preferredSupplies.specialists.label}
              quantity={data.preferredSupplies.specialists.quantity}
              readinessPercent={data.preferredSupplies.specialists.readinessPercent}
            />
          }
        >
          <StatRow label="Total" value={data.personnel.totalWorkers.toLocaleString()} />
          <StatRow label="Active" value={data.personnel.streetWorkers.toLocaleString()} />
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
          <StatusBar label="Morale" percent={workerHappy} />

          <div className="g-empire-payout-panel">
            <p className="g-empire-payout-panel__label">{OS_TERMS.specialist} payout</p>
            <p className="g-empire-payout-panel__hint">
              Current {data.personnel.workerPayoutPercent}% — adjust retention vs profit
            </p>
            <PayoutForm initialPayout={data.personnel.workerPayoutPercent} />
          </div>
        </EmpireSection>

        <EmpireSection
          title={OS_TERMS.thugs.toUpperCase()}
          flavourLabel="Muscle"
          metric={empireThugsMetric(data.personnel.totalThugs)}
          summaryExtra={
            <EmpirePreferredSupplyBar
              itemKey={data.preferredSupplies.enforcers.shopItemKey}
              label={data.preferredSupplies.enforcers.label}
              quantity={data.preferredSupplies.enforcers.quantity}
              readinessPercent={data.preferredSupplies.enforcers.readinessPercent}
            />
          }
        >
          <StatRow label="Total" value={data.personnel.totalThugs.toLocaleString()} />
          <StatRow label="Active" value={data.personnel.streetThugs.toLocaleString()} />
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
          <StatusBar label="Morale" percent={thugHappy} />
          <StatRow
            label="Armed (active)"
            value={`${data.personnel.armedThugs} / ${data.personnel.streetThugs}`}
          />
        </EmpireSection>

        <EmpireSection
          title={OS_TERMS.drugs.toUpperCase()}
          flavourLabel="Product"
          metric={empireDrugsMetric(streetDrugUnits)}
        >
          {data.drugs.byType.map((d) => (
            <StatRow
              key={d.key}
              label={technologyResourceLabel(d.key, d.name)}
              value={d.quantity.toLocaleString()}
            />
          ))}
        </EmpireSection>

        <EmpireSection
          title="GEAR"
          flavourLabel="Arsenal"
          metric={empireGearMetric(data.weapons, data.vehicles)}
        >
          {data.weapons.byType.map((w) => (
            <StatRow
              key={w.key}
              label={weaponResourceLabel(w.key, w.name)}
              value={w.quantity.toLocaleString()}
            />
          ))}
          <StatRow label="Rides" value={data.vehicles.totalVehicles.toLocaleString()} />
          {data.vehicles.totalVehicles === 0 ? (
            <p className="g-empire-empty-hint">
              No rides yet —{' '}
              <Link href={shopHrefForItem('ride')} className="g-empire-shop-link">
                buy in Shop
              </Link>
            </p>
          ) : null}
        </EmpireSection>

        <EmpireSection
          title="BUSINESSES"
          flavourLabel="Business network"
          metric={empireBusinessesMetric(businessesOwned)}
        >
          {businessesOwned === 0 ? (
            <>
              <p className="g-empire-empty-state">No legitimate fronts yet.</p>
              <Link href="/businesses" className="g-btn g-btn-secondary g-empire-empty-cta">
                Build your first business →
              </Link>
            </>
          ) : (
            <>
              <StatRow
                label="Owned"
                value={`${businessesOwned.toLocaleString()} / ${(ops?.maxOwned ?? 8).toLocaleString()}`}
              />
              <StatRow
                label={`${OS_TERMS.specialists} assigned`}
                value={(ops?.assignedWorkers ?? 0).toLocaleString()}
              />
              <StatRow
                label="Security assigned"
                value={(ops?.assignedSecurityThugs ?? 0).toLocaleString()}
              />
              <StatRow label="Safe cash" value={`$${(ops?.safeBalance ?? 0).toLocaleString()}`} />
              {ops?.totalStoredDrugs != null ? (
                <StatRow label="Stored technology" value={ops.totalStoredDrugs.toLocaleString()} />
              ) : null}
              <StatRow label="Highest trace" value={ops?.overallHeat ?? '—'} />
              <Link href="/businesses" className="g-business-heat-link">
                Manage Businesses →
              </Link>
              {ops && ops.owned > 0 ? (
                <BusinessHeatSummary operations={ops} variant="empire" />
              ) : null}
            </>
          )}
        </EmpireSection>
      </div>
    </>
  );
}
