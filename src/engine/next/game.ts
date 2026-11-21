// 开局、路线树的选择、每季度第一天处理玩家的决定
import { applyBp, senToFen } from "../money";
import { restockCostFen } from "../stock";
import { clamp } from "../util";
import {
  DAYS_PER_QUARTER,
  composite,
  emptyMonthStats,
  emptyQuarterStats,
  emptyTotals,
  fulfillmentOf,
  inquiriesOf,
  inquiryQty,
  leadDays,
  productOf,
  quarterCap,
  quarterOf,
} from "./core";
import type { NextEvent } from "./events";
import { buildSchedule } from "./schedule";
import type { GameState, Inquiry, Params, QuarterDecision, Route1, Route2, Route4, World } from "./types";

export interface Step {
  state: GameState;
  events: NextEvent[];
}

export function createGame(seed: number, r1: Route1, world: World): Step {
  const { params, products } = world;
  if (r1 !== "cross" && r1 !== "local" && r1 !== "bulk") throw new Error(`unknown route ${String(r1)}`);
  const fulfillment = fulfillmentOf(r1);
  const setupFeeFen = fulfillment === "local" ? params.localSetupFeeFen.value : 0;
  const totals = emptyTotals();
  totals.setupFeeFen = setupFeeFen;
  const stock: Record<string, number> = {};
  const priceSen: Record<string, number> = {};
  for (const p of products) {
    stock[p.id] = 0;
    priceSen[p.id] = p.refPriceSen;
  }
  const state: GameState = {
    seed,
    day: 0,
    phase: "running",
    routes: { r1, r2: null, r3: null, r4: null },
    fulfillment,
    cashFen: params.startCashFen.value - setupFeeFen,
    stock,
    ratingE1: params.initialRatingE1.value,
    priceSen,
    adBudgetFen: 0,
    adBidBp: 10000,
    push: {
      sales: params.newShopSalesPts.value,
      stock: 20,
      price: 12,
      complete: 18,
      speed: fulfillment === "local" ? params.speedLocalPts.value : params.speedCrossPts.value,
    },
    onTime: 0,
    defaults: 0,
    breachPts: 0,
    riskPts: fulfillment === "local" ? params.riskStartPts.value : 0,
    auditCount: 0,
    payoutFrozenUntilDay: 0,
    pending: null,
    answers: [],
    orderBatches: [],
    restockBatches: [],
    bulkOrders: [],
    effects: [],
    schedule: buildSchedule(seed, world),
    monthStats: emptyMonthStats(),
    quarterStats: emptyQuarterStats(),
    totals,
    followedPriceWar: false,
    loanFen: 0,
    netWorthAtQuarterEnd: [],
    handled: [],
    packBp: 10000,
  };
  const events: NextEvent[] = [{ type: "route_chosen", day: 0, layer: 1, option: r1 }];
  if (setupFeeFen > 0) events.push({ type: "setup_paid", day: 0, feeFen: setupFeeFen });
  return { state, events };
}

/** 现在要不要先在路线树上选（季度第一天）：返回第几层，或者 null */
export function routeLayerDue(state: GameState): 2 | 3 | 4 | null {
  if (state.phase !== "running" || state.day % DAYS_PER_QUARTER !== 0) return null;
  const q = quarterOf(state.day);
  if (q === 2 && state.routes.r2 === null) return 2;
  if (q === 4 && state.routes.r3 === null) return 3;
  if (q === 6 && state.routes.r4 === null) return 4;
  return null;
}

/** 第 2 层：选引流重心 */
export function chooseRoute2(state: GameState, option: Route2): Step {
  if (routeLayerDue(state) !== 2) throw new Error("route layer 2 is not due");
  if (option !== "ads" && option !== "creator" && option !== "organic") throw new Error(`unknown route ${String(option)}`);
  return {
    state: { ...state, routes: { ...state.routes, r2: option } },
    events: [{ type: "route_chosen", day: state.day, layer: 2, option }],
  };
}

/** 第 3 层：按第一年结束时的净资产定绿色还是蓝色，玩家不选 */
export function revealRoute3(state: GameState, params: Params): Step {
  if (routeLayerDue(state) !== 3) throw new Error("route layer 3 is not due");
  const nw = state.netWorthAtQuarterEnd[3] ?? 0;
  const option = nw >= params.l3GoodNetWorthFen.value ? "good" : "bad";
  return {
    state: { ...state, routes: { ...state.routes, r3: option } },
    events: [{ type: "route_chosen", day: state.day, layer: 3, option }],
  };
}

/** 第 4 层：选最后半年怎么冲。全力冲大促要当场付报名费（现金不够也付，季末再结） */
export function chooseRoute4(state: GameState, option: Route4, params: Params): Step {
  if (routeLayerDue(state) !== 4) throw new Error("route layer 4 is not due");
  if (option !== "promo" && option !== "bulk" && option !== "safe") throw new Error(`unknown route ${String(option)}`);
  const events: NextEvent[] = [{ type: "route_chosen", day: state.day, layer: 4, option }];
  let cashFen = state.cashFen;
  const totals = { ...state.totals };
  if (option === "promo") {
    const fee = params.promoFeeFen.value;
    cashFen -= fee;
    totals.promoFeeFen += fee;
    events.push({ type: "promo_fee_paid", day: state.day, feeFen: fee });
  }
  return { state: { ...state, cashFen, totals, routes: { ...state.routes, r4: option } }, events };
}

export interface BidRow {
  /** -1 是玩家，0 到 2 是三家对手 */
  who: number;
  comp: number;
  bidSen: number;
  priceScore: number;
  /** 总分乘 10 */
  totalE1: number;
  rank: number;
  qty: number;
}

/** 报价分（0 到 100）：参考价 0 分，参考价的 bidFloorBp 是 100 分 */
export function priceScore(bidSen: number, refSen: number, params: Params): number {
  const floor = applyBp(refSen, params.bidFloorBp.value);
  if (refSen <= floor) return 0;
  return clamp(Math.floor(((refSen - bidSen) * 100) / (refSen - floor)), 0, 100);
}

/** 抢单的排名：玩家用自己的报价和店铺综合分，对手用真实报价（useEstimate 时用打听来的报价，给界面预览） */
export function rankBid(state: GameState, inq: Inquiry, bidSen: number, params: Params, useEstimate: boolean): BidRow[] {
  const q = inq.quarter;
  const qty = inquiryQty(inq, state.routes, params);
  const rows: BidRow[] = [];
  const score = (comp: number, sen: number): { ps: number; totalE1: number } => {
    const ps = priceScore(sen, inq.refPriceSen, params);
    return { ps, totalE1: ps * params.bidPricePct.value / 10 + comp * params.bidCompPct.value / 10 };
  };
  const myComp = composite(state, params).total;
  const me = score(myComp, bidSen);
  rows.push({ who: -1, comp: myComp, bidSen, priceScore: me.ps, totalE1: me.totalE1, rank: 0, qty: 0 });
  for (let r = 0; r < 3; r++) {
    const comp = state.schedule.rivalComp[r][q];
    const sen = useEstimate ? inq.rivalEstimateSen[r] : inq.rivalBidSen[r];
    const s = score(comp, sen);
    rows.push({ who: r, comp, bidSen: sen, priceScore: s.ps, totalE1: s.totalE1, rank: 0, qty: 0 });
  }
  // 总分高的在前；一样时综合分高的在前；再一样时玩家在前
  const sorted = rows.slice().sort((a, b) => b.totalE1 - a.totalE1 || b.comp - a.comp || a.who - b.who);
  const shares = params.bidShareBp.value;
  sorted.forEach((row, i) => {
    row.rank = i + 1;
    row.qty = Math.floor(applyBp(qty, shares[i] ?? 0) / 10) * 10;
  });
  return sorted;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export function validateDecision(state: GameState, d: QuarterDecision, world: World): void {
  const { params, products } = world;
  for (const p of products) {
    const qty = d.buy[p.id] ?? 0;
    if (!isNonNegInt(qty)) throw new Error(`buy ${p.id} must be an integer >= 0, got ${qty}`);
    if (qty > 0 && qty < p.moq) throw new Error(`buy ${p.id} must be 0 or >= moq ${p.moq}, got ${qty}`);
    if (qty > quarterCap(p, params)) throw new Error(`buy ${p.id} exceeds supplier cap ${quarterCap(p, params)}`);
    const price = d.priceSen[p.id] ?? state.priceSen[p.id];
    const step = params.priceStepSen.value;
    if (!Number.isInteger(price) || price < p.minPriceSen || price > p.maxPriceSen || (price - p.minPriceSen) % step !== 0) {
      throw new Error(`price ${p.id} must be minPriceSen + k * ${step} within [min, max], got ${price}`);
    }
  }
  for (const k of Object.keys(d.buy)) productOf(world, k);
  if (!isNonNegInt(d.adBudgetFen)) throw new Error(`adBudgetFen must be an integer >= 0`);
  if (!isNonNegInt(d.adBidBp) || d.adBidBp < 5000 || d.adBidBp > 20000) throw new Error(`adBidBp must be within [5000, 20000]`);
  if (![0, 1, 2].includes(d.compTier)) throw new Error(`compTier must be 0, 1 or 2`);
  const shown = inquiriesOf(state, quarterOf(state.day), params).map((i) => i.id);
  const seen = new Set<string>();
  for (const b of d.bids) {
    if (!shown.includes(b.inquiryId)) throw new Error(`inquiry ${b.inquiryId} is not open this quarter`);
    if (seen.has(b.inquiryId)) throw new Error(`inquiry ${b.inquiryId} bid twice`);
    seen.add(b.inquiryId);
    if (!Number.isInteger(b.unitPriceSen) || b.unitPriceSen <= 0) throw new Error(`bid must be a positive integer`);
  }
}

export function startQuarter(state: GameState, d: QuarterDecision, world: World): Step {
  const { params } = world;
  if (state.phase !== "running" || state.day % DAYS_PER_QUARTER !== 0) {
    throw new Error(`startQuarter only on the first day of a quarter while running (day ${state.day})`);
  }
  if (routeLayerDue(state) !== null) throw new Error("choose the route first");
  if (state.pending !== null) throw new Error("answer the pending question first");
  validateDecision(state, d, world);
  const day = state.day;
  const q = quarterOf(day);
  const events: NextEvent[] = [];
  const s: GameState = {
    ...state,
    totals: { ...state.totals },
    stock: { ...state.stock },
    priceSen: { ...state.priceSen },
    restockBatches: state.restockBatches.slice(),
    bulkOrders: state.bulkOrders.slice(),
    quarterStats: emptyQuarterStats(),
    breachPts: q > 0 ? Math.max(0, state.breachPts - params.breachDecayPts.value) : state.breachPts,
  };

  // 1. 合规（只对海外仓），当场付，现金不够就做不成
  if (s.fulfillment === "local" && d.compTier > 0) {
    const cost = params.complianceTierCostFen.value[d.compTier];
    if (s.cashFen >= cost) {
      s.cashFen -= cost;
      s.totals.complianceFen += cost;
      s.riskPts = Math.max(0, s.riskPts - params.complianceTierPts.value[d.compTier]);
      events.push({ type: "compliance_bought", day, tier: d.compTier, costFen: cost, riskPts: s.riskPts });
    } else {
      events.push({ type: "compliance_failed", day, tier: d.compTier, needFen: cost });
    }
  }

  // 2. 进货：每种货一批。第 1 季度开张前就到；之后按发货方式的天数到
  let seq = 0;
  for (const p of world.products) {
    const qty = d.buy[p.id] ?? 0;
    if (qty <= 0) continue;
    const cost = restockCostFen(qty, s.fulfillment, p, params);
    const arriveDay = q === 0 ? 0 : day + leadDays(s.fulfillment, params);
    seq++;
    const id = `R${q + 1}-${String(seq).padStart(2, "0")}`;
    s.cashFen -= cost.totalFen;
    s.totals.restockFen += cost.totalFen;
    s.restockBatches.push({ id, productId: p.id, orderDay: day, qty, unitCostFen: cost.unitCostFen, arriveDay, rush: false });
    events.push({ type: "restock_ordered", day, id, productId: p.id, qty, unitCostFen: cost.unitCostFen, totalFen: cost.totalFen, arriveDay });
  }

  // 3. 抢单：按总分排名分货。分到的收三成定金
  for (const b of d.bids) {
    const inq = s.schedule.inquiries.find((i) => i.id === b.inquiryId);
    if (!inq) continue;
    const rows = rankBid(s, inq, b.unitPriceSen, params, false);
    const me = rows.find((r) => r.who === -1);
    if (!me) continue;
    events.push({
      type: "bid_result",
      day,
      inquiryId: inq.id,
      productId: inq.productId,
      rank: me.rank,
      qty: me.qty,
      unitPriceSen: b.unitPriceSen,
      totals: rows.map((r) => r.totalE1),
    });
    if (me.qty <= 0) continue;
    const valueFen = senToFen(me.qty * b.unitPriceSen, params.cnyPerRmE4.value);
    const depositFen = applyBp(valueFen, params.bulkDepositBp.value);
    const shipDay = s.fulfillment === "cross" ? inq.dueDay - params.headHaulDays.value : inq.dueDay;
    const warnDay = Math.max(day + 1, shipDay - params.bulkWarnDays.value);
    s.bulkOrders.push({
      inquiryId: inq.id,
      productId: inq.productId,
      qty: me.qty,
      unitPriceSen: b.unitPriceSen,
      rank: me.rank,
      valueFen,
      depositFen,
      warnDay,
      shipDay,
      dueDay: inq.dueDay,
      balanceDay: null,
      status: "won",
    });
    s.cashFen += depositFen;
    s.totals.bulkInFen += depositFen;
    s.totals.bulkWon += 1;
    events.push({ type: "bulk_won", day, inquiryId: inq.id, productId: inq.productId, qty: me.qty, valueFen, depositFen, shipDay });
  }

  // 4. 售价和广告
  for (const p of world.products) s.priceSen[p.id] = d.priceSen[p.id] ?? s.priceSen[p.id];
  s.adBudgetFen = d.adBudgetFen;
  s.adBidBp = d.adBidBp;
  return { state: s, events };
}
