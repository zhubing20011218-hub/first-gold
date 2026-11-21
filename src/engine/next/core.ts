// 新版共用的小函数：空统计、库存、热度、店铺综合分、净资产、店铺等级
import { applyBp } from "../money";
import { priceFactorBp } from "../market";
import type { Product } from "../product";
import { pushBpOf } from "../push";
import { clamp } from "../util";
import type {
  Fulfillment,
  GameState,
  Inquiry,
  MonthStats,
  Params,
  QuarterStats,
  Routes,
  Totals,
  World,
} from "./types";

export const DAYS_PER_QUARTER = 90;

export function quarterOf(day: number): number {
  return Math.floor(day / DAYS_PER_QUARTER);
}

export function emptyMonthStats(): MonthStats {
  return { wanted: 0, shipped: 0, lost: 0, delivered: 0, returned: 0, delayed: false, shippedBy: {}, pricePtsSum: 0 };
}

export function emptyQuarterStats(): QuarterStats {
  return { wanted: 0, lost: 0, badReviews: 0, bulkDefaults: 0, soldBy: {}, revenueBy: {}, cogsBy: {}, adBy: {}, lostBy: {} };
}

export function emptyTotals(): Totals {
  return {
    setupFeeFen: 0,
    complianceFen: 0,
    restockFen: 0,
    adSpendFen: 0,
    perOrderFeeFen: 0,
    fixedCostFen: 0,
    storageFen: 0,
    payoutFen: 0,
    bulkInFen: 0,
    bulkOutFen: 0,
    eventCostFen: 0,
    promoFeeFen: 0,
    loanFen: 0,
    interestFen: 0,
    ordersShipped: 0,
    ordersReturned: 0,
    lostSales: 0,
    bulkWon: 0,
    bulkDelivered: 0,
    bulkDefaulted: 0,
    promoProfitFen: 0,
  };
}

export function add(rec: Record<string, number>, key: string, n: number): void {
  rec[key] = (rec[key] ?? 0) + n;
}

export function productOf(world: World, id: string): Product {
  const p = world.products.find((x) => x.id === id);
  if (!p) throw new Error(`unknown product id: ${id}`);
  return p;
}

export function fulfillmentOf(r1: Routes["r1"]): Fulfillment {
  return r1 === "local" ? "local" : "cross";
}

/** 供应商一个季度最多供多少件 */
export function quarterCap(product: Product, params: Params): number {
  return applyBp(product.supplierMonthlyCap * 3, params.supplierCapScaleBp.value);
}

/** 下单到到货的天数（跨境直发货到国内仓；海外仓还要海运） */
export function leadDays(fulfillment: Fulfillment, params: Params): number {
  return fulfillment === "cross" ? params.supplierLeadDays.value : params.supplierLeadDays.value + params.headHaulDays.value;
}

/** 留给大单的件数 */
export function reservedQty(state: GameState, productId: string): number {
  return state.bulkOrders
    .filter((b) => b.status === "won" && b.productId === productId)
    .reduce((s, b) => s + b.qty, 0);
}

/** 零售能卖的件数 */
export function availableQty(state: GameState, productId: string): number {
  return Math.max(0, (state.stock[productId] ?? 0) - reservedQty(state, productId));
}

/** 还在路上的货 */
export function inTransitQty(state: GameState, productId: string): number {
  return state.restockBatches
    .filter((b) => b.productId === productId && b.arriveDay >= state.day)
    .reduce((s, b) => s + b.qty, 0);
}

/** 某个季度某种货的热度（bp）：季节 × 第二年 × 这一季的趋势 */
export function heatBp(state: GameState, quarter: number, product: Product, params: Params): number {
  const season = quarter % 4;
  const year = Math.floor(quarter / 4);
  const yearBp = year === 0 ? 10000 : params.year2DemandBp.value;
  const trend = state.schedule.trendBp[quarter]?.[product.id] ?? 10000;
  return applyBp(applyBp(product.seasonBp[season], yearBp), trend);
}

/** 热度换成 1 到 5 颗火 */
export function heatFires(bp: number): number {
  if (bp >= 18000) return 5;
  if (bp >= 14000) return 4;
  if (bp >= 10000) return 3;
  if (bp >= 8000) return 2;
  return 1;
}

/** 推流分的总分（0 到 100）。选了自然流量的路线加分 */
export function pushTotal(state: GameState, params: Params): number {
  const t = state.push.sales + state.push.stock + state.push.price + state.push.complete + state.push.speed;
  const bonus = state.routes.r2 === "organic" ? params.organicRoutePushPts.value : 0;
  return clamp(t + bonus, 0, 100);
}

export function pushBp(state: GameState, params: Params): number {
  return pushBpOf(state.push, params).pushBp + (state.routes.r2 === "organic" ? params.organicRoutePushPts.value * params.pushPerPointBp.value : 0);
}

/** 交大单记录（0 到 100） */
export function recordPts(state: GameState, params: Params): number {
  return clamp(
    params.recordBasePts.value + state.onTime * params.recordOnTimePts.value - state.defaults * params.recordDefaultPts.value,
    0,
    100,
  );
}

export interface Composite {
  total: number;
  push: number;
  /** 评分换成 0 到 100 */
  rating: number;
  record: number;
  bonus: number;
  breach: number;
}

/** 店铺综合分 = 推流分、评分、交大单记录按比例加起来 + 路线加分 − 违约扣分 */
export function composite(state: GameState, params: Params): Composite {
  const push = pushTotal(state, params);
  const rating = Math.round((state.ratingE1 * 100) / 50);
  const record = recordPts(state, params);
  const weighted = Math.round(
    (push * params.compPushPct.value + rating * params.compRatingPct.value + record * params.compRecordPct.value) / 100,
  );
  const bonus = state.routes.r1 === "bulk" ? params.bulkRouteCompositeBonus.value : 0;
  const breach = state.breachPts;
  return { total: clamp(weighted + bonus - breach, 0, 100), push, rating, record, bonus, breach };
}

/** 询单的件数（主攻大单的路线乘一个倍数） */
export function inquiryQty(inq: Inquiry, routes: Routes, params: Params): number {
  const bp = routes.r1 === "bulk" ? params.bulkRouteQtyBp.value : 10000;
  return Math.max(10, Math.floor(applyBp(inq.baseQty, bp) / 10) * 10);
}

/** 这个季度显示给玩家的询单 */
export function inquiriesOf(state: GameState, quarter: number, params: Params): Inquiry[] {
  const all = state.schedule.inquiries.filter((i) => i.quarter === quarter);
  if (all.length === 0) return [];
  const base = state.schedule.inquiryCount[quarter] ?? 0;
  let n = state.routes.r1 === "bulk" ? Math.max(base, 2) : base;
  if (state.routes.r4 === "bulk" && quarter >= 6) n += params.bulkPushExtraInquiries.value;
  return all.filter((i) => i.index < Math.min(n, all.length));
}

/** 货的价值：仓库里的和路上的，按进价 */
export function stockValueFen(state: GameState, world: World): number {
  let v = 0;
  for (const p of world.products) v += (state.stock[p.id] ?? 0) * p.costFen;
  for (const b of state.restockBatches) if (b.arriveDay >= state.day) v += b.qty * b.unitCostFen;
  return v;
}

/** 还没到账的钱：零售货款（不扣以后的退货）、大单尾款 */
export function receivableFen(state: GameState): number {
  let v = 0;
  for (const b of state.orderBatches) if (!b.paid) v += (b.qty - (b.returnedQty ?? 0)) * b.payoutFenEach;
  for (const b of state.bulkOrders) {
    if (b.status === "shipped" || b.status === "delivered") v += b.valueFen - b.depositFen;
  }
  return v;
}

/** 净资产 = 现金 + 货（按进价）+ 还没到账的钱 − 借款 */
export function netWorthFen(state: GameState, world: World): number {
  return state.cashFen + stockValueFen(state, world) + receivableFen(state) - state.loanFen;
}

/** 店铺等级：0 小摊，1 小店，2 旺铺，3 品牌 */
export function shopLevel(netWorth: number, params: Params): number {
  const t = params.levelNetWorthFen.value;
  let level = 0;
  for (let i = 0; i < t.length; i++) if (netWorth >= t[i]) level = i;
  return level;
}

/** 结局用的净资产：剩下的货按进价的 stockSalvageBp 算（卖不掉的货不值原价） */
export function finalNetWorthFen(state: GameState, world: World): number {
  return state.cashFen + applyBp(stockValueFen(state, world), world.params.stockSalvageBp.value) + receivableFen(state) - state.loanFen;
}

/** 对手这一季的零售价 */
export function rivalPriceOf(state: GameState, quarter: number, product: Product): number {
  return state.schedule.rivalPriceSen[quarter]?.[product.id] ?? product.refPriceSen;
}

/** 价格系数：和对手的价比（便宜就多卖） */
export function priceFactorVsRival(state: GameState, quarter: number, priceSen: number, product: Product, params: Params): number {
  return priceFactorBp(priceSen, { ...product, refPriceSen: rivalPriceOf(state, quarter, product) }, params);
}
