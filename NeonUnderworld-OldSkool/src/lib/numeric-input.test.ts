import { describe, it, expect } from 'vitest';
import {
  parsePositiveInteger,
  validateTurnAmount,
  validateQuantity,
  shopPreviewTotal,
  shopInventoryKey,
} from './numeric-input';

describe('parsePositiveInteger', () => {
  it('accepts positive integers', () => {
    expect(parsePositiveInteger('25')).toBe(25);
    expect(parsePositiveInteger('100')).toBe(100);
  });

  it('rejects zero, negative, decimals, and non-numbers', () => {
    expect(parsePositiveInteger('0')).toBeNull();
    expect(parsePositiveInteger('-5')).toBeNull();
    expect(parsePositiveInteger('12.5')).toBeNull();
    expect(parsePositiveInteger('abc')).toBeNull();
    expect(parsePositiveInteger('')).toBeNull();
  });
});

describe('validateTurnAmount', () => {
  it('requires at least 1 turn', () => {
    expect(validateTurnAmount(null, 431)).toBe('Enter at least 1 turn.');
  });

  it('rejects over available turns', () => {
    expect(validateTurnAmount(500, 431)).toBe('You only have 431 turns.');
  });

  it('accepts valid amounts', () => {
    expect(validateTurnAmount(25, 431)).toBeNull();
    expect(validateTurnAmount(100, 431)).toBeNull();
  });
});

describe('validateQuantity', () => {
  it('requires valid quantity', () => {
    expect(validateQuantity(null)).toBe('Enter a valid quantity.');
    expect(validateQuantity(10)).toBeNull();
  });

  it('accepts any positive quantity', () => {
    expect(validateQuantity(5000)).toBeNull();
    expect(validateQuantity(50_000)).toBeNull();
    expect(validateQuantity(1_000_000)).toBeNull();
  });
});

describe('shopPreviewTotal', () => {
  it('multiplies unit price by quantity', () => {
    expect(shopPreviewTotal(3800, 100)).toBe(380_000);
    expect(shopPreviewTotal(500, 1)).toBe(500);
  });
});

describe('shopInventoryKey', () => {
  it('maps catalog keys to inventory fields', () => {
    expect(shopInventoryKey('ak')).toBe('aks');
    expect(shopInventoryKey('shroom')).toBe('shrooms');
    expect(shopInventoryKey('glock')).toBe('glocks');
  });
});
