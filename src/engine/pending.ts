// 季度中间的决定：大单的货不够（docs/04 第十六节）
import type { GameEvent } from "./events";
import { nextRestockId, type StepResult } from "./game";
import type { Product } from "./product";
import { rushOrder } from "./stock";
import type { BulkOrder, GameState, MidChoice } from "./types";
import type { Params } from "./util";

/** 预计到发货那天能有多少件给这张大单用 */
export function projectedQtyFor(state: GameState, bulk: BulkOrder, product: Product, params: Params): number {
  const day = state.day;
  // 还没到货、并且在发货那天之前到的补货
  const arrivals = state.restockBatches
    .filter((b) => b.arriveDay >= day && b.arriveDay <= bulk.shipDay)
    .reduce((sum, b) => sum + b.qty, 0);
  const lead =
    state.fulfillment === "cross"
      ? params.supplierLeadDays.value
      : params.supplierLeadDays.value + params.headHaulDays.value;
  const lastDay = params.quartersPerGame.value * 90 - 1;
  let futureMonths = 0;
  for (let d = Math.ceil(day / 30) * 30; d <= lastDay; d += 30) {
    if (d + lead <= bulk.shipDay) futureMonths++;
  }
  const futureQty = futureMonths * Math.min(state.monthlyRestockQty, product.supplierMonthlyCap);
  // 其他 won 的大单里，发货更早（或同一天但排在前面）的
  const idx = state.bulkOrders.indexOf(bulk);
  const earlier = state.bulkOrders
    .filter(
      (b, i) =>
        b !== bulk &&
        b.status === "won" &&
        (b.shipDay < bulk.shipDay || (b.shipDay === bulk.shipDay && i < idx)),
    )
    .reduce((sum, b) => sum + b.qty, 0);
  return state.stockQty + arrivals + futureQty - earlier;
}

/**
 * stepDay 的第 0 步。返回 null 表示没有要玩家选的，可以接着算；
 * 否则返回停下来的状态（day 不变）和事件。
 */
export function checkBulkStock(
  state: GameState,
  product: Product,
  params: Params,
): { state: GameState; events: GameEvent[]; paused: boolean } {
  const events: GameEvent[] = [];
  let s = state;
  for (const bulk of state.bulkOrders) {
    if (bulk.status !== "won" || bulk.warnDay !== state.day || bulk.inquiryId in s.midChoices) continue;
    const projected = projectedQtyFor(s, bulk, product, params);
    if (projected >= bulk.qty) {
      s = { ...s, midChoices: { ...s.midChoices, [bulk.inquiryId]: "none" } };
      events.push({ type: "bulk_on_track", day: state.day, inquiryId: bulk.inquiryId, projectedQty: projected });
    } else {
      const shortQty = bulk.qty - projected;
      s = { ...s, pending: { kind: "bulk_short", inquiryId: bulk.inquiryId, shortQty } };
      events.push({ type: "bulk_short", day: state.day, inquiryId: bulk.inquiryId, shortQty });
      return { state: s, events, paused: true };
    }
  }
  return { state: s, events, paused: false };
}

/** 玩家选了之后（docs/04 第十六节） */
export function answerPending(state: GameState, choice: MidChoice, product: Product, params: Params): StepResult {
  const pending = state.pending;
  if (pending === null) throw new Error("answerPending called without a pending choice");
  if (choice !== "rush" && choice !== "ignore") throw new Error(`choice must be "rush" or "ignore", got ${String(choice)}`);
  const day = state.day;
  const events: GameEvent[] = [];
  let s: GameState = { ...state };

  if (choice === "rush") {
    const rush = rushOrder(pending.shortQty, s.fulfillment, product, params);
    if (s.cashFen < rush.totalFen) {
      throw new Error(`not enough cash for rush restock: need ${rush.totalFen}, have ${s.cashFen}`);
    }
    const id = nextRestockId(s, day);
    const arriveDay = day + rush.leadDays;
    s = {
      ...s,
      cashFen: s.cashFen - rush.totalFen,
      totals: { ...s.totals, restockFen: s.totals.restockFen + rush.totalFen, unitsBought: s.totals.unitsBought + rush.qty },
      restockBatches: [
        ...s.restockBatches,
        { id, orderDay: day, qty: rush.qty, unitCostFen: rush.unitCostFen, arriveDay, rush: true },
      ],
    };
    events.push({
      type: "rush_ordered",
      day,
      inquiryId: pending.inquiryId,
      id,
      qty: rush.qty,
      unitCostFen: rush.unitCostFen,
      totalFen: rush.totalFen,
      arriveDay,
    });
  }

  s = { ...s, midChoices: { ...s.midChoices, [pending.inquiryId]: choice }, pending: null };
  events.push({ type: "mid_choice", day, inquiryId: pending.inquiryId, choice });
  return { state: s, events };
}
