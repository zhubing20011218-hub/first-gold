// 界面从 store 里取要显示的东西（docs/12 第四节）。组件不直接读整个 store，只通过这里；计算交给 engine 和 plan。
import type { WorldView } from "../../scene/world/World";
import type { GameState, QuarterDecision } from "../../engine/types";
import { malaysia } from "../../params/malaysia";
import { getProduct } from "../../products/catalog";
import { inTransitBatches, reservedQty } from "../../engine/game";
import { riskLevel } from "../../engine/summary";
import { pricePoints, pushBpOf } from "../../engine/push";
import { senToFen } from "../../engine/money";
import { cashPlan, sureInFen, type CashPlan } from "../../plan/cashPlan";
import { referenceNumbers, type ReferenceNumbers } from "../../plan/reference";
import { allConfirmed } from "./actions";
import type { Area, UiState } from "./state";

const P = malaysia;
export const params = P;

export function productOf(ui: UiState) {
  const id = ui.game?.config.productId ?? ui.setup.productId;
  return id ? getProduct(id) : null;
}

export function timelineOf(ui: UiState): { quarter: number; year: number; season: number } {
  const day = ui.game ? Math.min(ui.game.day, 719) : 0;
  const quarter = Math.floor(day / 90);
  return { quarter, year: Math.floor(quarter / 4), season: quarter % 4 };
}

export function pushOf(game: GameState) {
  return pushBpOf({ ...game.pushScore, price: pricePoints(game.priceSen, getProduct(game.config.productId)) }, P);
}

export interface StatusView {
  cashFen: number;
  stock: number;
  push: number;
  pushDelta: number | null;
  risk: "low" | "mid" | "high" | null;
}

export function statusOf(ui: UiState): StatusView | null {
  const g = ui.game;
  if (!g) return null;
  const push = pushOf(g).total;
  const prev = ui.history[ui.history.length - 1];
  return {
    cashFen: g.cashFen,
    stock: g.stockQty,
    push,
    pushDelta: prev ? push - pushOf(prev.startState).total : null,
    risk: g.fulfillment === "local" ? riskLevel(g.riskPts, P) : null,
  };
}

export function inquiriesOf(ui: UiState) {
  const g = ui.game;
  if (!g) return [];
  const q = Math.floor(g.day / 90);
  return g.schedule.inquiries
    .filter((i) => i.quarter === q)
    .map((i) => ({ id: i.id, qty: i.qty, dueDay: i.dueDay, shipDay: g.fulfillment === "cross" ? i.dueDay - P.headHaulDays.value : i.dueDay }));
}

/** 路上的货：跨境直发是已发出、没签收的订单件数；本土店是还没到货的补货件数 */
export function goodsOnWay(g: GameState): number {
  if (g.fulfillment === "local") return inTransitBatches(g).reduce((s, b) => s + b.qty, 0);
  return g.orderBatches.filter((b) => b.returnedQty === null).reduce((s, b) => s + b.qty, 0);
}

export function moneyOnWay(g: GameState): number {
  return g.orderBatches.filter((b) => !b.paid).reduce((s, b) => s + (b.qty - (b.returnedQty ?? 0)) * b.payoutFenEach, 0);
}

/** 世界要画的东西，全部从模型的状态算出来（docs/10 第五节） */
export function worldViewOf(ui: UiState, seasonOverride?: number): WorldView {
  const g = ui.game;
  const t = timelineOf(ui);
  const season = (seasonOverride ?? t.season) as WorldView["season"];
  if (!g) return { season, year: 0, fulfillment: ui.setup.fulfillment ?? "local", crates: ui.setup.fulfillment ? 3 : 0, shipContainers: 3, coins: 2, frozen: false, gray: "none" };
  const ref = referenceNumbers(g, getProduct(g.config.productId), P);
  const exp = Math.max(1, ref.expMonthly);
  const days = (g.stockQty * 30) / exp;
  const goods = goodsOnWay(g);
  const money = moneyOnWay(g);
  return {
    season,
    year: t.year === 0 ? 0 : 1,
    fulfillment: g.fulfillment,
    crates: g.stockQty === 0 ? 0 : days < 7 ? 1 : days < 30 ? 3 : 6,
    shipContainers: goods === 0 ? 0 : goods < exp ? 3 : 7,
    // 金币的个数：路上的货款每满启动资金的一成多一个，最多 6 个
    coins: money <= 0 ? 0 : Math.min(6, Math.max(1, Math.ceil((money * 10) / P.startCashFen.value))),
    frozen: g.payoutFrozenUntilDay > g.day,
    gray: g.phase === "bankrupt" ? "all" : g.phase === "banned" ? "my" : "none",
  };
}

export function worldLabelsOf(ui: UiState) {
  const g = ui.game;
  if (!g) return null;
  return { goodsOnWay: goodsOnWay(g), moneyOnWayFen: moneyOnWay(g), stock: g.stockQty, stockout: g.stockQty === 0, fulfillment: g.fulfillment };
}

export interface AreaView {
  area: Area;
  state: "notSet" | "set" | "carried";
  /** 第 1 个季度，财务区"以后会用到" */
  later: boolean;
}

export function areaStatesOf(ui: UiState): AreaView[] {
  const q = timelineOf(ui).quarter;
  return (["purchase", "ops", "finance"] as Area[]).map((area) => ({
    area,
    state: ui.carried[area] ? "carried" : ui.confirmed[area] ? "set" : "notSet",
    later: q === 0 && area === "finance",
  }));
}

export function referenceOf(ui: UiState): ReferenceNumbers | null {
  const g = ui.game;
  return g ? referenceNumbers(g, getProduct(g.config.productId), P) : null;
}

export function lastQuarterOf(ui: UiState): { wanted: number; lost: number } | null {
  const g = ui.game;
  if (!g || ui.history.length === 0) return null;
  return { wanted: g.quarterStats.wanted, lost: g.quarterStats.lost };
}

export function financeOf(ui: UiState): { moneyOnWayFen: number; sureInFen: number; risk: "low" | "mid" | "high" | null } | null {
  const g = ui.game;
  if (!g) return null;
  return { moneyOnWayFen: moneyOnWay(g), sureInFen: sureInFen(g), risk: g.fulfillment === "local" ? riskLevel(g.riskPts, P) : null };
}

export function stockOf(ui: UiState): { stock: number; reserved: number; restockOnWay: number } | null {
  const g = ui.game;
  if (!g) return null;
  return { stock: g.stockQty, reserved: reservedQty(g), restockOnWay: inTransitBatches(g).reduce((s, b) => s + b.qty, 0) };
}

/** 这个季度的现金计划（docs/06 第三节） */
export function planOf(ui: UiState): CashPlan | null {
  const g = ui.game;
  return g ? cashPlan(g, ui.decision, getProduct(g.config.productId), P) : null;
}

export function canProceed(ui: UiState): boolean {
  return ui.stage === "decide" && allConfirmed(ui);
}

export function priceYuanFen(priceSen: number): number {
  return senToFen(priceSen, P.cnyPerRmE4.value);
}

/** 弹窗里改了、还没点"就这样定"时的现金计划 */
export function draftPlanOf(ui: UiState, draft: Partial<QuarterDecision>): CashPlan | null {
  const g = ui.game;
  return g ? cashPlan(g, { ...ui.decision, ...draft }, getProduct(g.config.productId), P) : null;
}

/** 读屏用的一句话（docs/09 第八节） */
export function canvasLabelOf(ui: UiState): { stock: number; goods: number; moneyFen: number } {
  const g = ui.game;
  if (!g) return { stock: 0, goods: 0, moneyFen: 0 };
  return { stock: g.stockQty, goods: goodsOnWay(g), moneyFen: moneyOnWay(g) };
}

// ---------- 界面组件要用的格式化、输入检查和类型（docs/11 R10：组件只通过这里拿 engine 和 plan 的东西） ----------
export { formatRM, formatYuan, rmToSen, yuanToFen } from "../../engine/money";
export { checkBid, checkBudget, checkPrice, checkQuote, checkRestock, type Check } from "../../plan/inputs";
export { firstStockCost, maxFirstStock, setupCards } from "../../plan/setup";
export type { Fulfillment, QuarterDecision } from "../../engine/types";
export type { Reminder } from "../../plan/reminders";
export type { CashPlan } from "../../plan/cashPlan";
