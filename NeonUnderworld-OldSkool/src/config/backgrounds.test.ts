import { describe, it, expect } from 'vitest';
import {
  gameBackgroundSrc,
  gameBackgroundSrcPng,
  gameBackgroundPosition,
  gameBackgroundScale,
  gameBackgroundOffsetY,
  gameBackgroundDarkness,
  gameBackgroundUrl,
  GAME_BACKGROUND_DIR,
} from '@local/config/backgrounds';

describe('game backgrounds config', () => {
  it('resolves predictable public paths', () => {
    expect(gameBackgroundSrc('home')).toBe(`${GAME_BACKGROUND_DIR}/home.webp`);
    expect(gameBackgroundSrc('scout')).toBe(`${GAME_BACKGROUND_DIR}/scout.webp`);
  });

  it('defaults object position to center', () => {
    expect(gameBackgroundPosition('empire')).toBe('center center');
    expect(gameBackgroundPosition('home')).toBe('center top');
  });

  it('appends cache-bust revision for replaced images', () => {
    expect(gameBackgroundUrl(`${GAME_BACKGROUND_DIR}/intel.png`, 'intel')).toBe(
      `${GAME_BACKGROUND_DIR}/intel.png?v=2`,
    );
    expect(gameBackgroundUrl(`${GAME_BACKGROUND_DIR}/home.png`, 'home')).toBe(
      `${GAME_BACKGROUND_DIR}/home.png?v=4`,
    );
  });

  it('tunes home background crop', () => {
    expect(gameBackgroundScale('home')).toBe(1.9);
    expect(gameBackgroundOffsetY('home')).toBe('-55%');
  });

  it('maps market key to markets.png filename', () => {
    expect(gameBackgroundSrcPng('market')).toBe(`${GAME_BACKGROUND_DIR}/markets.png`);
  });

  it('resolves travel reserved background path', () => {
    expect(gameBackgroundSrcPng('travel')).toBe(`${GAME_BACKGROUND_DIR}/travel.png`);
  });

  it('resolves cartel reserved background path', () => {
    expect(gameBackgroundSrcPng('cartel')).toBe(`${GAME_BACKGROUND_DIR}/cartel.png`);
  });

  it('defaults overlay darkness to 0', () => {
    expect(gameBackgroundDarkness('scout')).toBe(0);
    expect(gameBackgroundDarkness('home')).toBe(0);
  });
});
