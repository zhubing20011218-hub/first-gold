// 新版的每一天。顺序：停顿检查 → 月初 → 到货 → 延误差评 → 事件 → 大单 → 零售（每种货）→ 签收到账 → 季末
// 传进来的状态不会被改动：开头浅拷贝，数组和对象要改时换成新的。
import { adShareBp } from "../ads";
import { dayRng, roundMilli } from "../dayRng";
import { priceFactorBp, ratingFactorBp } from "../market";
import { applyBp } from "../money";
import type { Product } from "../product";
import { pricePoints } from "../push";
import { settleOrder } from "../settle";
import { headHaulFen, rushOrder, storageFeeFen } from "../stock";
import { calendarOf, clamp } from "../util";
import {
  DAYS_PER_QUARTER,
  add,
  availableQty,
  emptyMonthStats,
  heatBp,
  inTransitQty,
  finalNetWorthFen,
  netWorthFen,
  productOf,
  pushBp,
  quarterOf,
  reservedQty,
  shopLevel,
} from "./core";
import type { NextEvent } from "./events";
import type { Step } from "./game";
import { double11Day } from "./schedule";
import type { Answer, EventKind, GameState, Params, Pending, World } from "./types";
import { BAD_EVENTS } from "./types";

const LAST_DAY = 8 * DAYS_PER_QUARTER - 1;

function copyForDay(state: GameState): GameState {
  return {
    ...state,
    stock: { ...state.stock },
    totals: { ...state.totals },
    monthStats: { ...state.monthStats, shippedBy: { ...state.monthStats.shippedBy } },
    quarterStats: {
      ...state.quarterStats,
      soldBy: { ...state.quarterStats.soldBy },
      revenueBy: { ...state.quarterStats.revenueBy },
      cogsBy: { ...state.quarterStats.cogsBy },
      adBy: { ...state.quarterStats.adBy },
      lostBy: { ...state.quarterStats.lostBy },
    },
    orderBatches: state.orderBatches.slice(),
    restockBatches: state.restockBatches.slice(),
    bulkOrders: state.bulkOrders.slice(),
    effects: state.effects.slice(),
    handled: state.handled.slice(),
    answers: state.answers.slice(),
  };
}

/** 库存（能卖的）最多的那种货。事件落在它身上 */
function topProduct(s: GameState, world: World): string {
  let best = world.products[0].id;
  let bestQty = -1;
  for (const p of world.products) {
    const q = availableQty(s, p.id);
    if (q > bestQty) {
      best = p.id;
      bestQty = q;
    }
  }
  return best;
}

/** 今天的事件（季度里排好的一件，加上第二年 1 月的机会卡或危机卡） */
function eventsToday(s: GameState): { kind: EventKind; card: boolean }[] {
  const out: { kind: EventKind; card: boolean }[] = [];
  for (const e of s.schedule.events) if (e.day === s.day) out.push({ kind: e.kind, card: false });
  if (s.day === 4 * DAYS_PER_QUARTER && s.routes.r3 !== null) {
    out.push({ kind: s.routes.r3 === "good" ? s.schedule.goodCard : s.schedule.badCard, card: true });
  }
  return out;
}

function isDouble11(day: number, params: Params): boolean {
  return double11Day(quarterOf(day), params.double11Offset.value) === day;
}

/** 某种货今天的热度倍数（季节、趋势、每天的波动、双 11、视频火了、价格战没跟） */
function demandBpOf(s: GameState, product: Product, idx: number, params: Params): number {
  const q = quarterOf(s.day);
  let bp = applyBp(heatBp(s, q, product, params), s.schedule.surpriseBp[q]?.[product.id] ?? 10000);
  const noise = dayRng(s.seed, s.day, 20 + idx * 4).int(params.demandNoiseMinBp.value, params.demandNoiseMaxBp.value);
  bp = applyBp(bp, noise);
  if (isDouble11(s.day, params)) {
    const big = s.routes.r4 === "promo" && q === 7 ? params.promoDouble11Bp.value : params.double11Bp.value;
    bp = applyBp(bp, big);
  }
  for (const e of s.effects) {
    if (s.day < e.fromDay || s.day > e.toDay) continue;
    if (e.kind === "viral" && e.productId === product.id) bp = applyBp(bp, e.bp);
    if (e.kind === "pricewar_ignore" && e.productId === product.id) bp = applyBp(bp, e.bp);
  }
  return bp;
}

/** 今天的售价（价格战跟着降价时打折） */
function priceToday(s: GameState, product: Product): number {
  let price = s.priceSen[product.id];
  for (const e of s.effects) {
    if (e.kind === "pricewar_follow" && e.productId === product.id && s.day >= e.fromDay && s.day <= e.toDay) {
      price = Math.max(product.minPriceSen, applyBp(price, e.bp));
    }
  }
  return price;
}

interface Wanted {
  organic: number;
  ad: number;
  adSpendFen: number;
}

/** 每种货今天来了多少单（不看库存）。双 11 打包要先知道这个 */
function wantedToday(s: GameState, world: World): Record<string, Wanted> {
  const { params, products } = world;
  const out: Record<string, Wanted> = {};
  const push = pushBp(s, params);
  const rf = ratingFactorBp(s.ratingE1, params);
  const homepage = s.effects.some((e) => e.kind === "homepage" && s.day >= e.fromDay && s.day <= e.toDay);
  const breachBp = Math.max(0, 10000 - s.breachPts * params.breachDemandBpPerPt.value);
  const routeBp = s.routes.r1 === "bulk" ? params.bulkRouteOrganicBp.value : s.routes.r1 === "cross" ? params.crossOrganicBp.value : 10000;
  const { season, year } = calendarOf(s.day);
  const competitionBp = applyBp(params.seasonCompetitionBp.value[season], year === 0 ? 10000 : params.year2CompetitionBp.value);

  // 广告每天的预算，按能卖的库存分给每种货
  const dailyBudget = Math.min(Math.floor(s.adBudgetFen / DAYS_PER_QUARTER), Math.max(0, s.cashFen));
  const avail = products.map((p) => availableQty(s, p.id));
  const availSum = avail.reduce((a, b) => a + b, 0);

  products.forEach((p, idx) => {
    const price = priceToday(s, p);
    const pf = priceFactorBp(price, p, params);
    const demandBp = demandBpOf(s, p, idx, params);
    let m = applyBp(p.organicPerDayMilli, params.marketScaleBp.value);
    for (const bp of [demandBp, push, pf, rf, breachBp, routeBp]) m = applyBp(m, bp);
    if (homepage) m = applyBp(m, params.homepageBp.value);
    const organic = roundMilli(m, dayRng(s.seed, s.day, 21 + idx * 4));

    let ad = 0;
    let adSpendFen = 0;
    if (dailyBudget > 0 && availSum > 0 && avail[idx] > 0 && s.adBidBp > 0) {
      const budget = Math.floor((dailyBudget * avail[idx]) / availSum);
      const refBid = Math.max(1, applyBp(p.baseCpcFen, competitionBp));
      const bid = Math.max(1, applyBp(refBid, s.adBidBp));
      let ratio = Math.floor((bid * push) / refBid);
      if (s.routes.r2 === "ads") ratio = applyBp(ratio, params.adRouteRatioBp.value);
      const share = adShareBp(ratio, params);
      let pool = applyBp(applyBp(p.adClickPoolPerDay, params.adPoolScaleBp.value), demandBp);
      if (s.routes.r2 === "ads") pool = applyBp(pool, params.adRoutePoolBp.value);
      const clicks = Math.min(applyBp(pool, share), Math.floor(budget / bid));
      adSpendFen = clicks * bid;
      const am = applyBp(applyBp(applyBp(Math.floor((clicks * p.adCvrBp) / 10), pf), rf), breachBp);
      ad = roundMilli(am, dayRng(s.seed, s.day, 22 + idx * 4));
    }
    out[p.id] = { organic, ad, adSpendFen };
  });
  return out;
}

function payoutOf(s: GameState, product: Product, priceSen: number, creatorBp: number, params: Params): number {
  return settleOrder(
    { fulfillment: s.fulfillment, priceSen, weightG: product.weightG, region: "west", creatorBp, joinCashback: false },
    params,
  ).payoutFen;
}

/** 发一批零售订单：扣库存、付每单费用、记下打款 */
function ship(
  s: GameState,
  product: Product,
  qty: number,
  priceSen: number,
  creatorBp: number,
  params: Params,
): { payoutFenEach: number } {
  const day = s.day;
  const payoutFenEach = payoutOf(s, product, priceSen, creatorBp, params);
  if (qty <= 0) return { payoutFenEach };
  const perOrderFeeFen = s.fulfillment === "cross" ? params.crossForwarderFeeFen.value : params.localLabelFeeFen.value;
  s.stock[product.id] -= qty;
  s.cashFen -= qty * perOrderFeeFen;
  s.totals.perOrderFeeFen += qty * perOrderFeeFen;
  s.totals.ordersShipped += qty;
  const promo = isDouble11(day, params);
  if (promo) s.totals.promoProfitFen += qty * (payoutFenEach - product.costFen - perOrderFeeFen);
  const deliverDay =
    s.fulfillment === "cross"
      ? day + dayRng(s.seed, day, 23 + productIndex(s, product)).int(params.crossDeliveryMinDays.value, params.crossDeliveryMaxDays.value)
      : day + params.localDeliveryDays.value;
  s.orderBatches.push({
    productId: product.id,
    orderDay: day,
    qty,
    payoutFenEach,
    unitCostFen: product.costFen,
    deliverDay,
    returnedQty: null,
    settleDay: null,
    paid: false,
    promo,
  });
  add(s.monthStats.shippedBy, product.id, qty);
  s.monthStats.shipped += qty;
  s.monthStats.pricePtsSum += qty * pricePoints(priceSen, product);
  add(s.quarterStats.soldBy, product.id, qty);
  add(s.quarterStats.revenueBy, product.id, qty * payoutFenEach);
  add(s.quarterStats.cogsBy, product.id, qty * product.costFen + qty * perOrderFeeFen);
  return { payoutFenEach };
}

function productIndex(s: GameState, product: Product): number {
  return Object.keys(s.stock).indexOf(product.id);
}

/** 1. 月初：评分恢复、固定开支、仓储费、推流分 */
function monthStart(s: GameState, world: World, events: NextEvent[]): void {
  const { params, products } = world;
  const day = s.day;
  const q = quarterOf(day);
  const safe = s.routes.r4 === "safe" && q >= 6;
  const recover = 1 + (s.routes.r2 === "organic" ? params.organicRouteRatingE1.value : 0);
  s.ratingE1 = Math.min(params.initialRatingE1.value, s.ratingE1 + recover);
  const level = shopLevel(netWorthFen(s, world), params);
  const base = params.levelFixedCostFen.value[level] ?? params.monthlyFixedCostFen.value;
  const fixed = safe ? applyBp(base, params.safeFixedBp.value) : base;
  s.cashFen -= fixed;
  s.totals.fixedCostFen += fixed;
  let storage = 0;
  if (s.fulfillment === "local" && day !== 0) {
    for (const p of products) {
      const fee = storageFeeFen(s.stock[p.id] ?? 0, s.monthStats.shippedBy[p.id] ?? 0, p, params).feeFen;
      storage += safe ? applyBp(fee, params.safeStorageBp.value) : fee;
    }
    s.cashFen -= storage;
    s.totals.storageFen += storage;
  }
  // 推流分（店铺的）：用上个月的数
  const m = s.monthStats;
  if (day !== 0) {
    const sales = clamp(Math.floor((m.shipped * 20) / params.storeSalesBenchmark.value), 0, 20);
    let stockPts = 20;
    if (m.wanted > 0) stockPts = clamp(20 - Math.floor((Math.floor((m.lost * 10000) / m.wanted) - 200) / 100), 0, 20);
    const price = m.shipped > 0 ? clamp(Math.round(m.pricePtsSum / m.shipped), 0, 20) : s.push.price;
    const complete = m.delivered > 0 ? clamp(20 - Math.floor(Math.floor((m.returned * 10000) / m.delivered) / 100), 0, 20) : s.push.complete;
    const speedBase = s.fulfillment === "local" ? params.speedLocalPts.value : params.speedCrossPts.value;
    const speed = m.delayed ? Math.max(0, speedBase - params.speedDelayPenaltyPts.value) : speedBase;
    s.push = { sales, stock: stockPts, price, complete, speed };
  }
  s.monthStats = emptyMonthStats();
  const total = s.push.sales + s.push.stock + s.push.price + s.push.complete + s.push.speed;
  events.push({ type: "month_started", day, fixedCostFen: fixed, storageFeeFen: storage, pushTotal: total });
}

/** 好事直接发生；坏事要停下来问 */
function startEvent(s: GameState, kind: EventKind, card: boolean, world: World, events: NextEvent[], extra: Extra[]): void {
  const { params } = world;
  const day = s.day;
  const target = topProduct(s, world);
  const needsProduct = kind === "viral" || kind === "streamer" || kind === "bigclient" || kind === "pricewar";
  const productId = needsProduct ? target : null;
  events.push({ type: "event_started", day, kind, productId, card });
  if (kind === "viral") {
    const days = card ? params.goodCardViralDays.value : params.viralDays.value;
    s.effects.push({ kind: "viral", productId, fromDay: day, toDay: day + days - 1, bp: params.viralBp.value });
  } else if (kind === "homepage") {
    s.effects.push({ kind: "homepage", productId: null, fromDay: day, toDay: day + params.homepageDays.value - 1, bp: params.homepageBp.value });
  } else if (kind === "streamer") {
    const p = productOf(world, target);
    const qty = Math.floor(applyBp(applyBp(p.organicPerDayMilli, params.marketScaleBp.value), params.streamerBurstBp.value) / 1000);
    extra.push({ productId: target, qty, creatorBp: params.creatorFeeBp.value, priceSen: s.priceSen[target] });
  } else if (kind === "bigclient") {
    const qty = applyBp(availableQty(s, target), params.bigClientBp.value);
    extra.push({ productId: target, qty, creatorBp: 0, priceSen: productOf(world, target).refPriceSen });
  }
}

interface Extra {
  productId: string;
  qty: number;
  creatorBp: number;
  priceSen: number;
}

/** 回答停下来的问题 */
export function answer(state: GameState, a: Answer, world: World): Step {
  const { params } = world;
  const p = state.pending;
  if (p === null) throw new Error("nothing to answer");
  if (p.kind !== a.kind) throw new Error(`pending is ${p.kind}, got answer ${a.kind}`);
  const s = copyForDay(state);
  const day = s.day;
  const events: NextEvent[] = [];
  s.pending = null;
  s.answers.push(a);
  if (p.kind === "bulk_short" && a.kind === "bulk_short") {
    if (a.choice === "rush") {
      const product = productOf(world, p.productId);
      const r = rushOrder(p.shortQty, s.fulfillment, product, params);
      s.cashFen -= r.totalFen;
      s.totals.restockFen += r.totalFen;
      const arriveDay = day + r.leadDays;
      s.restockBatches.push({ id: `RU-${p.inquiryId}`, productId: product.id, orderDay: day, qty: r.qty, unitCostFen: r.unitCostFen, arriveDay, rush: true });
      events.push({ type: "rush_ordered", day, inquiryId: p.inquiryId, productId: product.id, qty: r.qty, totalFen: r.totalFen, arriveDay });
    }
    s.bulkOrders = s.bulkOrders.map((b) => (b.inquiryId === p.inquiryId ? { ...b, warnDay: -1 } : b));
    return { state: s, events };
  }
  if (p.kind === "pack" && a.kind === "pack") {
    s.packBp = clamp(Math.floor(a.packBp), params.packMinBp.value, 10000);
    s.handled.push(day);
    return { state: s, events };
  }
  if (p.kind === "event" && a.kind === "event") {
    let cost = 0;
    const k = p.event;
    if (k === "typhoon") {
      if (a.choice === "a") cost = params.typhoonAirFen.value;
      else {
        const d = params.typhoonDays.value;
        s.restockBatches = s.restockBatches.map((b) => (b.arriveDay > day ? { ...b, arriveDay: b.arriveDay + d } : b));
        s.orderBatches = s.orderBatches.map((b) => (b.returnedQty === null && b.deliverDay >= day ? { ...b, deliverDay: b.deliverDay + d } : b));
        s.monthStats = { ...s.monthStats, delayed: true };
      }
    } else if (k === "pricewar") {
      const to = day + params.priceWarDays.value - 1;
      if (a.choice === "a") {
        s.effects.push({ kind: "pricewar_follow", productId: p.productId, fromDay: day, toDay: to, bp: params.priceWarCutBp.value });
        s.followedPriceWar = true;
      } else {
        s.effects.push({ kind: "pricewar_ignore", productId: p.productId, fromDay: day, toDay: to, bp: params.priceWarIgnoreBp.value });
      }
    } else if (k === "audit") {
      if (a.choice === "a") {
        cost = params.auditFastFen.value;
        s.payoutFrozenUntilDay = Math.max(s.payoutFrozenUntilDay, day + params.auditFastDays.value);
      } else {
        s.payoutFrozenUntilDay = Math.max(s.payoutFrozenUntilDay, day + params.auditSlowDays.value);
      }
    } else if (k === "malicious") {
      if (a.choice === "a") cost = params.appealFen.value;
      else s.ratingE1 = Math.max(params.ratingMinE1.value, s.ratingE1 - params.maliciousDropE1.value);
    }
    s.cashFen -= cost;
    s.totals.eventCostFen += cost;
    if (!p.card) s.handled.push(day);
    else s.handled.push(-day - 1);
    events.push({ type: "event_answered", day, kind: k, choice: a.choice, costFen: cost });
    return { state: s, events };
  }
  throw new Error("answer does not match");
}

/** 0. 大单检查那天：货不够就停下来问（加急补货还是不管） */
function bulkCheck(s: GameState): Extract<Pending, { kind: "bulk_short" }> | null {
  for (const b of s.bulkOrders) {
    if (b.status !== "won" || b.warnDay !== s.day) continue;
    const arriving = s.restockBatches
      .filter((r) => r.productId === b.productId && r.arriveDay >= s.day && r.arriveDay <= b.shipDay)
      .reduce((a, r) => a + r.qty, 0);
    const otherReserved = reservedQty(s, b.productId) - b.qty;
    const projected = (s.stock[b.productId] ?? 0) + arriving - otherReserved;
    if (projected < b.qty) return { kind: "bulk_short", inquiryId: b.inquiryId, productId: b.productId, shortQty: b.qty - Math.max(0, projected) };
  }
  return null;
}

export function stepDay(state: GameState, world: World): Step {
  const { params, products } = world;
  if (state.phase !== "running") throw new Error(`stepDay after the game ended (${state.phase})`);
  if (state.pending !== null) return { state, events: [] };
  const day = state.day;

  // 0. 停顿：大单的货不够、坏事、双 11 打包
  const short = bulkCheck(state);
  if (short) return { state: { ...state, pending: short }, events: [{ type: "bulk_short", day, inquiryId: short.inquiryId, productId: short.productId, shortQty: short.shortQty }] };
  for (const e of eventsToday(state)) {
    const doneKey = e.card ? -day - 1 : day;
    if (BAD_EVENTS.includes(e.kind) && !state.handled.includes(doneKey)) {
      const productId = e.kind === "pricewar" ? topProduct(state, world) : null;
      return {
        state: { ...state, pending: { kind: "event", event: e.kind, productId, card: e.card } },
        events: [{ type: "event_started", day, kind: e.kind, productId, card: e.card }],
      };
    }
  }
  if (isDouble11(day, params) && !state.handled.includes(day)) {
    const w = wantedToday(state, world);
    const wanted: Record<string, number> = {};
    for (const p of products) wanted[p.id] = w[p.id].organic + w[p.id].ad;
    return { state: { ...state, pending: { kind: "pack", wanted } }, events: [] };
  }

  const s = copyForDay(state);
  const events: NextEvent[] = [];
  const extra: Extra[] = [];
  const q = quarterOf(day);

  if (day % 30 === 0) monthStart(s, world, events); // 1
  // 2. 到货
  for (const b of s.restockBatches) {
    if (b.arriveDay === day) {
      s.stock[b.productId] = (s.stock[b.productId] ?? 0) + b.qty;
      events.push({ type: "restock_arrived", day, id: b.id, productId: b.productId, qty: b.qty });
    }
  }
  // 3. 运输延误和差评
  if (s.schedule.delayDays.includes(day)) {
    const d = params.delayDays.value;
    if (s.fulfillment === "cross") {
      s.orderBatches = s.orderBatches.map((b) => (b.returnedQty === null && b.deliverDay >= day ? { ...b, deliverDay: b.deliverDay + d } : b));
    } else {
      s.restockBatches = s.restockBatches.map((b) => (b.arriveDay > day ? { ...b, arriveDay: b.arriveDay + d } : b));
    }
    s.monthStats.delayed = true;
    events.push({ type: "event_delay", day, delayDays: d });
  }
  if (s.schedule.badReviewDays.includes(day)) {
    s.ratingE1 = Math.max(params.ratingMinE1.value, s.ratingE1 - params.badReviewDropE1.value);
    s.quarterStats.badReviews += 1;
    events.push({ type: "event_bad_review", day, ratingE1: s.ratingE1 });
  }
  // 4. 好事（坏事上面已经问过了）
  for (const e of eventsToday(s)) if (!BAD_EVENTS.includes(e.kind)) startEvent(s, e.kind, e.card, world, events, extra);
  // 达人直播
  if (s.routes.r2 === "creator" && s.schedule.creatorDays.includes(day)) {
    const target = topProduct(s, world);
    const p = productOf(world, target);
    const base = applyBp(p.organicPerDayMilli, params.marketScaleBp.value);
    const qty = Math.floor(applyBp(applyBp(base, params.creatorBurstBp.value), heatBp(s, q, p, params)) / 1000);
    extra.push({ productId: target, qty, creatorBp: params.creatorFeeBp.value, priceSen: s.priceSen[target] });
    events.push({ type: "creator_live", day, productId: target, orders: qty });
  }

  // 5. 大单：发货、交货、收尾款
  s.bulkOrders = s.bulkOrders.map((b) => {
    if (b.status !== "won" || b.shipDay !== day) return b;
    if ((s.stock[b.productId] ?? 0) >= b.qty) {
      s.stock[b.productId] -= b.qty;
      const freightFen = s.fulfillment === "cross" ? headHaulFen(b.qty, productOf(world, b.productId), params) : 0;
      s.cashFen -= freightFen;
      s.totals.bulkOutFen += freightFen;
      events.push({ type: "bulk_shipped", day, inquiryId: b.inquiryId, productId: b.productId, qty: b.qty, freightFen });
      return { ...b, status: "shipped" };
    }
    const penaltyFen = applyBp(b.valueFen, params.bulkPenaltyBp.value);
    s.cashFen -= b.depositFen + penaltyFen;
    s.totals.bulkOutFen += b.depositFen + penaltyFen;
    s.totals.bulkDefaulted += 1;
    s.defaults += 1;
    s.breachPts += params.breachPenaltyPts.value;
    s.quarterStats.bulkDefaults += 1;
    events.push({ type: "bulk_defaulted", day, inquiryId: b.inquiryId, depositFen: b.depositFen, penaltyFen, breachPts: s.breachPts });
    return { ...b, status: "defaulted" };
  });
  s.bulkOrders = s.bulkOrders.map((b) => {
    if (b.status !== "shipped" || b.dueDay !== day) return b;
    const balanceDay = day + params.bulkBalanceDays.value;
    s.onTime += 1;
    s.totals.bulkDelivered += 1;
    events.push({ type: "bulk_delivered", day, inquiryId: b.inquiryId, balanceDay });
    return { ...b, status: "delivered", balanceDay };
  });
  s.bulkOrders = s.bulkOrders.map((b) => {
    if (b.status !== "delivered" || b.balanceDay !== day) return b;
    const amountFen = b.valueFen - b.depositFen;
    s.cashFen += amountFen;
    s.totals.bulkInFen += amountFen;
    events.push({ type: "bulk_paid", day, inquiryId: b.inquiryId, amountFen });
    return { ...b, status: "paid" };
  });

  // 6. 零售：每种货
  const wanted = wantedToday(s, world);
  const d11 = isDouble11(day, params);
  let d11Wanted = 0;
  let d11Shipped = 0;
  for (const p of products) {
    const w = wanted[p.id];
    const want = w.organic + w.ad;
    const canPack = d11 ? applyBp(want, s.packBp) : want;
    const shipped = Math.min(canPack, availableQty(s, p.id));
    const lost = want - shipped;
    const price = priceToday(s, p);
    const { payoutFenEach } = ship(s, p, shipped, price, 0, params);
    s.cashFen -= w.adSpendFen;
    s.totals.adSpendFen += w.adSpendFen;
    add(s.quarterStats.adBy, p.id, w.adSpendFen);
    s.totals.lostSales += lost;
    s.monthStats.wanted += want;
    s.monthStats.lost += lost;
    s.quarterStats.wanted += want;
    s.quarterStats.lost += lost;
    add(s.quarterStats.lostBy, p.id, lost);
    if (d11) {
      d11Wanted += want;
      d11Shipped += shipped;
    }
    let extraQty = 0;
    for (const x of extra) {
      if (x.productId !== p.id) continue;
      const n = Math.min(x.qty, availableQty(s, p.id));
      ship(s, p, n, x.priceSen, x.creatorBp, params);
      extraQty += n;
    }
    if (want > 0 || extraQty > 0) {
      events.push({ type: "sales", day, productId: p.id, organic: w.organic, ad: w.ad, extra: extraQty, shipped, lost, adSpendFen: w.adSpendFen, payoutFenEach });
    }
  }
  if (d11) events.push({ type: "double11", day, packBp: s.packBp, wanted: d11Wanted, shipped: d11Shipped });

  // 7. 签收和到账
  s.orderBatches = s.orderBatches.map((b) => {
    if (b.deliverDay !== day || b.returnedQty !== null) return b;
    const product = productOf(world, b.productId);
    const rng = dayRng(s.seed, b.orderDay, 24 + productIndex(s, product));
    let returned = 0;
    for (let i = 0; i < b.qty; i++) if (rng.int(0, 9999) < product.returnBp) returned++;
    const settleDay = day + (s.fulfillment === "cross" ? params.crossSettleDays.value : params.localSettleDays.value);
    s.monthStats.delivered += b.qty;
    s.monthStats.returned += returned;
    s.totals.ordersReturned += returned;
    add(s.quarterStats.revenueBy, b.productId, -returned * b.payoutFenEach);
    events.push({ type: "orders_delivered", day, productId: b.productId, delivered: b.qty, returned });
    return { ...b, returnedQty: returned, settleDay };
  });
  if (day >= s.payoutFrozenUntilDay) {
    let amount = 0;
    let orders = 0;
    s.orderBatches = s.orderBatches.map((b) => {
      if (b.paid || b.settleDay === null || b.settleDay > day || b.returnedQty === null) return b;
      const n = b.qty - b.returnedQty;
      amount += n * b.payoutFenEach;
      orders += n;
      return { ...b, paid: true };
    });
    if (amount > 0) {
      s.cashFen += amount;
      s.totals.payoutFen += amount;
      events.push({ type: "payout_received", day, amountFen: amount, orders });
    }
    // 付完的订单从列表里去掉，免得越来越长
    s.orderBatches = s.orderBatches.filter((b) => !b.paid);
  }

  // 8. 现金是负数时付周转利息
  if (s.cashFen < 0) {
    const interest = applyBp(-s.cashFen, params.overdraftBpPerDay.value);
    s.cashFen -= interest;
    s.totals.interestFen += interest;
  }

  // 9. 季末
  if (day % DAYS_PER_QUARTER === DAYS_PER_QUARTER - 1) quarterEnd(s, world, events);
  s.day = day + 1;
  // 只留还在起作用的效果
  s.effects = s.effects.filter((e) => e.toDay >= s.day);
  return { state: s, events };
}

function quarterEnd(s: GameState, world: World, events: NextEvent[]): void {
  const { params } = world;
  const day = s.day;
  const q = quarterOf(day);
  // 海外仓的风险
  if (s.fulfillment === "local") {
    const qs = s.quarterStats;
    let risk = s.riskPts + dayRng(s.seed, q, 7).int(params.riskQuarterMinPts.value, params.riskQuarterMaxPts.value);
    if (qs.lost * 10000 > qs.wanted * params.riskStockoutBp.value) risk += params.riskStockoutPts.value;
    risk += qs.badReviews * params.riskBadReviewPts.value + qs.bulkDefaults * params.riskBulkDefaultPts.value;
    s.riskPts = Math.min(100, risk);
    events.push({ type: "risk_updated", day, riskPts: s.riskPts });
    if (s.riskPts >= params.riskHighPts.value) {
      if (s.auditCount === 0) {
        s.auditCount = 1;
        s.payoutFrozenUntilDay = Math.max(s.payoutFrozenUntilDay, day + 1 + params.auditFreezeDays.value);
        s.riskPts = Math.max(0, s.riskPts - params.auditReliefPts.value);
        events.push({ type: "audit_started", day, frozenUntilDay: s.payoutFrozenUntilDay });
      } else {
        // 封店：没到账的货款拿回一半
        let back = 0;
        for (const b of s.orderBatches) if (!b.paid) back += applyBp((b.qty - (b.returnedQty ?? 0)) * b.payoutFenEach, params.banPayoutBp.value);
        s.orderBatches = [];
        s.cashFen += back;
        s.totals.payoutFen += back;
        s.phase = "banned";
        events.push({ type: "banned", day });
      }
    }
  }
  // 稳住现金：季末付不起时平台借一笔
  if (s.phase === "running" && s.cashFen < 0 && s.routes.r4 === "safe" && q >= 6 && s.loanFen === 0) {
    const amount = Math.min(params.safeLoanMaxFen.value, -s.cashFen);
    s.loanFen = amount;
    s.cashFen += amount;
    s.totals.loanFen += amount;
    events.push({ type: "loan_taken", day, amountFen: amount });
  }
  // 最后一天还借款
  if (s.phase === "running" && day === LAST_DAY && s.loanFen > 0) {
    const interest = applyBp(s.loanFen, params.safeLoanInterestBp.value);
    s.cashFen -= s.loanFen + interest;
    s.totals.interestFen += interest;
    events.push({ type: "loan_repaid", day, amountFen: s.loanFen, interestFen: interest });
    s.loanFen = 0;
  }
  const nw = day === LAST_DAY ? finalNetWorthFen({ ...s, day: day + 1 }, world) : netWorthFen({ ...s, day: day + 1 }, world);
  s.netWorthAtQuarterEnd = [...s.netWorthAtQuarterEnd, nw];
  events.push({ type: "quarter_ended", day, quarter: q, netWorthFen: nw, cashFen: s.cashFen });
  if (s.phase !== "running") return;
  if (s.cashFen < 0) {
    s.phase = "bankrupt";
    events.push({ type: "bankrupt", day, cashFen: s.cashFen });
  } else if (day === LAST_DAY) {
    s.phase = "finished";
    events.push({ type: "finished", day, netWorthFen: nw });
  }
}

/** 一直往前走，直到季度结束、停下来问、或者游戏结束 */
export function runUntilStop(state: GameState, world: World): Step {
  let s = state;
  const events: NextEvent[] = [];
  const q = quarterOf(s.day);
  while (s.phase === "running" && s.pending === null) {
    const r = stepDay(s, world);
    s = r.state;
    events.push(...r.events);
    if (quarterOf(s.day) !== q) break;
  }
  return { state: s, events };
}

/** 还在路上的货（给界面） */
export { inTransitQty };
