import { describe, expect, it } from 'vitest';
import {
  nuBackgroundSrc,
  nuBackgroundUrl,
  nuBackgroundPosition,
  nuBackgroundShowsOperator,
  NU_BACKGROUNDS,
} from '@local/config/nu-backgrounds';

describe('nu-backgrounds', () => {
  it('maps intro to dedicated NU asset path', () => {
    expect(nuBackgroundSrc('intro')).toBe('/images/nu/backgrounds/intro.webp');
    expect(nuBackgroundUrl('intro')).toBe('/images/nu/backgrounds/intro.webp?v=2');
  });

  it('aligns intro focal point with logo over silhouette', () => {
    expect(nuBackgroundPosition('intro')).toBe('47% center');
    expect(nuBackgroundPosition('intro', true)).toBe('51% center');
    expect(NU_BACKGROUNDS.intro.position).toBe('47% center');
  });

  it('never shows operator on intro', () => {
    expect(nuBackgroundShowsOperator('intro')).toBe(false);
    expect(nuBackgroundShowsOperator('intro', true)).toBe(false);
  });

  it('maps command environment without operator overlay', () => {
    expect(nuBackgroundSrc('command')).toBe('/images/nu/backgrounds/command.webp');
    expect(nuBackgroundUrl('command')).toBe('/images/nu/backgrounds/command.webp?v=3');
    expect(nuBackgroundShowsOperator('command')).toBe(false);
    expect(NU_BACKGROUNDS.command.position).toBe('center center');
  });

  it('maps empire environment without operator overlay', () => {
    expect(nuBackgroundSrc('empire')).toBe('/images/nu/backgrounds/empire.webp');
    expect(nuBackgroundUrl('empire')).toBe('/images/nu/backgrounds/empire.webp?v=3');
    expect(nuBackgroundShowsOperator('empire')).toBe(false);
    expect(NU_BACKGROUNDS.empire.position).toBe('center center');
  });

  it('maps scout environment without operator overlay', () => {
    expect(nuBackgroundSrc('scout')).toBe('/images/nu/backgrounds/scout.webp');
    expect(nuBackgroundUrl('scout')).toBe('/images/nu/backgrounds/scout.webp?v=2');
    expect(nuBackgroundShowsOperator('scout')).toBe(false);
    expect(NU_BACKGROUNDS.scout.position).toBe('center center');
  });

  it('maps operations environment without operator overlay', () => {
    expect(nuBackgroundSrc('operations')).toBe('/images/nu/backgrounds/operations.webp');
    expect(nuBackgroundUrl('operations')).toBe('/images/nu/backgrounds/operations.webp?v=2');
    expect(nuBackgroundShowsOperator('operations')).toBe(false);
    expect(NU_BACKGROUNDS.operations.position).toBe('center center');
  });

  it('maps shop environment without operator overlay', () => {
    expect(nuBackgroundSrc('shop')).toBe('/images/nu/backgrounds/shop.webp');
    expect(nuBackgroundUrl('shop')).toBe('/images/nu/backgrounds/shop.webp?v=2');
    expect(nuBackgroundShowsOperator('shop')).toBe(false);
    expect(NU_BACKGROUNDS.shop.position).toBe('center center');
  });

  it('maps market environment without operator overlay', () => {
    expect(nuBackgroundSrc('market')).toBe('/images/nu/backgrounds/market.webp');
    expect(nuBackgroundUrl('market')).toBe('/images/nu/backgrounds/market.webp?v=2');
    expect(nuBackgroundShowsOperator('market')).toBe(false);
    expect(NU_BACKGROUNDS.market.position).toBe('center center');
  });

  it('maps attack environment without operator overlay', () => {
    expect(nuBackgroundSrc('attack')).toBe('/images/nu/backgrounds/attack.webp');
    expect(nuBackgroundUrl('attack')).toBe('/images/nu/backgrounds/attack.webp?v=2');
    expect(nuBackgroundShowsOperator('attack')).toBe(false);
    expect(NU_BACKGROUNDS.attack.position).toBe('center center');
  });

  it('maps intel environment without operator overlay', () => {
    expect(nuBackgroundSrc('intel')).toBe('/images/nu/backgrounds/intel.webp');
    expect(nuBackgroundUrl('intel')).toBe('/images/nu/backgrounds/intel.webp?v=2');
    expect(nuBackgroundShowsOperator('intel')).toBe(false);
    expect(NU_BACKGROUNDS.intel.position).toBe('center center');
  });

  it('maps reports environment without operator overlay', () => {
    expect(nuBackgroundSrc('reports')).toBe('/images/nu/backgrounds/reports.webp');
    expect(nuBackgroundUrl('reports')).toBe('/images/nu/backgrounds/reports.webp?v=2');
    expect(nuBackgroundShowsOperator('reports')).toBe(false);
    expect(NU_BACKGROUNDS.reports.position).toBe('center center');
  });

  it('maps factions environment without operator overlay', () => {
    expect(nuBackgroundSrc('factions')).toBe('/images/nu/backgrounds/factions.webp');
    expect(nuBackgroundUrl('factions')).toBe('/images/nu/backgrounds/factions.webp?v=2');
    expect(nuBackgroundShowsOperator('factions')).toBe(false);
    expect(NU_BACKGROUNDS.factions.position).toBe('center center');
  });

  it('maps businesses environment without operator overlay', () => {
    expect(nuBackgroundSrc('businesses')).toBe('/images/nu/backgrounds/businesses.webp');
    expect(nuBackgroundUrl('businesses')).toBe('/images/nu/backgrounds/businesses.webp?v=2');
    expect(nuBackgroundShowsOperator('businesses')).toBe(false);
    expect(NU_BACKGROUNDS.businesses.position).toBe('center center');
  });

  it('maps travel environment without operator overlay', () => {
    expect(nuBackgroundSrc('travel')).toBe('/images/nu/backgrounds/travel.webp');
    expect(nuBackgroundUrl('travel')).toBe('/images/nu/backgrounds/travel.webp?v=2');
    expect(nuBackgroundShowsOperator('travel')).toBe(false);
    expect(NU_BACKGROUNDS.travel.position).toBe('center center');
  });

  it('maps rankings environment without operator overlay', () => {
    expect(nuBackgroundSrc('rankings')).toBe('/images/nu/backgrounds/rankings.webp');
    expect(nuBackgroundUrl('rankings')).toBe('/images/nu/backgrounds/rankings.webp?v=2');
    expect(nuBackgroundShowsOperator('rankings')).toBe(false);
    expect(NU_BACKGROUNDS.rankings.position).toBe('center center');
  });

  it('maps guides environment without operator overlay', () => {
    expect(nuBackgroundSrc('guides')).toBe('/images/nu/backgrounds/guides.webp');
    expect(nuBackgroundUrl('guides')).toBe('/images/nu/backgrounds/guides.webp?v=2');
    expect(nuBackgroundShowsOperator('guides')).toBe(false);
    expect(NU_BACKGROUNDS.guides.position).toBe('center center');
  });

  it('maps settings environment without operator overlay', () => {
    expect(nuBackgroundSrc('settings')).toBe('/images/nu/backgrounds/settings.webp');
    expect(nuBackgroundUrl('settings')).toBe('/images/nu/backgrounds/settings.webp?v=2');
    expect(nuBackgroundShowsOperator('settings')).toBe(false);
    expect(NU_BACKGROUNDS.settings.position).toBe('center center');
  });

  it('maps identity environment without operator overlay', () => {
    expect(nuBackgroundSrc('identity')).toBe('/images/nu/backgrounds/identity.webp');
    expect(nuBackgroundUrl('identity')).toBe('/images/nu/backgrounds/identity.webp?v=1');
    expect(nuBackgroundShowsOperator('identity')).toBe(false);
    expect(NU_BACKGROUNDS.identity.position).toBe('center center');
  });
});
