import { describe, it, expect } from 'vitest';
import { getCityShopItem } from '@core/config/game/shop-rules';
import { OS_TERMS } from '@local/config/terminology';
import { parseWireCommand } from './command-parser';
import {
  resolveShopItemFromPhrase,
  isWorkerPurchaseTerm,
} from './item-aliases';
import { parseDigitQuantity, parseSpokenNumberPhrase } from './parse-quantity';
import { resolveWireRoute } from './route-map';

describe('parseWireCommand — navigation', () => {
  it('parses open shop', () => {
    expect(parseWireCommand('open shop')).toEqual({ kind: 'NAV', href: '/shop' });
  });

  it('parses go to empire', () => {
    expect(parseWireCommand('go to empire')).toEqual({ kind: 'NAV', href: '/empire' });
  });

  it('parses show rankings', () => {
    expect(parseWireCommand('show rankings')).toEqual({ kind: 'NAV', href: '/rankings' });
  });

  it('parses take me to shop', () => {
    expect(parseWireCommand('take me to shop')).toEqual({ kind: 'NAV', href: '/shop' });
  });
});

describe('parseWireCommand — stats', () => {
  it("parses what's my cash", () => {
    expect(parseWireCommand("what's my cash")).toEqual({ kind: 'STAT', stat: 'cash' });
  });

  it('parses net worth query', () => {
    expect(parseWireCommand('what is my net worth')).toEqual({ kind: 'STAT', stat: 'netWorth' });
  });

  it("parses what's my rank", () => {
    expect(parseWireCommand("what's my rank")).toEqual({ kind: 'STAT', stat: 'rank' });
  });

  it('parses turns query', () => {
    expect(parseWireCommand('how many turns do I have')).toEqual({ kind: 'STAT', stat: 'turns' });
  });
});

describe('parseWireCommand — buy', () => {
  it('parses buy 500 aks', () => {
    expect(parseWireCommand('buy 500 aks')).toEqual({
      kind: 'BUY',
      itemKey: 'ak',
      mode: 'fixed',
      quantity: 500,
    });
  });

  it('parses buy 10,000 beer', () => {
    expect(parseWireCommand('buy 10,000 beer')).toEqual({
      kind: 'BUY',
      itemKey: 'beer',
      mode: 'fixed',
      quantity: 10000,
    });
  });

  it('parses buy ten thousand beer', () => {
    expect(parseWireCommand('buy ten thousand beer')).toEqual({
      kind: 'BUY',
      itemKey: 'beer',
      mode: 'fixed',
      quantity: 10000,
    });
  });

  it('parses buy five hundred AKs', () => {
    expect(parseWireCommand('buy five hundred AKs')).toEqual({
      kind: 'BUY',
      itemKey: 'ak',
      mode: 'fixed',
      quantity: 500,
    });
  });

  it('parses buy max aks', () => {
    expect(parseWireCommand('buy max aks')).toEqual({ kind: 'BUY', itemKey: 'ak', mode: 'max' });
  });

  it('parses buy maximum aks', () => {
    expect(parseWireCommand('buy maximum aks')).toEqual({ kind: 'BUY', itemKey: 'ak', mode: 'max' });
  });

  it('parses buy max beer', () => {
    expect(parseWireCommand('buy max beer')).toEqual({ kind: 'BUY', itemKey: 'beer', mode: 'max' });
  });
});

describe('parseWireCommand — hire thugs', () => {
  it('parses buy 100 thugs as HIRE_THUGS', () => {
    expect(parseWireCommand('buy 100 thugs')).toEqual({
      kind: 'HIRE_THUGS',
      mode: 'fixed',
      quantity: 100,
    });
  });

  it('parses hire 100 thugs', () => {
    expect(parseWireCommand('hire 100 thugs')).toEqual({
      kind: 'HIRE_THUGS',
      mode: 'fixed',
      quantity: 100,
    });
  });

  it('parses hire maximum thugs', () => {
    expect(parseWireCommand('hire maximum thugs')).toEqual({ kind: 'HIRE_THUGS', mode: 'max' });
  });
});

describe('parseWireCommand — rejections', () => {
  it('rejects malformed quantity', () => {
    const result = parseWireCommand('buy zero beer');
    expect(result.kind).toBe('UNKNOWN');
  });

  it('rejects unknown item', () => {
    const result = parseWireCommand('buy 10 lasers');
    expect(result).toEqual({ kind: 'UNKNOWN', reason: 'Unknown shop item: lasers' });
  });

  it('rejects unknown command', () => {
    const result = parseWireCommand('teleport to mars');
    expect(result.kind).toBe('UNKNOWN');
  });

  it('rejects worker purchases', () => {
    const result = parseWireCommand('buy 100 workers');
    expect(result).toEqual({
      kind: 'UNKNOWN',
      reason: `${OS_TERMS.specialists} cannot be purchased from the City Shop. Use Scout to recruit personnel.`,
    });
  });
});

describe('shop item aliases', () => {
  it('resolves AK aliases', () => {
    expect(resolveShopItemFromPhrase('ak')).toBe('ak');
    expect(resolveShopItemFromPhrase('aks')).toBe('ak');
    expect(resolveShopItemFromPhrase('ak47')).toBe('ak');
    expect(resolveShopItemFromPhrase('ak-47')).toBe('ak');
    expect(resolveShopItemFromPhrase('AK-47')).toBe('ak');
  });

  it('resolves ride and car aliases', () => {
    expect(resolveShopItemFromPhrase('ride')).toBe('ride');
    expect(resolveShopItemFromPhrase('car')).toBe('ride');
    expect(resolveShopItemFromPhrase('vehicles')).toBe('ride');
  });

  it('resolves drug aliases', () => {
    expect(resolveShopItemFromPhrase('shroom')).toBe('shroom');
    expect(resolveShopItemFromPhrase('mushrooms')).toBe('shroom');
    expect(resolveShopItemFromPhrase('cocaine')).toBe('coke');
    expect(resolveShopItemFromPhrase('heroin')).toBe('heroin');
  });

  it('uses canonical display names from CITY_SHOP_ITEMS', () => {
    expect(resolveShopItemFromPhrase('Assault Rifle')).toBe('ak');
    expect(resolveShopItemFromPhrase('Kits')).toBe('condom');
  });

  it('flags worker terms', () => {
    expect(isWorkerPurchaseTerm('workers')).toBe(true);
    expect(isWorkerPurchaseTerm('specialists')).toBe(true);
  });
});

describe('quantity parsing', () => {
  it('parses comma-separated digits', () => {
    expect(parseDigitQuantity('10,000')).toBe(10000);
    expect(parseDigitQuantity('1,000')).toBe(1000);
  });

  it('parses spoken numbers', () => {
    expect(parseSpokenNumberPhrase('one')).toBe(1);
    expect(parseSpokenNumberPhrase('ten')).toBe(10);
    expect(parseSpokenNumberPhrase('five hundred')).toBe(500);
    expect(parseSpokenNumberPhrase('one thousand')).toBe(1000);
    expect(parseSpokenNumberPhrase('ten thousand')).toBe(10000);
    expect(parseSpokenNumberPhrase('fifty thousand')).toBe(50000);
    expect(parseSpokenNumberPhrase('one hundred thousand')).toBe(100000);
    expect(parseSpokenNumberPhrase('one million')).toBe(1000000);
  });

  it('rejects zero and invalid spoken numbers', () => {
    expect(parseSpokenNumberPhrase('zero')).toBeNull();
    expect(parseSpokenNumberPhrase('banana')).toBeNull();
  });
});

describe('route map', () => {
  it('includes major game routes from navigation config', () => {
    expect(resolveWireRoute('shop')).toBe('/shop');
    expect(resolveWireRoute('settings')).toBe('/settings');
    expect(resolveWireRoute('cartels')).toBe('/cartels');
    expect(resolveWireRoute('home')).toBe('/command');
  });
});

describe('buy preview uses canonical shop prices', () => {
  it('AK unit price comes from CITY_SHOP_ITEMS', () => {
    const ak = getCityShopItem('ak');
    expect(ak?.shopPrice).toBe(3800);
  });
});
