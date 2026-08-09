export default function GameLoading() {
  return (
    <div className="g-shell g-loading-shell" aria-busy="true" aria-label="Loading">
      <div className="g-top">
        <div className="g-brand-row">
          <span className="g-brand">NEON UNDERWORLD</span>
        </div>
        <div className="g-loading-bar" />
        <div className="g-loading-bar g-loading-bar--short" />
      </div>
      <main className="g-main">
        <div className="g-loading-title" />
        <div className="g-loading-panel" />
        <div className="g-loading-panel g-loading-panel--sm" />
      </main>
    </div>
  );
}
