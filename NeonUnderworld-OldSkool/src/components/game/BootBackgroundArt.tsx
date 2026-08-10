'use client';

import { useState } from 'react';
import {
  bootBackgroundUrl,
  bootPhoneBackgroundUrl,
  bootPhoneMediaQuery,
} from '@local/config/boot-screen';

/** Responsive NUIntro artwork — portrait on phone, landscape on desktop. */
export function BootBackgroundArt() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="nu-boot__art" aria-hidden="true">
      <picture>
        <source
          media={bootPhoneMediaQuery()}
          srcSet={bootPhoneBackgroundUrl()}
          type="image/webp"
        />
        <img
          src={bootBackgroundUrl()}
          alt=""
          className="nu-boot__art-img"
          fetchPriority="high"
          decoding="async"
          onError={() => setVisible(false)}
        />
      </picture>
      <div className="nu-boot__art-scrim" />
    </div>
  );
}
