import { ActionButton } from './ActionButton';

/** Shown on Home after initial onboarding — subtle PvP discovery. */
export function PvpDiscoveryHint() {
  return (
    <section className="g-pvp-hint" aria-label="PvP discovery">
      <p className="g-pvp-hint__eyebrow">Ready for trouble?</p>
      <p className="g-pvp-hint__body">
        Scout rivals in your district, gather Intel, and choose your target.
      </p>
      <ActionButton href="/rankings" icon="rankings">
        View rivals
      </ActionButton>
    </section>
  );
}
