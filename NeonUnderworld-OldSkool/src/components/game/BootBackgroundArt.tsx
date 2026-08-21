'use client';

import { useState } from 'react';
import { nuBackgroundUrl, nuBackgroundPosition } from '@local/config/nu-backgrounds';

/** Approved NU intro artwork — single responsive source, config-driven focal point. */
export function BootBackgroundArt() {
  const [visible, setVisible] = useState(true);
  const position = nuBackgroundPosition('intro');
  const mobilePosition = nuBackgroundPosition('intro', true);

  if (!visible) return null;

  return (
    <div className="nu-boot__art" aria-hidden="true">
      <img
        src={nuBackgroundUrl('intro')}
        alt=""
        className="nu-boot__art-img"
        fetchPriority="high"
        decoding="async"
        style={
          {
            objectPosition: position,
            ...(mobilePosition !== position
              ? { '--nu-mobile-position': mobilePosition }
              : {}),
          } as React.CSSProperties
        }
        data-mobile-position={mobilePosition !== position ? mobilePosition : undefined}
        onError={() => setVisible(false)}
      />
      <div className="nu-boot__art-scrim" />
    </div>
  );
}
