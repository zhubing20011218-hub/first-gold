// 季末结账的结论、计划和实际、这个季度的结果（docs/06 第四、五节）
import type { Bill } from "../engine/bills";
import type { GameEvent } from "../engine/events";
import type { GameState } from "../engine/types";
import type { Params } from "../engine/util";
import { quarterOfDay } from "../engine/bills";
import type { CashPlan } from "./cashPlan";

export type Verdict = "continue" | "bankrupt" | "banned" | "finished";

export function settleVerdict(state: GameState): Verdict {
  if (state.phase === "bankrupt") return "bankrupt";
  if (state.phase === "banned") return "banned";
  if (state.phase === "finished") return "finished";
  return "continue";
}

export interface PlanVsActual {
  planOutFen: number;
  actualOutFen: number;
  adsMaxFen: number;
  actualAdsFen: number;
  worstEndFen: number;
  actualEndFen: number;
}

export function planVsActual(plan: CashPlan, bills: readonly Bill[], endCashFen: number): PlanVsActual {
  const sum = (kinds: string[]): number => -bills.filter((b) => kinds.includes(b.kind)).reduce((s, b) => s + b.amountFen, 0);
  return {
    planOutFen: plan.sureOutFen,
    actualOutFen: sum(["restock", "fixed", "compliance", "setup"]),
    adsMaxFen: plan.adsMaxFen,
    actualAdsFen: sum(["ads"]),
    worstEndFen: plan.worstEndFen,
    actualEndFen: endCashFen,
  };
}

export function pushTotal(state: GameState): number {
  const p = state.pushScore;
  return p.sales + p.stock + p.price + p.complete + p.speed;
}

export interface QuarterResult {
  retailShipped: number;
  lost: number;
  bulkWon: number;
  bulkDelivered: number;
  push: number;
  pushDelta: number;
}

/** 这个季度的结果。events 可以是整局的事件，只取第 q 个季度的 */
export function quarterResult(q: number, events: readonly GameEvent[], startState: GameState, endState: GameState, params: Params): QuarterResult {
  const inQ = events.filter((e) => quarterOfDay(e.day, params.quartersPerGame.value) === q);
  let retailShipped = 0;
  let lost = 0;
  let bulkWon = 0;
  let bulkDelivered = 0;
  for (const e of inQ) {
    if (e.type === "orders_shipped") {
      retailShipped += e.shipped;
      lost += e.lost;
    } else if (e.type === "bulk_won") bulkWon++;
    else if (e.type === "bulk_delivered") bulkDelivered++;
  }
  const push = pushTotal(endState);
  return { retailShipped, lost, bulkWon, bulkDelivered, push, pushDelta: push - pushTotal(startState) };
}
