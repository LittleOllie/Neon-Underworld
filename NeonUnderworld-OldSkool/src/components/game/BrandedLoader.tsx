'use client';

import Image from 'next/image';
import { BOOT_SCREEN } from '@local/config/boot-screen';

const LOGO_PX = { sm: 36, md: 52, lg: 72 } as const;

/** Branded loader — rounded NUPFP logo with subtle pulse; respects reduced motion. */
export function BrandedLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const px = LOGO_PX[size];

  return (
    <div
      className={`nu-loader nu-loader--${size}`}
      role="img"
      aria-label="Loading"
    >
      <span className="nu-loader__logo" aria-hidden="true">
        <Image
          src={BOOT_SCREEN.logoSrc}
          alt=""
          width={px}
          height={px}
          className="nu-loader__logo-img"
          priority
        />
      </span>
    </div>
  );
}
