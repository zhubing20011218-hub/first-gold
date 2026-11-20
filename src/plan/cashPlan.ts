// 现金计划（docs/06 第三节）：照这个计划，最坏的时候（一单都没卖出去），季末还剩多少钱
import type { Product } from "../engine/product";
import type { GameState, QuarterDecision } from "../engine/types";
import type { Params } from "../engine/util";
import { headHaulFen } from "../engine/stock";
import { upgradeCostFen } from "./reference";

export interface CashPlan {
  startFen: number;
  restockFen: number;
  fixedFen: number;
  complianceFen: number;
  upgradeFen: number;
  /** 预计花掉 */
  sureOutFen: number;
  /** 广告最多花掉多少 */
  adsMaxFen: number;
  /** 这个季度一定会到的钱 */
  sureInFen: number;
  worstEndFen: number;
}

/** 这个季度一定会到的钱：已经签收的货款，和已经交货的大单尾款，在季末之前到账的 */
export function sureInFen(state: GameState): number {
  const q = Math.floor(state.day / 90);
  const last = q * 90 + 89;
  let total = 0;
  for (const b of state.orderBatches) {
    if (b.paid || b.returnedQty === null || b.settleDay === null) continue;
    if (Math.max(b.settleDay, state.payoutFrozenUntilDay) <= last) total += (b.qty - b.returnedQty) * b.payoutFenEach;
  }
  for (const b of state.bulkOrders) {
    if (b.status === "delivered" && b.balanceDay !== null && b.balanceDay <= last) total += b.valueFen - b.depositFen;
  }
  return total;
}

export function cashPlan(state: GameState, d: QuarterDecision, product: Product, params: Params): CashPlan {
  const upgrading = state.fulfillment === "cross" && d.upgradeToLocal;
  const localAfter = state.fulfillment === "local" || upgrading;
  const qty = Math.min(d.monthlyRestockQty, product.supplierMonthlyCap);
  const restockFen = 3 * qty * product.costFen + (localAfter ? 3 * headHaulFen(qty, product, params) : 0);
  const fixedFen = 3 * params.monthlyFixedCostFen.value;
  const complianceFen = localAfter && d.buyCompliance ? params.complianceCostFen.value : 0;
  const upgradeFen = upgrading ? upgradeCostFen(state, product, params) : 0;
  const sureOutFen = restockFen + fixedFen + complianceFen + upgradeFen;
  const adsMaxFen = d.adDailyBudgetFen * 90;
  const inFen = sureInFen(state);
  return {
    startFen: state.cashFen,
    restockFen,
    fixedFen,
    complianceFen,
    upgradeFen,
    sureOutFen,
    adsMaxFen,
    sureInFen: inFen,
    worstEndFen: state.cashFen + inFen - sureOutFen - adsMaxFen,
  };
}
