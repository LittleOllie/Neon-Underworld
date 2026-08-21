import { formatRank } from '@local/lib/format-rank';
import type { EmpireManagementData } from '@local/domain/empire.model';
import { OS_TERMS } from '@local/config/terminology';
import {
  empireBusinessesOwned,
  formatEmpireSummaryMoney,
} from '@local/features/empire/empire-helpers';
import { empireScaleDescriptor, empireTotalCrew } from '@local/features/empire/empire-scale';

interface Props {
  data: EmpireManagementData;
}

export function EmpireHero({ data }: Props) {
  const totalCrew = empireTotalCrew(data.personnel.totalWorkers, data.personnel.totalThugs);
  const businessesOwned = empireBusinessesOwned(data);
  const district = data.player.city.toUpperCase();

  return (
    <section className="g-empire-hero" aria-label="Your empire">
      <p className="g-empire-hero__eyebrow">YOUR EMPIRE</p>
      <p className="g-empire-hero__scale">{empireScaleDescriptor(totalCrew)}</p>

      <div className="g-empire-hero__primary">
        <div className="g-empire-hero__stat g-empire-hero__stat--nw">
          <span className="g-empire-hero__value">{formatEmpireSummaryMoney(data.player.netWorth)}</span>
          <span className="g-empire-hero__label">{OS_TERMS.influence}</span>
        </div>
        <div className="g-empire-hero__stat">
          <span className="g-empire-hero__value">{formatRank(data.player.rank)}</span>
          <span className="g-empire-hero__label">{district}</span>
        </div>
        <div className="g-empire-hero__stat g-empire-hero__stat--crew">
          <span className="g-empire-hero__value">{totalCrew.toLocaleString()}</span>
          <span className="g-empire-hero__label">Total Crew</span>
        </div>
      </div>

      <div className="g-empire-hero__breakdown">
        <span>
          {data.personnel.totalWorkers.toLocaleString()} {OS_TERMS.workers}
        </span>
        <span className="g-empire-hero__sep" aria-hidden>
          ·
        </span>
        <span>
          {data.personnel.totalThugs.toLocaleString()} {OS_TERMS.thugs}
        </span>
        <span className="g-empire-hero__sep" aria-hidden>
          ·
        </span>
        <span>
          {businessesOwned.toLocaleString()}{' '}
          {businessesOwned === 1 ? 'Business' : 'Businesses'}
        </span>
      </div>
    </section>
  );
}
