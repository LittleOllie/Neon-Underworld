'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  type NuBackgroundKey,
  nuBackgroundSpec,
  nuBackgroundUrl,
  nuBackgroundPosition,
  nuBackgroundShowsOperator,
} from '@local/config/nu-backgrounds';
import { NuOperator } from '@local/components/game/NuOperator';

const loadedUrls = new Set<string>();

type Props = {
  background: NuBackgroundKey;
  /** Override page spec — omit to use nu-backgrounds registration */
  showOperator?: boolean;
  priority?: boolean;
};

/**
 * Gameplay visual stack: environment → atmosphere → operator → readability overlays.
 * Entry screens (intro/auth/boot) use NuBackground instead — intro art includes its own figure.
 */
export function NuScene({ background, showOperator, priority = false }: Props) {
  const spec = nuBackgroundSpec(background);
  const src = nuBackgroundUrl(background);
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(() => loadedUrls.has(src));
  const [failed, setFailed] = useState(false);
  const operatorVisible = nuBackgroundShowsOperator(background, showOperator);

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

  const position = nuBackgroundPosition(background);
  const mobilePosition = nuBackgroundPosition(background, true);

  return (
    <div
      className="nu-scene"
      aria-hidden="true"
      style={{ '--nu-bg-overlay-strength': spec.overlayStrength } as React.CSSProperties}
    >
      {/* Layer 1 — page environment */}
      {!failed && (
        <img
          ref={imgRef}
          className={`nu-scene__env${loaded ? ' is-loaded' : ''}`}
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
      )}

      {/* Layer 2 — optional atmospheric treatment (reserved for future tuning) */}
      <div className="nu-scene__atmosphere" />

      {/* Layer 3 — master Operator (gameplay pages only) */}
      {operatorVisible ? (
        <div className="nu-scene__operator">
          <NuOperator />
        </div>
      ) : null}

      {/* Layer 4 — readability overlays */}
      <div className="nu-scene__overlay" />
      <div className="nu-scene__vignette" />
    </div>
  );
}
