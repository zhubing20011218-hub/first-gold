// 开局第一批进货（docs/09 第五节）：范围、默认值、花多少
import type { Product } from "../engine/product";
import type { Fulfillment } from "../engine/types";
import type { Params } from "../engine/util";
import { affordableQty, restockCostFen } from "../engine/stock";

/** 最大件数：供应商月上限和买得起的最大件数里小的那个 */
export function maxFirstStock(cashFen: number, f: Fulfillment, product: Product, params: Params): number {
  const setup = f === "local" ? params.localSetupFeeFen.value : 0;
  return Math.min(product.supplierMonthlyCap, affordableQty(cashFen - setup, f, product, params));
}

/** 默认值：最大件数（已经按供应商上限截过）的一半，按 10 件向下取整，不低于起订量（docs/09 第五节，第 10 版） */
export function defaultFirstStock(cashFen: number, f: Fulfillment, product: Product, params: Params): number {
  return Math.max(product.moq, Math.floor(maxFirstStock(cashFen, f, product, params) / 2 / 10) * 10);
}

export interface FirstStockCost {
  setupFen: number;
  costFen: number;
  leftFen: number;
}

export function firstStockCost(cashFen: number, qty: number, f: Fulfillment, product: Product, params: Params): FirstStockCost {
  const setupFen = f === "local" ? params.localSetupFeeFen.value : 0;
  const costFen = restockCostFen(qty, f, product, params).totalFen;
  return { setupFen, costFen, leftFen: cashFen - setupFen - costFen };
}

/** 开局给三张卡：走量型、利润型、高风险型各一种（docs/05），按种子挑 */
export function setupCards<T extends { kind: string }>(seed: number, all: readonly T[]): T[] {
  return (["volume", "margin", "risky"] as const).map((k, i) => {
    const list = all.filter((p) => p.kind === k);
    return list[((seed >>> 0) >>> i) % list.length];
  });
}
