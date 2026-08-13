import Link from 'next/link';
import type { BusinessOperationsSummary } from '@local/lib/business-heat-display';
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
    <section className={sectionClass} aria-label="Business heat">
      <div className="g-business-heat-summary__head">
        <p className="g-business-heat-summary__label">Businesses</p>
        <p className="g-business-heat-summary__count">{operations.owned.toLocaleString()}</p>
      </div>

      {showPortfolioHeat ? (
        <HeatStatusBar
          label="Overall heat"
          score={operations.overallHeatScore}
          right={operations.overallHeat}
        />
      ) : null}

      {operations.sites.map((site) => (
        <div key={site.id} className="g-business-heat-row">
          <p className="g-business-heat-name">{site.name}</p>
          <HeatStatusBar label="Heat" score={site.heatScore} right={site.heatLabel} />
        </div>
      ))}

      {variant === 'empire' ? (
        <>
          <div className="g-business-heat-meta">
            <span>{operations.assignedWorkers.toLocaleString()} Workers assigned</span>
            <span>Safe ${operations.safeBalance.toLocaleString()}</span>
          </div>
        </>
      ) : null}

      <Link href="/businesses" className="g-business-heat-link">
        Manage Businesses →
      </Link>
    </section>
  );
}
