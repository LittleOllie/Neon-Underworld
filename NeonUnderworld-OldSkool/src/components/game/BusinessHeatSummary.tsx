import Link from 'next/link';
import type { BusinessOperationsSummary } from '@local/lib/business-heat-display';
import { OS_TERMS } from '@local/config/terminology';
import { HeatStatusBar } from './HeatStatusBar';

type Props = {
  operations: BusinessOperationsSummary;
  variant?: 'home' | 'empire';
};

export function BusinessHeatSummary({ operations, variant = 'home' }: Props) {
  if (operations.owned <= 0) return null;

  const showPortfolioHeat = operations.sites.length > 1;
  const sectionClass =
    variant === 'home' ? 'g-business-heat-summary g-business-heat-summary--home' : 'g-business-heat-summary';

  return (
    <section className={sectionClass} aria-label="Business trace">
      <div className="g-business-heat-summary__head">
        <p className="g-business-heat-summary__label">Businesses</p>
        <p className="g-business-heat-summary__count">{operations.owned.toLocaleString()}</p>
      </div>

      {showPortfolioHeat ? (
        <HeatStatusBar
          label={`Overall ${OS_TERMS.heat.toLowerCase()}`}
          score={operations.overallHeatScore}
          right={operations.overallHeat}
        />
      ) : null}

      {operations.sites.map((site) => (
        <div key={site.id} className="g-business-heat-row">
          <p className="g-business-heat-name">{site.name}</p>
          <HeatStatusBar label={OS_TERMS.heat} score={site.heatScore} right={site.heatLabel} />
        </div>
      ))}

      {variant === 'home' ? (
        <Link href="/businesses" className="g-business-heat-link">
          Manage Businesses →
        </Link>
      ) : null}
    </section>
  );
}
