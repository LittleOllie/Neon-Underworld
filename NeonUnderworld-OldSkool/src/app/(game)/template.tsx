'use client';

/** Fades in route content when navigation completes — pairs with loading skeleton + veil. */
export default function GameRouteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="g-route-enter">{children}</div>;
}
