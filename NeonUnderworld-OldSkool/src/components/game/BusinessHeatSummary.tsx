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

  const previewLine = showPortfolioHeat
    ? `Overall ${OS_TERMS.heat.toLowerCase()}: ${operations.overallHeat}`
    : operations.sites[0]
      ? `${operations.sites[0].name} · ${operations.sites[0].heatLabel}`
      : null;

  const siteRows = (
    <>
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
    </>
  );

  if (variant === 'home') {
    return (
      <details className={`${sectionClass} g-business-heat-summary--collapsible`}>
        <summary className="g-business-heat-summary__summary">
          <span className="g-business-section-chevron" aria-hidden />
          <span className="g-business-heat-summary__summary-main">
            <span className="g-business-heat-summary__head">
              <p className="g-business-heat-summary__label">Businesses</p>
              <p className="g-business-heat-summary__count">{operations.owned.toLocaleString()}</p>
            </span>
            {previewLine ? <p className="g-business-heat-summary__preview">{previewLine}</p> : null}
          </span>
        </summary>
        <div className="g-business-heat-summary__body">
          {siteRows}
          <Link href="/businesses" className="g-business-heat-link">
            Manage Businesses →
          </Link>
        </div>
      </details>
    );
  }

  return (
    <section className={sectionClass} aria-label="Business trace">
      <div className="g-business-heat-summary__head">
        <p className="g-business-heat-summary__label">Businesses</p>
        <p className="g-business-heat-summary__count">{operations.owned.toLocaleString()}</p>
      </div>
      {siteRows}
    </section>
  );
}
