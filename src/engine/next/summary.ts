// 结局判定、成绩卡的数据
import { finalNetWorthFen, stockValueFen } from "./core";
import type { GameState, World } from "./types";

export type EndingId =
  | "banned"
  | "bankrupt"
  | "defaulter"
  | "king"
  | "promo"
  | "hit"
  | "brand"
  | "wholesale"
  | "near"
  | "overstock"
  | "pricewar"
  | "steady";

/** 判定顺序就是这个顺序，先满足哪条就是哪个 */
export const ENDING_ORDER: readonly EndingId[] = [
  "banned",
  "bankrupt",
  "defaulter",
  "king",
  "promo",
  "hit",
  "brand",
  "wholesale",
  "near",
  "overstock",
  "pricewar",
  "steady",
];

export const HIDDEN_ENDING: EndingId = "king";

export function endingOf(state: GameState, world: World): EndingId {
  const { params } = world;
  if (state.phase === "banned") return "banned";
  if (state.phase === "bankrupt") return "bankrupt";
  if (state.defaults >= params.defaultEndingCount.value) return "defaulter";
  const nw = finalNetWorthFen(state, world);
  if (nw >= params.kingNetWorthFen.value) return "king";
  if (nw >= params.goalNetWorthFen.value) {
    const profit = nw - params.startCashFen.value;
    if (state.routes.r4 === "promo" && profit > 0 && state.totals.promoProfitFen * 10000 >= profit * params.promoShareBp.value) return "promo";
    if (state.routes.r1 === "cross") return "hit";
    if (state.routes.r1 === "local") return "brand";
    return "wholesale";
  }
  if (nw >= params.nearGoalNetWorthFen.value) return "near";
  if (nw > 0 && stockValueFen(state, world) * 10000 >= nw * params.overstockBp.value) return "overstock";
  if (state.followedPriceWar && nw < params.priceWarPoorFen.value) return "pricewar";
  return "steady";
}

/** 路线树上的叶子编号（0 到 53）：3 × 3 × 2 × 3 */
export function leafIndex(state: GameState): number | null {
  const { r1, r2, r3, r4 } = state.routes;
  if (r2 === null || r3 === null || r4 === null) return null;
  const a = ["cross", "local", "bulk"].indexOf(r1);
  const b = ["ads", "creator", "organic"].indexOf(r2);
  const c = ["good", "bad"].indexOf(r3);
  const d = ["promo", "bulk", "safe"].indexOf(r4);
  return ((a * 3 + b) * 2 + c) * 3 + d;
}

export interface ProductLine {
  productId: string;
  sold: number;
  lost: number;
  /** 打款减退货 − 进价和每单费用 − 分到的广告 */
  profitFen: number;
  stockLeft: number;
}

/** 成绩卡：每种货这一季赚了多少（只算零售；大单另外算） */
export function productLines(state: GameState, world: World): ProductLine[] {
  const qs = state.quarterStats;
  return world.products.map((p) => ({
    productId: p.id,
    sold: qs.soldBy[p.id] ?? 0,
    lost: qs.lostBy[p.id] ?? 0,
    profitFen: (qs.revenueBy[p.id] ?? 0) - (qs.cogsBy[p.id] ?? 0) - (qs.adBy[p.id] ?? 0),
    stockLeft: state.stock[p.id] ?? 0,
  }));
}
