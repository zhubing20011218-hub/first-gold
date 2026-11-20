// 为什么（docs/06 第六节）：最多 3 句，把结果和原因连起来。只输出编号和数字。
import type { GameEvent } from "../engine/events";
import type { Product } from "../engine/product";
import type { GameState } from "../engine/types";
import type { Params } from "../engine/util";
import { quarterOfDay } from "../engine/bills";
import { pricePoints } from "../engine/push";
import { settleOrder } from "../engine/settle";
import { pushTotal } from "./report";

export interface Cause {
  key: string;
  data: Record<string, number>;
}

function payoutEachFen(priceSen: number, state: GameState, product: Product, params: Params): number {
  return settleOrder({ fulfillment: state.fulfillment, priceSen, weightG: product.weightG, region: "west", creatorBp: 0, joinCashback: false }, params).payoutFen;
}

export function quarterCauses(
  q: number,
  events: readonly GameEvent[],
  startState: GameState,
  endState: GameState,
  product: Product,
  params: Params,
): Cause[] {
  const inQ = events.filter((e) => quarterOfDay(e.day, params.quartersPerGame.value) === q);
  const out: Cause[] = [];
  const add = (key: string, data: Record<string, number>): void => {
    if (out.length < 3) out.push({ key, data });
  };
  const sum = <T extends GameEvent["type"]>(type: T, f: (e: Extract<GameEvent, { type: T }>) => number): number =>
    inQ.reduce((s, e) => (e.type === type ? s + f(e as Extract<GameEvent, { type: T }>) : s), 0);

  // 季末现金
  if (endState.cashFen < 0) add("cause_cash_negative", { cashFen: endState.cashFen });
  // 大单违约
  const penalty = sum("bulk_defaulted", (e) => e.penaltyFen);
  if (inQ.some((e) => e.type === "bulk_defaulted")) add("cause_bulk_default", { penaltyFen: penalty });
  // 审核
  if (inQ.some((e) => e.type === "audit_started")) add("cause_audit", { days: params.auditFreezeDays.value });
  // 加急补货
  if (inQ.some((e) => e.type === "rush_ordered")) {
    const qty = sum("rush_ordered", (e) => e.qty);
    const extra = sum("rush_ordered", (e) => (e.unitCostFen - product.costFen) * e.qty);
    add("cause_rush", { qty, extraFen: extra });
  }
  // 缺货
  const wanted = sum("orders_shipped", (e) => e.organicOrders + e.adOrders);
  const lost = sum("orders_shipped", (e) => e.lost);
  if (wanted > 0 && lost * 10000 > wanted * 500) {
    add("cause_stockout", { lost, pts: Math.max(0, startState.pushScore.stock - endState.pushScore.stock) });
  }
  // 留给大单的货
  const bulkQty = sum("bulk_shipped", (e) => e.qty) + endState.bulkOrders.filter((b) => b.status === "won").reduce((s, b) => s + b.qty, 0);
  if (bulkQty > 0 && lost > 0) add("cause_bulk_reserved", { qty: bulkQty });
  // 广告
  const budget = sum("ads_ran", (e) => e.budgetFen);
  const spend = sum("ads_ran", (e) => e.adSpendFen);
  const adOrders = sum("ads_ran", (e) => e.adOrders);
  if (budget > 0 && spend * 10000 < budget * 6000) add("cause_ads_unspent", { pctBp: Math.floor((spend * 10000) / budget) });
  if (adOrders > 0) {
    const perOrderAd = Math.round(spend / adOrders);
    const perOrderFee = endState.fulfillment === "cross" ? params.crossForwarderFeeFen.value : params.localLabelFeeFen.value;
    const profit = payoutEachFen(endState.priceSen, endState, product, params) - product.costFen - perOrderFee;
    if (perOrderAd > profit) add("cause_ads_loss", { costFen: perOrderAd, profitFen: profit });
  }
  // 售价
  const price = endState.priceSen;
  if (price !== product.refPriceSen) {
    const pts = Math.abs(pricePoints(price, product) - pricePoints(product.refPriceSen, product));
    const diff = Math.abs(payoutEachFen(price, endState, product, params) - payoutEachFen(product.refPriceSen, endState, product, params));
    add(price < product.refPriceSen ? "cause_price_low" : "cause_price_high", { pts, diffFen: diff });
  }
  // 压在仓库里的货
  if (endState.fulfillment === "local") {
    const storage = sum("month_started", (e) => e.storageFeeFen);
    const aged = Math.max(0, endState.stockQty - (endState.monthStats.shipped + endState.monthStats.bulkUnits));
    if (storage > 0 && aged > 0) add("cause_storage", { qty: aged, feeFen: storage });
  }
  // 路上的货款
  const pending = endState.orderBatches.filter((b) => !b.paid).reduce((s, b) => s + (b.qty - (b.returnedQty ?? 0)) * b.payoutFenEach, 0);
  if (pending > endState.cashFen) add("cause_cash_wait", { cashFen: endState.cashFen, pendingFen: pending });
  // 推流分
  const push = pushTotal(endState);
  if (push - pushTotal(startState) >= 5) add("cause_push_up", { score: push });
  return out;
}
