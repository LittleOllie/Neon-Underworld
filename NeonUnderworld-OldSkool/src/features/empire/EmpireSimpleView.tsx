'use client';

import { StatusBar } from '@local/components/game/StatusBar';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { SectionHeadingRow } from '@local/components/game/SectionHeadingRow';
import { StatusValueFromLabel } from '@local/components/game/StatusValue';
import { Divider } from '@local/components/game/Divider';
import { PayoutForm } from '@local/features/empire/PayoutForm';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { OS_TERMS } from '@local/config/terminology';

interface Props {
  data: EmpireManagementData;
}

export function EmpireSimpleView({ data }: Props) {
  const workerHappy = Math.round(data.statusMeters.worker.stability.value);
  const thugHappy = Math.round(data.statusMeters.thug.stability.value);
  const suppliesLabel = data.statusMeters.worker.supplies.statusText;
  const beerLabel = data.supplySummary.thugs.beer;

  return (
    <>
      <SectionHeadingRow
        label={OS_TERMS.workers.toUpperCase()}
        value={data.personnel.workers.toLocaleString()}
        icon="workers"
      />
      <StatusBar label="Happiness" percent={workerHappy} />
      <StatRow label="Payout" value={`${data.personnel.workerPayoutPercent}%`} />
      <StatRow
        label="Supplies"
        value={<StatusValueFromLabel label={suppliesLabel} />}
        valueTone="inherit"
      />

      <Divider />

      <SectionHeadingRow
        label={OS_TERMS.thugs.toUpperCase()}
        value={data.personnel.thugs.toLocaleString()}
        icon="thugs"
      />
      <StatusBar label="Happiness" percent={thugHappy} />
      <StatRow
        label="Armed"
        value={`${data.personnel.armedThugs} / ${data.personnel.thugs}`}
      />
      <StatRow label="Beer" value={<StatusValueFromLabel label={beerLabel} />} valueTone="inherit" />

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
