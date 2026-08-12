import { describe, it, expect } from 'vitest';
import {
  MARKET_RULES,
  isMarketTradableItem,
  marketFilterCategory,
  marketItemDisplayName,
  minimumNextBid,
  suggestedMarketOpeningBid,
  marketReferenceUnitPrice,
} from '@/config/game/market-rules';

describe('market rules', () => {
  it('allows shop inventory and personnel', () => {
    expect(isMarketTradableItem('ak')).toBe(true);
    expect(isMarketTradableItem('ride')).toBe(true);
    expect(isMarketTradableItem('beer')).toBe(true);
    expect(isMarketTradableItem('whore')).toBe(true);
    expect(isMarketTradableItem('thug')).toBe(true);
    expect(isMarketTradableItem('cash')).toBe(false);
  });

  it('classifies personnel filter category', () => {
    expect(marketFilterCategory('whore')).toBe('personnel');
    expect(marketFilterCategory('thug')).toBe('personnel');
    expect(marketItemDisplayName('whore')).toBe('Worker');
  });

  it('enforces minimum starting price', () => {
    expect(MARKET_RULES.minStartingPrice).toBeGreaterThanOrEqual(10);
  });

  it('first bid equals starting price', () => {
    expect(minimumNextBid(null, 10_000)).toBe(10_000);
  });

  it('subsequent bids require 20% increment', () => {
    expect(minimumNextBid(10_000, 10_000)).toBe(12_000);
    expect(minimumNextBid(12_500, 10_000)).toBe(15_000);
  });

  it('allows standard auction durations', () => {
    expect(MARKET_RULES.allowedDurationMinutes).toEqual([30, 60, 180, 360, 720, 1440]);
    expect(MARKET_RULES.minDurationMinutes).toBe(30);
  });

  it('suggests opening bid from reference unit value', () => {
    expect(suggestedMarketOpeningBid('whore', 318)).toBe(1750 * 318);
    expect(suggestedMarketOpeningBid('ak', 5)).toBe(3240 * 5);
    expect(marketReferenceUnitPrice('whore')).toBe(1750);
  });

  it('market is global', () => {
    expect(MARKET_RULES.global).toBe(true);
  });
});
