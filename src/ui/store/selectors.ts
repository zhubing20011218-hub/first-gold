// 界面从 store 里取要显示的东西（docs/12 第四节）。组件不直接读整个 store，只通过这里；计算交给 engine 和 plan。
import type { WorldView } from "../../scene/world/World";
import type { GameState, QuarterDecision } from "../../engine/types";
import { malaysia } from "../../params/malaysia";
import { getProduct } from "../../products/catalog";
import { inTransitBatches, reservedQty } from "../../engine/game";
import { netWorthFen, riskLevel } from "../../engine/summary";
import { pricePoints, pushBpOf } from "../../engine/push";
import { formatRM, formatYuan, senToFen } from "../../engine/money";
import { cashPlan, sureInFen, type CashPlan } from "../../plan/cashPlan";
import { referenceNumbers, type ReferenceNumbers } from "../../plan/reference";
import { allConfirmed } from "./actions";
import type { Area, UiState } from "./state";
import type { Bill } from "../../engine/bills";
import { buildQuarterBills } from "../../engine/bills";
import type { GameEvent } from "../../engine/events";
import { applyBp } from "../../engine/money";
import { projectedQtyFor } from "../../engine/pending";
import { rushOrder } from "../../engine/stock";
import type { Reminder as PlanReminder } from "../../plan/reminders";
import { playReminders } from "../../plan/reminders";
import { quarterStartCashFen } from "./actions";
import type { QuarterReport } from "./state";
import { keyDecision, type KeyDecision } from "../../plan/keyDecision";
import { posterNumbers } from "../../plan/poster";
import { settleOrder } from "../../engine/settle";
import { storageFeeFen } from "../../engine/stock";

const P = malaysia;
export const params = P;

export function productOf(ui: UiState) {
  const id = ui.game?.config.productId ?? ui.setup.productId;
  return id ? getProduct(id) : null;
}

export function timelineOf(ui: UiState): { quarter: number; year: number; season: number } {
  const day = ui.game ? Math.min(ui.game.day, 719) : 0;
  // 播放和结算时停在正在放、刚放完的那个季度：换季节在点"进入下一个季度"之后（docs/10 第四节）
  const quarter = ui.stage === "play" && ui.play ? ui.play.quarter : ui.stage === "settle" && ui.report ? ui.report.quarter : Math.floor(day / 90);
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

// ---------- 任务 07：播放、结算、季度报表、大单货不够、工作台、调试面板 ----------
export type { Bill } from "../../engine/bills";
export type { Cause } from "../../plan/causes";
export type { QuarterReport } from "./state";

/** 已经放出来的这些天的事件 */
function shownDays(ui: UiState) {
  return ui.play ? ui.play.days.slice(0, ui.playIndex) : [];
}

/** 播放到第几天（这个季度里的第几天，从 1 开始）和一共几天 */
export function playProgressOf(ui: UiState): { day: number; total: number } | null {
  const play = ui.play;
  if (!play) return null;
  const first = play.quarter * 90;
  const shown = shownDays(ui);
  const day = shown.length > 0 ? shown[shown.length - 1].day - first + 1 : 0;
  // 第 8 个季度之后还有收尾阶段：天数按模型实际算到的天数
  const total = Math.max(90, play.days.length > 0 ? play.days[play.days.length - 1].day - first + 1 : 90);
  return { day: Math.max(0, day), total };
}

export interface PlayNumbers {
  stock: number;
  goods: number;
  orders: number;
  lost: number;
  adsFen: number;
  cashFen: number;
  paidFen: number;
}

/** 播放时三个功能区收起成的一行数字（docs/07 第四节"播放时"） */
export function playNumbersOf(ui: UiState): PlayNumbers | null {
  const g = ui.game;
  if (!g || !ui.play) return null;
  let orders = 0;
  let lost = 0;
  let adsFen = 0;
  let paidFen = 0;
  for (const d of shownDays(ui)) {
    for (const e of d.events) {
      if (e.type === "orders_shipped") {
        orders += e.organicOrders + e.adOrders;
        lost += e.lost;
      } else if (e.type === "ads_ran") adsFen += e.adSpendFen;
      else if (e.type === "payout_received") paidFen += e.amountFen;
    }
  }
  return { stock: g.stockQty, goods: goodsOnWay(g), orders, lost, adsFen, cashFen: g.cashFen, paidFen };
}

/** 播放时每个功能区上方的提醒：最近 15 天里最新的一条 */
export function playRemindersOf(ui: UiState): PlanReminder[] {
  const play = ui.play;
  if (!play) return [];
  const shown = shownDays(ui);
  if (shown.length === 0) return [];
  const all = playReminders(
    shown.map((d) => ({ events: d.events, cashAfterFen: d.cashAfterFen })),
    play.startState.cashFen,
  );
  const today = shown[shown.length - 1].day;
  const out: PlanReminder[] = [];
  for (const area of ["purchase", "ops", "finance"] as Area[]) {
    const latest = all.filter((r) => r.area === area && today - r.day < 15).pop();
    if (latest) out.push(latest);
  }
  return out;
}

/** 账单的编号显示成"Q4-进货-02"（docs/07 第 6.9 节） */
export function billLabel(b: Bill, kindName: string): string {
  const parts = b.id.split("-");
  return parts.length >= 3 ? `${parts[0]}-${kindName}-${parts[parts.length - 1]}` : b.id;
}

export interface BillGroup {
  area: Area;
  rows: { kind: string; count: number; totalFen: number; items: Bill[] }[];
}

/** 季度报表的收入和支出：按功能区分三块，每块里按 kind 分行 */
export function billGroupsOf(report: QuarterReport): BillGroup[] {
  return (["purchase", "ops", "finance"] as Area[]).map((area) => {
    const rows = new Map<string, Bill[]>();
    for (const b of report.bills.filter((x) => x.role === area)) rows.set(b.kind, [...(rows.get(b.kind) ?? []), b]);
    return { area, rows: [...rows.entries()].map(([kind, items]) => ({ kind, count: items.length, totalFen: items.reduce((s, b) => s + b.amountFen, 0), items })) };
  });
}

export function billTotalsOf(report: QuarterReport): { incomeFen: number; expenseFen: number; count: number } {
  let incomeFen = 0;
  let expenseFen = 0;
  for (const b of report.bills) {
    if (b.amountFen >= 0) incomeFen += b.amountFen;
    else expenseFen -= b.amountFen;
  }
  return { incomeFen, expenseFen, count: report.bills.length };
}

/** 第 8 个季度报表里的"收尾"一段（docs/09 第一节）：季度结束后又等了几天，那几天到账的钱。不是第 8 个季度就是 null */
export function closingOf(report: QuarterReport, game: GameState): { days: number; incomeFen: number; count: number } | null {
  if (report.quarter !== 7) return null;
  const after = report.bills.filter((b) => b.day >= 720);
  return {
    days: Math.max(0, game.day - 720),
    incomeFen: after.filter((b) => b.amountFen > 0).reduce((s, b) => s + b.amountFen, 0),
    count: after.length,
  };
}

export function reportOf(ui: UiState): QuarterReport | null {
  return ui.report;
}

/** 大单货不够时弹窗 P9 要显示的数（docs/07 第 6.8 节） */
export function bulkShortOf(ui: UiState) {
  const g = ui.game;
  const pending = g?.pending;
  if (!g || !pending) return null;
  const bulk = g.bulkOrders.find((b) => b.inquiryId === pending.inquiryId);
  if (!bulk) return null;
  const product = getProduct(g.config.productId);
  const rush = rushOrder(pending.shortQty, g.fulfillment, product, P);
  return {
    day: bulk.shipDay,
    qty: bulk.qty,
    short: pending.shortQty,
    rush,
    cashAfterFen: g.cashFen - rush.totalFen,
    depositFen: bulk.depositFen,
    penaltyFen: applyBp(bulk.valueFen, P.bulkPenaltyBp.value),
  };
}

/** 这一局到现在为止的全部事件（包括正在播放的、已经放出来的） */
function eventsSoFar(ui: UiState): GameEvent[] {
  return [...ui.events, ...(ui.stage === "play" ? shownDays(ui).flatMap((d) => d.events) : [])];
}

/** 工作台 P8 的数据（docs/09 第四节），全部从状态、事件和账单里取 */
export function deskOf(ui: UiState) {
  const g = ui.game;
  if (!g) return null;
  const product = getProduct(g.config.productId);
  // 结算和结局时，模型已经走到了下一个季度的第一天；工作台要看的还是刚算完的那个季度
  const q =
    (ui.stage === "settle" || ui.stage === "ending") && ui.report
      ? ui.report.quarter
      : ui.stage === "play" && ui.play
        ? ui.play.quarter
        : Math.floor(Math.min(g.day, 719) / 90);
  const events = eventsSoFar(ui);
  const inQ = events.filter((e) => Math.floor(e.day / 90) === q || (q === 7 && e.day >= 720));
  const ref = referenceNumbers(g, product, P);
  const restockOrders = events.filter((e): e is Extract<GameEvent, { type: "restock_ordered" }> => e.type === "restock_ordered").slice(-8);
  const sum = (type: GameEvent["type"], f: (e: GameEvent) => number) => inQ.filter((e) => e.type === type).reduce((s, e) => s + f(e), 0);
  const adRuns = inQ.filter((e): e is Extract<GameEvent, { type: "ads_ran" }> => e.type === "ads_ran");
  const adSpend = adRuns.reduce((s, e) => s + e.adSpendFen, 0);
  const adOrders = adRuns.reduce((s, e) => s + e.adOrders, 0);
  const quotes = events.filter((e): e is Extract<GameEvent, { type: "bulk_won" | "bulk_lost" }> => e.type === "bulk_won" || e.type === "bulk_lost");
  const bills = buildQuarterBills(q, events, P);
  return {
    restocks: restockOrders.map((e) => ({ id: e.id, day: e.day, qty: e.qty, unitCostFen: e.unitCostFen, arriveDay: e.arriveDay, arrived: e.arriveDay < g.day })),
    stock: { stock: g.stockQty, reserved: reservedQty(g), days: ref.stockDays },
    bulkPrep: g.bulkOrders
      .filter((b) => b.status === "won")
      .map((b) => ({ qty: b.qty, shipDay: b.shipDay, short: Math.max(0, b.qty - projectedQtyFor(g, b, product, P)) })),
    retail: {
      wanted: sum("orders_shipped", (e) => (e.type === "orders_shipped" ? e.organicOrders + e.adOrders : 0)),
      shipped: sum("orders_shipped", (e) => (e.type === "orders_shipped" ? e.shipped : 0)),
      lost: sum("orders_shipped", (e) => (e.type === "orders_shipped" ? e.lost : 0)),
      delivered: sum("orders_delivered", (e) => (e.type === "orders_delivered" ? e.delivered : 0)),
      returned: sum("orders_delivered", (e) => (e.type === "orders_delivered" ? e.returned : 0)),
    },
    orders: g.orderBatches.filter((b) => b.returnedQty === null).slice(-8).map((b) => ({ day: b.orderDay, qty: b.qty, deliverDay: b.deliverDay })),
    ads: { bidFen: g.adBidFen, budgetFen: g.adDailyBudgetFen, spendFen: adSpend, clicks: adRuns.reduce((s, e) => s + e.clicks, 0), orders: adOrders, eachFen: adOrders > 0 ? Math.round(adSpend / adOrders) : 0 },
    quotes: quotes.slice(-6).map((e) => ({ id: e.inquiryId, won: e.type === "bulk_won", priceSen: e.unitPriceSen, rivalSen: e.type === "bulk_lost" ? e.rivalBestSen : null, qty: g.schedule.inquiries.find((i) => i.id === e.inquiryId)?.qty ?? 0 })),
    bills: bills.slice(-10),
    oldBills: ui.history.map((h) => h.quarter),
    payouts: g.orderBatches.filter((b) => !b.paid).slice(-8).map((b) => ({ amountFen: (b.qty - (b.returnedQty ?? 0)) * b.payoutFenEach, day: b.settleDay === null ? null : Math.max(b.settleDay, g.payoutFrozenUntilDay), signed: b.returnedQty !== null })),
    bulkMoney: g.bulkOrders.slice(-6).map((b) => ({ depositFen: b.depositFen, balanceFen: b.valueFen - b.depositFen, day: b.balanceDay ?? b.dueDay, status: b.status })),
    risk: g.fulfillment === "local" ? { level: riskLevel(g.riskPts, P), compliance: g.totals.complianceFen > 0 ? Math.round(g.totals.complianceFen / P.complianceCostFen.value) : 0, audits: g.auditCount } : null,
    reminders: [...ui.reminderLog, ...playRemindersOf(ui)].slice(-12),
    day: g.day,
  };
}

/** ?debug=1 的现金等式：这个季度的季初现金 + 到现在的账单 = 现在的现金 */
export function debugCashOf(ui: UiState): { ok: boolean; startFen: number; sumFen: number; cashFen: number } | null {
  const g = ui.game;
  if (!g) return null;
  const q = ui.play ? ui.play.quarter : Math.floor(Math.min(g.day, 719) / 90);
  const startState = ui.play ? ui.play.startState : ui.stage === "decide" ? g : ui.history[ui.history.length - 1]?.startState ?? g;
  const startFen = ui.stage === "decide" ? g.cashFen : quarterStartCashFen(startState);
  const bills = ui.stage === "decide" ? [] : buildQuarterBills(q, eventsSoFar(ui), P);
  const sumFen = bills.reduce((s, b) => s + b.amountFen, 0);
  return { ok: startFen + sumFen === g.cashFen, startFen, sumFen, cashFen: g.cashFen };
}

/** 最关键的决定要把整局重算 8 遍，按这一局的决定列表缓存起来 */
const keyCache = new WeakMap<object, KeyDecision | null>();
function keyOf(ui: UiState): KeyDecision | null {
  const g = ui.game;
  if (!g || ui.decisions.length === 0) return null;
  const hit = keyCache.get(ui.decisions);
  if (hit !== undefined) return hit;
  const k = keyDecision(g.config, ui.decisions, getProduct(g.config.productId), P);
  keyCache.set(ui.decisions, k);
  return k;
}

export type EndingKind = "goal" | "survived" | "bankrupt" | "banned";

/** 结局（docs/07 第四节"结局"、任务 08） */
export function endingOf(ui: UiState) {
  const g = ui.game;
  if (!g || ui.stage !== "ending") return null;
  const product = getProduct(g.config.productId);
  const nw = netWorthFen(g, product, P);
  const goalFen = P.goalNetWorthFen.value;
  const kind: EndingKind = g.phase === "bankrupt" ? "bankrupt" : g.phase === "banned" ? "banned" : nw >= goalFen ? "goal" : "survived";
  const curve = ui.cashCurve;
  let lowIndex = 0;
  curve.forEach((c, i) => {
    if (c < curve[lowIndex]) lowIndex = i;
  });
  const key = keyOf(ui);
  let lowQuarter = 0;
  ui.history.forEach((h) => {
    if (h.endCashFen < (ui.history[lowQuarter]?.endCashFen ?? Infinity)) lowQuarter = h.quarter;
  });
  return {
    kind,
    netWorthFen: nw,
    goalFen,
    startFen: g.config.startCashFen,
    curve,
    low: curve.length > 0 ? { index: lowIndex, cashFen: curve[lowIndex] } : null,
    // 换哪个季度净资产都不变时，没有"最关键的决定"
    key: key && key.referenceNetWorthFen !== key.playerNetWorthFen ? key : null,
    totals: {
      retail: g.totals.ordersShipped,
      lost: g.totals.lostSales,
      bulkDelivered: g.totals.bulkDelivered,
      adsFen: g.totals.adSpendFen,
      lowQuarter,
    },
    poster: posterNumbers(nw, P),
    productId: g.config.productId,
    fulfillment: g.config.fulfillment,
    seed: g.config.seed,
  };
}

// ---------- 数字从哪来（P7，任务 08 第一节第 8 条）：参数从参数表里读，例子用模型算 ----------
type ParamRow = { value: unknown; unit: string; source: string; note: string; public: boolean };

function bpText(v: number): string {
  return `${Number.isInteger(v / 100) ? (v / 100).toFixed(0) : (v / 100).toFixed(2).replace(/0$/, "")}%`;
}

/** 参数的值按单位排成人看得懂的样子 */
export function paramValueText(p: ParamRow): string {
  const one = (v: number): string => {
    switch (p.unit) {
      case "fen":
        return formatYuan(v);
      case "sen":
        return formatRM(v);
      case "bp":
        return bpText(v);
      case "E4":
        return `RM 1 = ¥${(v / 10000).toFixed(2)}`;
      default:
        // 评分的单位是"0.1 分"：显示成一位小数，单位用参数表里写的
        if (p.unit.startsWith("0.1")) return `${(v / 10).toFixed(1)} ${p.unit.replace(/^0\.1\s*/, "")}`;
        return `${v} ${p.unit}`;
    }
  };
  return Array.isArray(p.value) ? (p.value as number[]).map(one).join(" / ") : one(p.value as number);
}

/** 公开的参数分两组：B 来自真实经营，C 是设计值（A 级的也算进"真实"那一组） */
export function paramGroupsOf(): { real: { name: string; note: string; value: string }[]; design: { name: string; note: string; value: string }[] } {
  const rows = Object.entries(P as unknown as Record<string, ParamRow>).filter(([, p]) => p.public);
  const map = ([name, p]: [string, ParamRow]) => ({ name, note: p.note.split("\u3002")[0], value: paramValueText(p) });
  return { real: rows.filter(([, p]) => p.source !== "C").map(map), design: rows.filter(([, p]) => p.source === "C").map(map) };
}

/** 算法说明里的例子：头巾，跨境直发，西马，按参考售价卖一单；本土店 600 件的仓储费 */
export function sourceExamplesOf() {
  const hijab = getProduct("hijab");
  const order = settleOrder({ fulfillment: "cross", priceSen: hijab.refPriceSen, weightG: hijab.weightG, region: "west", creatorBp: 0, joinCashback: false }, P);
  const storage = storageFeeFen(600, 250, hijab, P);
  return {
    priceSen: hijab.refPriceSen,
    order,
    profitFen: order.payoutFen - hijab.costFen - P.crossForwarderFeeFen.value,
    costFen: hijab.costFen,
    forwarderFen: P.crossForwarderFeeFen.value,
    storage,
    volumeCm3: hijab.volumeCm3,
  };
}
