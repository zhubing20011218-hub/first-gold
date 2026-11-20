// 提醒（docs/06 第七节）：只说明情况，不带任何自动的动作
import type { GameEvent } from "../engine/events";
import type { Product } from "../engine/product";
import type { GameState } from "../engine/types";
import type { Params } from "../engine/util";
import { riskLevel } from "../engine/summary";
import { referenceNumbers } from "./reference";

export type Area = "purchase" | "ops" | "finance";

export interface Reminder {
  area: Area;
  key: string;
  day: number;
  data: Record<string, number>;
}

/** 做决定时的提醒 */
export function decideReminders(state: GameState, product: Product, params: Params): Reminder[] {
  const out: Reminder[] = [];
  const day = state.day;
  const q = Math.floor(day / 90);
  const due = state.bulkOrders.find((b) => b.status === "won" && Math.floor(b.shipDay / 90) === q);
  if (due) out.push({ area: "purchase", key: "bulkDue", day, data: { day: due.shipDay, qty: due.qty } });
  else {
    const ref = referenceNumbers(state, product, params);
    if (ref.expMonthly > 0 && ref.stockDays < 15) out.push({ area: "purchase", key: "stockDays", day, data: { days: ref.stockDays } });
  }
  if (state.fulfillment === "local" && riskLevel(state.riskPts, params) !== "low") {
    out.push({ area: "finance", key: "riskLevel", day, data: { level: riskLevel(state.riskPts, params) === "mid" ? 1 : 2 } });
  } else {
    const last = q * 90 + 89;
    const coming = state.orderBatches
      .filter((b) => !b.paid && b.returnedQty !== null && b.settleDay !== null && Math.max(b.settleDay, state.payoutFrozenUntilDay) <= last)
      .reduce((s, b) => s + (b.qty - (b.returnedQty ?? 0)) * b.payoutFenEach, 0);
    if (coming > 0) out.push({ area: "finance", key: "payoutComing", day, data: { amountFen: coming } });
  }
  return out;
}

export interface PlayedDay {
  events: readonly GameEvent[];
  /** 这一天结束时的现金 */
  cashAfterFen: number;
}

/** 播放时的提醒，按天、按事件的先后。cashBeforeFen 是第一天之前的现金，用来判断"现金从不小于 0 变成小于 0" */
export function playReminders(days: readonly PlayedDay[], cashBeforeFen: number): Reminder[] {
  const out: Reminder[] = [];
  let before = cashBeforeFen;
  for (const d of days) {
    for (const e of d.events) {
      if (e.type === "bulk_on_track") out.push({ area: "purchase", key: "bulkOnTrack", day: e.day, data: { qty: e.qty } });
      else if (e.type === "bulk_short") out.push({ area: "purchase", key: "bulkShort", day: e.day, data: { qty: e.qty, shortQty: e.shortQty } });
      else if (e.type === "restock_arrived") out.push({ area: "purchase", key: "restockArrived", day: e.day, data: { qty: e.qty } });
      else if (e.type === "payout_received" && !e.banned) out.push({ area: "finance", key: "payout", day: e.day, data: { amountFen: e.amountFen } });
      else if (e.type === "event_bad_review") out.push({ area: "ops", key: "badReview", day: e.day, data: {} });
      else if (e.type === "orders_shipped" && e.lost > 0) out.push({ area: "ops", key: "stockout", day: e.day, data: { lost: e.lost } });
    }
    if (before >= 0 && d.cashAfterFen < 0) {
      const day = d.events.length > 0 ? d.events[d.events.length - 1].day : -1;
      out.push({ area: "finance", key: "cashNegative", day, data: { cashFen: d.cashAfterFen } });
    }
    before = d.cashAfterFen;
  }
  return out;
}
