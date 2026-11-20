// 推流分（docs/04 第五节）
import type { Fulfillment } from "./game";
import type { Product } from "./product";
import { clamp, type Params } from "./util";

export interface MonthStats {
  /** 这个月来了多少零售订单（含没货发不出的） */
  wanted: number;
  shipped: number;
  /** 没货发不出多少 */
  lost: number;
  /** 签收多少（含退货的） */
  delivered: number;
  returned: number;
  /** 这个月有没有遇到运输延误 */
  delayed: boolean;
  /** 这个月大单发出多少件（只用来算仓储费） */
  bulkUnits: number;
}

export interface PushScore {
  sales: number;
  stock: number;
  price: number;
  complete: number;
  speed: number;
}

export interface PushResult extends PushScore {
  total: number;
  pushBp: number;
}

export function emptyMonthStats(): MonthStats {
  return { wanted: 0, shipped: 0, lost: 0, delivered: 0, returned: 0, delayed: false, bulkUnits: 0 };
}

/** 价格那一项，跟着当前售价变 */
export function pricePoints(priceSen: number, product: Product): number {
  return clamp(12 - Math.round(((priceSen - product.refPriceSen) * 40) / product.refPriceSen), 0, 20);
}

export function pushBpOf(score: PushScore, params: Params): PushResult {
  const total = score.sales + score.stock + score.price + score.complete + score.speed;
  return { ...score, total, pushBp: params.pushBaseBp.value + total * params.pushPerPointBp.value };
}

export function computePushScore(
  monthStats: MonthStats,
  hasData: boolean,
  priceSen: number,
  fulfillment: Fulfillment,
  product: Product,
  params: Params,
): PushResult {
  const { shipped, wanted, lost, delivered, returned, delayed } = monthStats;

  let sales: number;
  if (hasData) {
    const benchmark = Math.floor((product.organicPerDayMilli * 30) / 1000);
    const ratioBp = Math.floor((shipped * 10000) / benchmark);
    sales = clamp(Math.floor(ratioBp / 1000), 0, 20);
  } else {
    sales = params.newShopSalesPts.value;
  }

  let stock = 20;
  if (hasData && wanted > 0) {
    const lostBp = Math.floor((lost * 10000) / wanted);
    stock = clamp(20 - Math.floor((lostBp - 200) / 100), 0, 20);
  }

  const price = pricePoints(priceSen, product);

  let complete: number;
  if (hasData && delivered > 0) {
    const retBp = Math.floor((returned * 10000) / delivered);
    complete = clamp(20 - Math.floor(retBp / 100), 0, 20);
  } else {
    complete = clamp(20 - Math.floor(product.returnBp / 100), 0, 20);
  }

  const base = fulfillment === "local" ? params.speedLocalPts.value : params.speedCrossPts.value;
  const speed = hasData && delayed ? Math.max(0, base - params.speedDelayPenaltyPts.value) : base;

  return pushBpOf({ sales, stock, price, complete, speed }, params);
}
