// 净资产、风险等级、带到下个季度的东西（docs/04 第八节、第十一节、第十七节）
import { inTransitBatches, reservedQty } from "./game";
import { applyBp } from "./money";
import type { Product } from "./product";
import type { BulkOrder, GameState, RestockBatch } from "./types";
import type { Params } from "./util";

export type RiskLevel = "low" | "mid" | "high";

export function riskLevel(riskPts: number, params: Params): RiskLevel {
  if (riskPts < params.riskMidPts.value) return "low";
  if (riskPts < params.riskHighPts.value) return "mid";
  return "high";
}

/** 净资产：现金加上剩下的库存按进价打折（库存按没有折扣的进价算） */
export function netWorthFen(state: GameState, product: Product, params: Params): number {
  return state.cashFen + applyBp(state.stockQty * product.costFen, params.stockSalvageBp.value);
}

export interface CarryOver {
  /** 路上的货款 */
  payoutInTransit: { batches: number; amountFen: number; frozenUntilDay: number | null };
  /** 没结清的大单 */
  openBulks: BulkOrder[];
  /** 路上的补货 */
  restockInTransit: RestockBatch[];
  /** 留给大单的货 */
  reservedQty: number;
}

export function carryOver(state: GameState): CarryOver {
  const unpaid = state.orderBatches.filter((b) => !b.paid);
  return {
    payoutInTransit: {
      batches: unpaid.length,
      amountFen: unpaid.reduce((sum, b) => sum + (b.qty - (b.returnedQty ?? 0)) * b.payoutFenEach, 0),
      frozenUntilDay: state.payoutFrozenUntilDay > state.day ? state.payoutFrozenUntilDay : null,
    },
    openBulks: state.bulkOrders.filter((b) => b.status === "won" || b.status === "shipped" || b.status === "delivered"),
    restockInTransit: inTransitBatches(state),
    reservedQty: reservedQty(state),
  };
}
