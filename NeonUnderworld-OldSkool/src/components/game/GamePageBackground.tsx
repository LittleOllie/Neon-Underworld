'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  type GameBackgroundKey,
  gameBackgroundSrc,
  gameBackgroundPosition,
  gameBackgroundScale,
  gameBackgroundOffsetY,
  gameBackgroundDarkness,
  gameBackgroundSrcPng,
  gameBackgroundLegacySrc,
  gameBackgroundUrl,
  GAME_BACKGROUND_REVISION,
} from '@local/config/backgrounds';

type SourceStage = 'png' | 'webp' | 'legacy';

function srcForStage(key: GameBackgroundKey, stage: SourceStage): string | null {
  if (stage === 'webp') return gameBackgroundSrc(key);
  if (stage === 'png') return gameBackgroundSrcPng(key);
  return gameBackgroundLegacySrc(key);
}

function imageAlreadyLoaded(img: HTMLImageElement | null): boolean {
  return Boolean(img?.complete && img.naturalWidth > 0);
}

export function GamePageBackground({ background }: { background: GameBackgroundKey }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [active, setActive] = useState(true);
  const [loaded, setLoaded] = useState(false);
  /** PNG first — project ships PNG; avoids a 404 webp round-trip on every page load */
  const [stage, setStage] = useState<SourceStage>('png');
  const src = srcForStage(background, stage);
  const srcWithCache = src ? gameBackgroundUrl(src, background) : null;

  useLayoutEffect(() => {
    setLoaded(imageAlreadyLoaded(imgRef.current));
  }, [background, stage, srcWithCache]);

  if (!active || !srcWithCache) return null;

  const scale = gameBackgroundScale(background);
  const offsetY = gameBackgroundOffsetY(background);
  const transformParts: string[] = [];
  if (offsetY) transformParts.push(`translateY(${offsetY})`);
  if (scale !== 1) transformParts.push(`scale(${scale})`);
  const transform = transformParts.length > 0 ? transformParts.join(' ') : undefined;

  function handleError() {
    if (stage === 'png') {
      setStage('webp');
      setLoaded(false);
      return;
    }
    if (stage === 'webp') {
      const legacy = gameBackgroundLegacySrc(background);
      if (legacy) {
        setStage('legacy');
        setLoaded(false);
        return;
      }
    }
    setActive(false);
  }

  return (
    <div
      className="g-page-bg"
      aria-hidden="true"
      style={{ '--page-bg-darkness': gameBackgroundDarkness(background) } as React.CSSProperties}
    >
      <img
        ref={imgRef}
        key={`${background}-${stage}-${GAME_BACKGROUND_REVISION[background] ?? 1}`}
        className={`g-page-bg-art${loaded ? ' is-loaded' : ''}`}
        src={srcWithCache}
        alt=""
        decoding="async"
        fetchPriority="high"
        style={{
          objectPosition: gameBackgroundPosition(background),
          transform,
          transformOrigin: gameBackgroundPosition(background),
        }}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
      <div className="g-page-bg-overlay" />
      <div className="g-page-bg-vignette" />
    </div>
  );
}
