'use client';

import { BrandedLoader } from './BrandedLoader';

/** Compact travel overlay while the server action resolves — no fixed duration. */
export function TravelPendingOverlay({
  destination,
  visible,
}: {
  destination: string;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="g-travel-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="g-travel-overlay__panel">
        <p className="g-travel-overlay__label">EN ROUTE TO</p>
        <p className="g-travel-overlay__dest">{destination.toUpperCase()}</p>
        <p className="g-travel-overlay__sub">Moving the crew…</p>
        <BrandedLoader size="sm" />
      </div>
    </div>
  );
}
