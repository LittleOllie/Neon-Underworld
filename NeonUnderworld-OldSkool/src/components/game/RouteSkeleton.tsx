import type { RouteSkeletonVariant } from '@local/lib/route-skeleton';

function Sk({ className }: { className?: string }) {
  return <span className={`g-sk${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}

function SkTitle() {
  return (
    <div className="g-sk-block g-sk-title-row">
      <Sk className="g-sk-icon" />
      <Sk className="g-sk-title" />
    </div>
  );
}

function SkFilters({ count = 4 }: { count?: number }) {
  return (
    <div className="g-sk-filters">
      {Array.from({ length: count }, (_, i) => (
        <Sk key={i} className="g-sk-filter" />
      ))}
    </div>
  );
}

function SkRow({ tall }: { tall?: boolean }) {
  return (
    <div className={`g-sk-row${tall ? ' g-sk-row--tall' : ''}`}>
      <Sk className="g-sk-row-title" />
      <Sk className="g-sk-row-meta" />
    </div>
  );
}

function SkAreaRow() {
  return (
    <div className="g-sk-area">
      <Sk className="g-sk-area-name" />
      <Sk className="g-sk-area-meta" />
    </div>
  );
}

function SkButton({ full }: { full?: boolean }) {
  return <Sk className={`g-sk-btn${full ? ' g-sk-btn--full' : ''}`} />;
}

function SkInput() {
  return <Sk className="g-sk-input" />;
}

function SkStatRows({ count = 3 }: { count?: number }) {
  return (
    <div className="g-sk-stats">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="g-sk-stat">
          <Sk className="g-sk-stat-label" />
          <Sk className="g-sk-stat-value" />
        </div>
      ))}
    </div>
  );
}

function SkActionGrid() {
  return (
    <div className="g-sk-actions">
      {Array.from({ length: 4 }, (_, i) => (
        <Sk key={i} className="g-sk-action" />
      ))}
    </div>
  );
}

function SkShopTabs() {
  return (
    <div className="g-sk-filters">
      {Array.from({ length: 3 }, (_, i) => (
        <Sk key={i} className="g-sk-filter g-sk-filter--wide" />
      ))}
    </div>
  );
}

function SkShopItem() {
  return (
    <div className="g-sk-shop-item">
      <Sk className="g-sk-shop-name" />
      <Sk className="g-sk-shop-meta" />
      <div className="g-sk-shop-buy">
        <Sk className="g-sk-input g-sk-input--sm" />
        <Sk className="g-sk-btn" />
      </div>
    </div>
  );
}

export function RouteSkeleton({ variant }: { variant: RouteSkeletonVariant }) {
  switch (variant) {
    case 'home':
      return (
        <>
          <SkTitle />
          <Sk className="g-sk-status" />
          <SkActionGrid />
        </>
      );
    case 'empire':
      return (
        <>
          <SkTitle />
          <SkStatRows count={4} />
          <Sk className="g-sk-section" />
          <SkStatRows count={3} />
        </>
      );
    case 'action':
      return (
        <>
          <SkTitle />
          <SkAreaRow />
          <SkAreaRow />
          <SkInput />
          <SkButton full />
        </>
      );
    case 'shop':
      return (
        <>
          <SkTitle />
          <SkShopTabs />
          <SkShopItem />
          <SkShopItem />
          <SkShopItem />
        </>
      );
    case 'list':
      return (
        <>
          <SkTitle />
          <SkFilters />
          {Array.from({ length: 6 }, (_, i) => (
            <SkRow key={i} tall={i % 2 === 0} />
          ))}
        </>
      );
    case 'profile':
      return (
        <>
          <SkTitle />
          <SkStatRows count={4} />
          <SkButton full />
        </>
      );
    default:
      return (
        <>
          <SkTitle />
          <SkRow tall />
          <SkRow />
          <SkRow />
        </>
      );
  }
}
