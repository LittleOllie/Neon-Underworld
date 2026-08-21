'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getBootCopy, BOOT_SCREEN } from '@local/config/boot-screen';
import {
  isBootEnterReady,
  resolveBootDismissTargetForClick,
  resolveBootSessionStatus,
  shouldSkipBootScreen,
  type ClientSessionStatus,
} from '@local/lib/boot-screen-session';
import { BootBackgroundArt } from './BootBackgroundArt';
import { BootLogoutButton } from './BootLogoutButton';
import { NuBrandLogo } from './NuBrandLogo';

const BOOT_DISMISSED_KEY = 'nu-boot-dismissed';
/** Legacy dev key — cleared on read so old builds cannot trap players behind a hidden boot. */
const BOOT_DISMISSED_PERSIST_KEY = 'nu-boot-dismissed-persist';

/** Survives HMR in the same tab between sessionStorage write and remount. */
let bootDismissedMemory = false;

function isBootDismissed(): boolean {
  if (bootDismissedMemory) return true;
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(BOOT_DISMISSED_PERSIST_KEY);
  } catch {
    /* ignore */
  }
  return sessionStorage.getItem(BOOT_DISMISSED_KEY) === '1';
}

function markBootDismissed(): void {
  bootDismissedMemory = true;
  try {
    sessionStorage.setItem(BOOT_DISMISSED_KEY, '1');
  } catch {
    /* private browsing — in-memory flag still hides boot this visit */
  }
}

/** Cleared on logout so the intro shows again on the next sign-in. */
export function clearBootDismissed(): void {
  bootDismissedMemory = false;
  try {
    sessionStorage.removeItem(BOOT_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Full-screen intro with logo, welcome, and Enter — shown once per browser tab until dismissed.
 * On game routes, middleware is the auth source of truth (not client useSession).
 */
export function BootScreen({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  /** Always false on server + first client paint — avoids sessionStorage hydration mismatch. */
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const dismissingRef = useRef(false);

  useEffect(() => {
    if (isBootDismissed()) setDismissed(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (isBootDismissed()) setDismissed(true);
  }, [pathname]);

  const skipBoot = shouldSkipBootScreen(pathname);
  const bootStatus = resolveBootSessionStatus(sessionStatus as ClientSessionStatus, pathname);
  const enterReady =
    hydrated && isBootEnterReady(sessionStatus as ClientSessionStatus, bootStatus);
  const copy = getBootCopy(enterReady ? bootStatus : 'loading', session?.user?.alias);
  const showEnter = enterReady && Boolean(copy.enterLabel);

  const dismissBoot = useCallback(() => {
    if (dismissingRef.current || !enterReady || !copy.enterLabel) return;

    dismissingRef.current = true;
    markBootDismissed();
    setDismissed(true);

    const target = resolveBootDismissTargetForClick(pathname, bootStatus);
    if (target !== pathname) {
      window.location.assign(target);
    }
  }, [bootStatus, copy.enterLabel, enterReady, pathname]);

  if (skipBoot || dismissed) {
    return <>{children}</>;
  }

  const bootClass = BOOT_SCREEN.artIncludesBranding ? ' nu-boot--intro-art' : '';

  return (
    <>
      <div
        className={`nu-boot${bootClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nu-boot-heading"
        aria-live="polite"
      >
        <BootBackgroundArt />

        {enterReady && bootStatus === 'authenticated' && <BootLogoutButton />}

        <div className="nu-boot__brand-mark">
          <NuBrandLogo size="lg" priority />
        </div>

        <div className="nu-boot__panel">
          <h2 id="nu-boot-heading" className="nu-boot__sr-only">
            Neon Underworld
          </h2>

          {copy.welcome && <p className="nu-boot__welcome">{copy.welcome}</p>}
          {copy.alias && <p className="nu-boot__alias">{copy.alias}</p>}
          {!copy.welcome && enterReady && bootStatus === 'unauthenticated' && (
            <p className="nu-boot__tagline">Enter the network</p>
          )}

          <p className="nu-boot__status">{copy.status}</p>

          {showEnter && (
            <button type="button" className="nu-boot__enter" onClick={dismissBoot}>
              {copy.enterLabel}
            </button>
          )}
        </div>
      </div>
      <div className="nu-boot-app--pending" aria-hidden="true">
        {children}
      </div>
    </>
  );
}
