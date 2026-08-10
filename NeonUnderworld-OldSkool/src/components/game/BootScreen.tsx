'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { BrandedLoader } from './BrandedLoader';

const MIN_DISPLAY_MS = 400;
const EXIT_MS = 280;
const LOGO_SRC = '/images/game-backgrounds/NUPFPLogo.webp';

type BootPhase = 'active' | 'exit' | 'hidden';

/**
 * Full-screen boot on document load (cold open, hard refresh, PWA launch).
 * Lives in root Providers — does not replay on client-side route changes.
 */
export function BootScreen({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [phase, setPhase] = useState<BootPhase>('active');
  const [statusText, setStatusText] = useState('CONNECTING TO THE NETWORK…');
  const startedAt = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const exitScheduled = useRef(false);

  useEffect(() => {
    if (phase === 'hidden' || exitScheduled.current) return;

    if (status === 'loading') {
      setStatusText('CONNECTING TO THE NETWORK…');
      return;
    }

    if (status === 'authenticated') {
      setStatusText('IDENTITY VERIFIED');
    } else {
      setStatusText('LOADING EMPIRE…');
    }

    exitScheduled.current = true;
    const elapsed = performance.now() - startedAt.current;
    const delay = Math.max(0, MIN_DISPLAY_MS - elapsed);

    const readyTimer = window.setTimeout(() => {
      setPhase('exit');
      window.setTimeout(() => setPhase('hidden'), EXIT_MS);
    }, delay);

    return () => window.clearTimeout(readyTimer);
  }, [status, phase]);

  return (
    <>
      {phase !== 'hidden' && (
        <div
          className={`nu-boot${phase === 'exit' ? ' nu-boot--exit' : ''}`}
          role="status"
          aria-live="polite"
          aria-busy={phase === 'active'}
        >
          <div className="nu-boot__inner">
            <div className="nu-boot__logo-wrap">
              <Image
                src={LOGO_SRC}
                alt="Neon Underworld emblem"
                width={120}
                height={120}
                priority
                className="nu-boot__logo"
              />
            </div>
            <h1 className="nu-boot__title">NEON UNDERWORLD</h1>
            <p className="nu-boot__status">{statusText}</p>
            <BrandedLoader size="sm" />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
