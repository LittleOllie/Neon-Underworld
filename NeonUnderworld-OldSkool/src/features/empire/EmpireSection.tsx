import type { ReactNode } from 'react';
import type { EmpireSectionMetric } from '@local/features/empire/empire-helpers';

type EmpireSectionProps = {
  title: string;
  flavourLabel?: string;
  /** @deprecated Prefer `metric` — large right-rail count display */
  badge?: string;
  metric?: EmpireSectionMetric;
  previewLines?: string[];
  summaryExtra?: ReactNode;
  children: ReactNode;
};

/** Collapsed-by-default empire division accordion. */
export function EmpireSection({
  title,
  flavourLabel,
  badge,
  metric,
  previewLines,
  summaryExtra,
  children,
}: EmpireSectionProps) {
  const summaryClass = metric
    ? 'g-business-section-summary g-empire-section-summary g-empire-section-summary--metric'
    : 'g-business-section-summary g-empire-section-summary';

  return (
    <details className="g-business-section g-empire-section">
      <summary className={summaryClass}>
        <span className="g-business-section-chevron" aria-hidden />
        <span className="g-empire-section-summary__main">
          <span className="g-empire-section-summary__head">
            <span className="g-business-section-title">{title}</span>
            {flavourLabel ? (
              <span className="g-empire-section-flavour">{flavourLabel}</span>
            ) : null}
          </span>
          {previewLines?.map((line) => (
            <span key={line} className="g-empire-section-preview">
              {line}
            </span>
          ))}
          {summaryExtra ? (
            <span className="g-empire-section-summary__extra">{summaryExtra}</span>
          ) : null}
        </span>
        {metric ? (
          <span className="g-empire-section-count" aria-label={`${metric.value} ${metric.label}`}>
            <span className="g-empire-section-count__value">{metric.value}</span>
            <span className="g-empire-section-count__label">{metric.label}</span>
            {metric.subLabel ? (
              <span className="g-empire-section-count__sub">{metric.subLabel}</span>
            ) : null}
          </span>
        ) : badge ? (
          <span className="g-business-section-badge">{badge}</span>
        ) : null}
      </summary>
      <div className="g-business-section-body g-empire-section-body">{children}</div>
    </details>
  );
}
