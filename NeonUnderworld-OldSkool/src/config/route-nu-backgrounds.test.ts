import { describe, expect, it } from 'vitest';
import { getNuBackgroundForPath } from '@local/config/route-nu-backgrounds';

describe('route-nu-backgrounds', () => {
  it('maps command to NU command environment', () => {
    expect(getNuBackgroundForPath('/command')).toBe('command');
  });

  it('maps empire to NU empire environment', () => {
    expect(getNuBackgroundForPath('/empire')).toBe('empire');
  });

  it('maps scout to NU scout environment', () => {
    expect(getNuBackgroundForPath('/scout')).toBe('scout');
  });

  it('maps produce (Operations) to NU operations environment', () => {
    expect(getNuBackgroundForPath('/produce')).toBe('operations');
  });

  it('maps shop to NU shop environment', () => {
    expect(getNuBackgroundForPath('/shop')).toBe('shop');
  });

  it('maps market to NU market environment', () => {
    expect(getNuBackgroundForPath('/market')).toBe('market');
  });

  it('maps attack to NU attack environment', () => {
    expect(getNuBackgroundForPath('/attack')).toBe('attack');
  });

  it('maps reports to NU reports environment', () => {
    expect(getNuBackgroundForPath('/reports')).toBe('reports');
    expect(getNuBackgroundForPath('/reports/abc')).toBe('reports');
  });

  it('maps cartels to NU factions environment', () => {
    expect(getNuBackgroundForPath('/cartels')).toBe('factions');
  });

  it('maps businesses to NU businesses environment', () => {
    expect(getNuBackgroundForPath('/businesses')).toBe('businesses');
  });

  it('maps travel to NU travel environment', () => {
    expect(getNuBackgroundForPath('/travel')).toBe('travel');
  });

  it('maps rankings to NU rankings environment', () => {
    expect(getNuBackgroundForPath('/rankings')).toBe('rankings');
  });

  it('maps how-to-play to NU guides environment', () => {
    expect(getNuBackgroundForPath('/how-to-play')).toBe('guides');
  });

  it('maps legacy guides route to NU guides environment', () => {
    expect(getNuBackgroundForPath('/guides')).toBe('guides');
  });

  it('maps settings to NU settings environment', () => {
    expect(getNuBackgroundForPath('/settings')).toBe('settings');
  });

  it('maps identity select to NU identity environment', () => {
    expect(getNuBackgroundForPath('/identity/select')).toBe('identity');
  });

  it('maps player intel profiles to NU intel environment', () => {
    expect(getNuBackgroundForPath('/players/rival-alias')).toBe('intel');
  });

  it('returns undefined for routes still on legacy backgrounds', () => {
    expect(getNuBackgroundForPath('/bank')).toBeUndefined();
  });
});
