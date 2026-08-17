'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getBootCopy, BOOT_SCREEN } from '@local/config/boot-screen';
import {
  resolveBootDismissTarget,
  resolveBootSessionStatus,
} from '@local/lib/boot-screen-session';
import { BootBackgroundArt } from './BootBackgroundArt';
import { BootLogoutButton } from './BootLogoutButton';
import { BrandedLoader } from './BrandedLoader';

const SMOKE_EXIT_MS = 920;

const BOOT_DISMISSED_KEY = 'nu-boot-dismissed';

function readBootDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(BOOT_DISMISSED_KEY) === '1';
}

type BootPhase = 'active' | 'exit' | 'hidden';

/**
 * Full-screen intro with logo, welcome, and Enter — shown on each fresh visit until dismissed.
 * Session-safe: loading never routes to login; protected routes preserve deep links.
 */
export function BootScreen({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const [phase, setPhase] = useState<BootPhase>(() => (readBootDismissed() ? 'hidden' : 'active'));

  const bootStatus = resolveBootSessionStatus(sessionStatus, pathname);
  const copy = getBootCopy(bootStatus, session?.user?.alias);
  const showLogout = bootStatus === 'authenticated';
  const isReady = bootStatus !== 'loading';
  const dismissTarget = resolveBootDismissTarget(pathname, bootStatus);

  function dismissBoot() {
    if (phase !== 'active' || !isReady || dismissTarget === null) return;
    setPhase('exit');

    window.setTimeout(() => {
      if (dismissTarget !== pathname) {
        router.push(dismissTarget);
      }
      sessionStorage.setItem(BOOT_DISMISSED_KEY, '1');
      setPhase('hidden');
    }, SMOKE_EXIT_MS);
  }

  const bootClass = BOOT_SCREEN.artIncludesBranding ? ' nu-boot--intro-art' : '';

  return (
    <>
      {phase !== 'hidden' && (
        <div
          className={`nu-boot${bootClass}${phase === 'exit' ? ' nu-boot--exit' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="nu-boot-heading"
          aria-live="polite"
        >
          <BootBackgroundArt />

          <div className="nu-boot__smoke" aria-hidden="true">
            <div className="nu-boot__smoke-layer nu-boot__smoke-layer--red" />
            <div className="nu-boot__smoke-layer nu-boot__smoke-layer--gold" />
          </div>

          {showLogout && <BootLogoutButton />}

          <div className="nu-boot__panel">
            <h2 id="nu-boot-heading" className="nu-boot__sr-only">
              Neon Underworld
            </h2>

            {copy.welcome && <p className="nu-boot__welcome">{copy.welcome}</p>}
            {copy.alias && <p className="nu-boot__alias">{copy.alias}</p>}
            {!copy.welcome && bootStatus === 'unauthenticated' && isReady && (
              <p className="nu-boot__tagline">Enter the network</p>
            )}

            <p className="nu-boot__status">{copy.status}</p>

            {!isReady && <BrandedLoader size="sm" />}

            {isReady && copy.enterLabel && (
              <button type="button" className="nu-boot__enter" onClick={dismissBoot}>
                {copy.enterLabel}
              </button>
            )}
          </div>
        </div>
      )}
      {children}
    </>
  );
}
