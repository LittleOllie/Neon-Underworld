import { NAVIGATION_LOADER_LOGO } from '@local/config/navigation-transition';

/** Static first-paint splash — visible before React hydration. */
export function StartupSplash() {
  return (
    <div
      id="nu-startup-splash"
      className="nu-startup-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Connecting to network"
    >
      <div className="nu-startup-splash__veil" aria-hidden="true" />
      <div className="nu-startup-splash__core">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={NAVIGATION_LOADER_LOGO}
          alt=""
          width={96}
          height={96}
          className="nu-startup-splash__logo"
          fetchPriority="high"
          decoding="async"
        />
        <p className="nu-startup-splash__message">CONNECTING TO NETWORK...</p>
      </div>
    </div>
  );
}
