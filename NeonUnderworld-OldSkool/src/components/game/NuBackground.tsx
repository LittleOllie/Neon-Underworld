'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  type NuBackgroundKey,
  nuBackgroundSpec,
  nuBackgroundUrl,
  nuBackgroundPosition,
} from '@local/config/nu-backgrounds';

const loadedUrls = new Set<string>();

type Props = {
  background: NuBackgroundKey;
  /** High priority for above-the-fold entry screens */
  priority?: boolean;
};

export function NuBackground({ background, priority = false }: Props) {
  const spec = nuBackgroundSpec(background);
  const src = nuBackgroundUrl(background);
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(() => loadedUrls.has(src));
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    if (loadedUrls.has(src)) {
      setLoaded(true);
      return;
    }
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      loadedUrls.add(src);
      setLoaded(true);
    }
  }, [src]);

  if (failed) return null;

  const position = nuBackgroundPosition(background);
  const mobilePosition = nuBackgroundPosition(background, true);

  return (
    <div
      className="nu-page-bg"
      aria-hidden="true"
      style={{ '--nu-bg-overlay-strength': spec.overlayStrength } as React.CSSProperties}
    >
      <img
        ref={imgRef}
        className={`nu-page-bg__art${loaded ? ' is-loaded' : ''}`}
        src={src}
        alt=""
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'low'}
        style={
          {
            objectPosition: position,
            ...(mobilePosition !== position
              ? { '--nu-mobile-position': mobilePosition }
              : {}),
          } as React.CSSProperties
        }
        data-mobile-position={mobilePosition !== position ? mobilePosition : undefined}
        onLoad={() => {
          loadedUrls.add(src);
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
      />
      <div className="nu-page-bg__overlay" />
      <div className="nu-page-bg__vignette" />
    </div>
  );
}
