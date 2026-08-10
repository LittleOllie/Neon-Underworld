import {
  HOME_SHOP_DRUGS,
  getHomeShopSellPrice,
  type HomeShopDrugKey,
} from '@core/config/game/shop-rules';
import type { CanonicalPlayerContext } from '@local/server/services/player.service';

export type { HomeShopDrugKey };

export interface HomeShopDrugEntry {
  key: HomeShopDrugKey;
  displayName: string;
  owned: number;
  unitPrice: number;
}

export interface HomeShopPageData {
  cash: number;
  drugs: HomeShopDrugEntry[];
}

export function getHomeShopPageDataFromContext(ctx: CanonicalPlayerContext): HomeShopPageData {
  return {
    cash: ctx.cash,
    drugs: HOME_SHOP_DRUGS.map((drug) => ({
      key: drug.key,
      displayName: drug.displayName,
      owned: ctx[drug.field],
      unitPrice: getHomeShopSellPrice(drug.key),
    })),
  };
}
