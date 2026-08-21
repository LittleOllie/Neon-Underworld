import { ActionButton } from './ActionButton';

/** Shown on Home after initial onboarding — subtle PvP discovery. */
export function PvpDiscoveryHint() {
  return (
    <section className="g-pvp-hint" aria-label="PvP discovery">
      <p className="g-pvp-hint__eyebrow">Ready for trouble?</p>
      <p className="g-pvp-hint__body">
        Scout rivals, gather Intel, and strike when you are ready — or browse standings first.
      </p>
      <div className="g-btn-row">
        <ActionButton href="/attack" icon="attack">
          Find a target
        </ActionButton>
        <ActionButton href="/rankings" icon="rankings" className="g-btn-secondary">
          View rivals
        </ActionButton>
      </div>
    </section>
  );
}
