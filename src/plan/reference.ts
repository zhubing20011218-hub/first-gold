// 参考数字（docs/06 第二节）。它们是事实和简单的估算，不是建议。
import type { Product } from "../engine/product";
import type { GameState } from "../engine/types";
import type { Params } from "../engine/util";
import { applyBp } from "../engine/money";
import { marketOfDay } from "../engine/market";
import { reservedQty } from "../engine/game";
import { headHaulFen } from "../engine/stock";

export function seasonNowBp(q: number, product: Product, params: Params): number {
  return applyBp(product.seasonBp[q % 4], q < 4 ? 10000 : params.year2DemandBp.value);
}

function quarterOf(state: GameState): number {
  return Math.floor(state.day / 90);
}

/** 按上个季度和季节估算，这个季度每个月大约来多少零售订单 */
export function expectedMonthly(state: GameState, product: Product, params: Params): number {
  const q = quarterOf(state);
  if (q === 0) return Math.floor((Math.floor((product.organicPerDayMilli * 30) / 1000) * seasonNowBp(0, product, params)) / 10000);
  return Math.floor((Math.floor(state.quarterStats.wanted / 3) * seasonNowBp(q, product, params)) / seasonNowBp(q - 1, product, params));
}

export function upgradeCostFen(state: GameState, product: Product, params: Params): number {
  return params.localSetupFeeFen.value + headHaulFen(state.stockQty, product, params);
}

export interface ReferenceNumbers {
  expMonthly: number;
  stockDays: number;
  /** 上个季度平均每月来了多少单；第 0 个季度是 null */
  lastMonthlyWanted: number | null;
  tierQty: [number, number];
  refPriceSen: number;
  refBidFen: number;
  bulkRefPriceSen: number;
  upgradeCostFen: number;
}

export function referenceNumbers(state: GameState, product: Product, params: Params): ReferenceNumbers {
  const q = quarterOf(state);
  const exp = expectedMonthly(state, product, params);
  return {
    expMonthly: exp,
    stockDays: exp === 0 ? 0 : Math.floor((Math.max(0, state.stockQty - reservedQty(state)) * 30) / exp),
    lastMonthlyWanted: q === 0 ? null : Math.floor(state.quarterStats.wanted / 3),
    tierQty: [product.moq * params.buyTier1Multiple.value, product.moq * params.buyTier2Multiple.value],
    refPriceSen: product.refPriceSen,
    refBidFen: marketOfDay(state.config.seed, q * 90, product, params).refBidFen,
    bulkRefPriceSen: product.bulkRefPriceSen,
    upgradeCostFen: upgradeCostFen(state, product, params),
  };
}
