import { CITY_SHOP_SELL_BACK_RATIO } from './shop-rules';

/** Canonical cash price per Thug hired through the Shop crew service. */
export const THUG_HIRE_PRICE = 7500;

/** Cash per Thug released through Shop crew — 70% of hire price (same as other shop sell-backs). */
export const THUG_SELL_PRICE = Math.max(1, Math.floor(THUG_HIRE_PRICE * CITY_SHOP_SELL_BACK_RATIO));

export function hireThugsTotalCost(quantity: number): number {
  return quantity * THUG_HIRE_PRICE;
}

export function sellThugsTotalPayout(quantity: number): number {
  return quantity * THUG_SELL_PRICE;
}
