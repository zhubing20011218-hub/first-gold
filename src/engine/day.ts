// 每一天（docs/04 第 10.2 节）。顺序不能变。
// 做法：开头把状态浅拷贝一份，数组也拷贝；数组里的元素要改时换成新对象。传进来的状态不会被改动。
import { runAdAuction } from "./ads";
import { dayRng, roundMilli } from "./dayRng";
import type { GameEvent } from "./events";
import { nextRestockId, reservedQty, type StepResult } from "./game";
import { marketOfDay, organicMilliSteps, priceFactorBp, ratingFactorBp } from "./market";
import { applyBp } from "./money";
import { checkBulkStock } from "./pending";
import type { Product } from "./product";
import { computePushScore, emptyMonthStats, pricePoints, pushBpOf } from "./push";
import { settleOrder } from "./settle";
import { affordableQty, headHaulFen, restockCostFen, storageFeeFen } from "./stock";
import type { GameState } from "./types";
import { riskLevel } from "./summary";
import type { Params } from "./util";

function copyForDay(state: GameState): GameState {
  return {
    ...state,
    totals: { ...state.totals },
    monthStats: { ...state.monthStats },
    quarterStats: { ...state.quarterStats },
    orderBatches: state.orderBatches.slice(),
    restockBatches: state.restockBatches.slice(),
    bulkOrders: state.bulkOrders.slice(),
  };
}

/** 1. 月初 */
function monthStart(s: GameState, product: Product, params: Params, events: GameEvent[]): void {
  const day = s.day;
  // 1.1 评分慢慢恢复
  if (s.ratingE1 < params.initialRatingE1.value) s.ratingE1 += 1;
  // 1.2 固定开支
  const fixedCostFen = params.monthlyFixedCostFen.value;
  s.cashFen -= fixedCostFen;
  s.totals.fixedCostFen += fixedCostFen;
  // 1.3 仓储费（只对本土店，第 0 天不收）
  let storage = 0;
  if (s.fulfillment === "local" && day !== 0) {
    storage = storageFeeFen(s.stockQty, s.monthStats.shipped + s.monthStats.bulkUnits, product, params).feeFen;
    s.cashFen -= storage;
    s.totals.storageFen += storage;
  }
  // 1.4 推流分，然后统计清零
  const push = computePushScore(s.monthStats, day !== 0, s.priceSen, s.fulfillment, product, params);
  s.pushScore = { sales: push.sales, stock: push.stock, price: push.price, complete: push.complete, speed: push.speed };
  s.monthStats = emptyMonthStats();
  events.push({ type: "month_started", day, fixedCostFen, storageFeeFen: storage, push });

  // 1.5 自动补货
  const wantedQty = s.monthlyRestockQty;
  if (wantedQty > 0) {
    const capQty = product.supplierMonthlyCap;
    const canQty = affordableQty(s.cashFen, s.fulfillment, product, params);
    let qty = Math.min(wantedQty, capQty, canQty);
    if (qty < product.moq) qty = 0;
    if (qty !== wantedQty) {
      events.push({ type: "restock_reduced", day, wantedQty, actualQty: qty, capQty, affordableQty: canQty });
    }
    if (qty > 0) {
      const cost = restockCostFen(qty, s.fulfillment, product, params);
      const lead =
        s.fulfillment === "cross"
          ? params.supplierLeadDays.value
          : params.supplierLeadDays.value + params.headHaulDays.value;
      const id = nextRestockId(s, day);
      const arriveDay = day + lead;
      s.cashFen -= cost.totalFen;
      s.totals.restockFen += cost.totalFen;
      s.totals.unitsBought += qty;
      s.restockBatches.push({ id, orderDay: day, qty, unitCostFen: cost.unitCostFen, arriveDay, rush: false });
      events.push({
        type: "restock_ordered",
        day,
        id,
        qty,
        unitCostFen: cost.unitCostFen,
        discountBp: cost.discountBp,
        goodsFen: cost.goodsFen,
        headHaulFen: cost.headHaulFen,
        totalFen: cost.totalFen,
        arriveDay,
      });
    }
  }
}

/** 3. 安排好的运输延误和差评 */
function scheduledEvents(s: GameState, params: Params, events: GameEvent[]): void {
  const day = s.day;
  if (s.schedule.delayDays.includes(day)) {
    const delay = params.delayDays.value;
    if (s.fulfillment === "cross") {
      s.orderBatches = s.orderBatches.map((b) =>
        b.returnedQty === null && b.deliverDay >= day ? { ...b, deliverDay: b.deliverDay + delay } : b,
      );
    } else {
      s.restockBatches = s.restockBatches.map((b) => (b.arriveDay > day ? { ...b, arriveDay: b.arriveDay + delay } : b));
    }
    s.monthStats.delayed = true;
    events.push({ type: "event_delay", day, delayDays: delay });
  }
  if (s.schedule.badReviewDays.includes(day)) {
    s.ratingE1 = Math.max(params.ratingMinE1.value, s.ratingE1 - params.badReviewDropE1.value);
    s.quarterStats.badReviews += 1;
    events.push({ type: "event_bad_review", day, ratingE1: s.ratingE1 });
  }
}

/** 4. 大单：先发货，再交货，再收尾款 */
function bulkDay(s: GameState, product: Product, params: Params, events: GameEvent[]): void {
  const day = s.day;
  s.bulkOrders = s.bulkOrders.map((b) => {
    if (b.status !== "won" || b.shipDay !== day) return b;
    if (s.stockQty >= b.qty) {
      s.stockQty -= b.qty;
      const freightFen = s.fulfillment === "cross" ? headHaulFen(b.qty, product, params) : 0;
      s.cashFen -= freightFen;
      s.totals.bulkOutFen += freightFen;
      s.totals.bulkUnits += b.qty;
      s.monthStats.bulkUnits += b.qty;
      events.push({ type: "bulk_shipped", day, inquiryId: b.inquiryId, qty: b.qty, freightFen });
      return { ...b, status: "shipped" };
    }
    // 违约：退定金、赔违约金、信誉下降。不做部分交货
    const penaltyFen = applyBp(b.valueFen, params.bulkPenaltyBp.value);
    s.cashFen -= b.depositFen + penaltyFen;
    s.totals.bulkOutFen += b.depositFen + penaltyFen;
    s.totals.bulkDefaulted += 1;
    s.bulkRep = Math.max(0, s.bulkRep - params.bulkRepLoss.value);
    s.quarterStats.bulkDefaults += 1;
    events.push({ type: "bulk_defaulted", day, inquiryId: b.inquiryId, depositFen: b.depositFen, penaltyFen, bulkRep: s.bulkRep });
    return { ...b, status: "defaulted" };
  });
  s.bulkOrders = s.bulkOrders.map((b) => {
    if (b.status !== "shipped" || b.dueDay !== day) return b;
    const balanceDay = b.dueDay + params.bulkBalanceDays.value;
    s.bulkRep = Math.min(params.bulkRepMax.value, s.bulkRep + params.bulkRepGain.value);
    s.totals.bulkDelivered += 1;
    events.push({ type: "bulk_delivered", day, inquiryId: b.inquiryId, balanceDay, bulkRep: s.bulkRep });
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
}

/** 6、7. 零售订单和发货 */
function retailDay(s: GameState, product: Product, params: Params, events: GameEvent[], refBidFen: number, demandBp: number): void {
  const day = s.day;
  const seed = s.config.seed;
  // 价格那一项跟着当前售价变
  const push = pushBpOf({ ...s.pushScore, price: pricePoints(s.priceSen, product) }, params);
  const pf = priceFactorBp(s.priceSen, product, params);
  const rf = ratingFactorBp(s.ratingE1, params);

  // 6.2 自然订单
  const m = organicMilliSteps(product, demandBp, push.pushBp, pf, rf)[4];
  const organicOrders = roundMilli(m, dayRng(seed, day, 2));

  // 6.3 广告
  const ad = runAdAuction(
    { adBidFen: s.adBidFen, adDailyBudgetFen: s.adDailyBudgetFen, cashFen: s.cashFen, demandBp, refBidFen, pushBp: push.pushBp },
    product,
    params,
  );
  const adOrders = roundMilli(applyBp(applyBp(ad.m, pf), rf), dayRng(seed, day, 3));
  s.cashFen -= ad.adSpendFen;
  s.totals.adSpendFen += ad.adSpendFen;
  s.totals.adClicks += ad.clicks;
  if (s.adBidFen > 0 && s.adDailyBudgetFen > 0) {
    events.push({
      type: "ads_ran",
      day,
      budgetFen: s.adDailyBudgetFen,
      adSpendFen: ad.adSpendFen,
      clicks: ad.clicks,
      adOrders,
      refBidFen,
    });
  }

  // 7. 零售发货，不动留给大单的货
  const wanted = organicOrders + adOrders;
  const shipped = Math.min(wanted, Math.max(0, s.stockQty - reservedQty(s)));
  const lost = wanted - shipped;
  const perOrderFeeFen = s.fulfillment === "cross" ? params.crossForwarderFeeFen.value : params.localLabelFeeFen.value;
  s.stockQty -= shipped;
  s.cashFen -= shipped * perOrderFeeFen;
  s.totals.perOrderFeeFen += shipped * perOrderFeeFen;
  s.totals.ordersShipped += shipped;
  s.totals.lostSales += lost;
  let payoutFenEach = 0;
  if (shipped > 0) {
    payoutFenEach = settleOrder(
      { fulfillment: s.fulfillment, priceSen: s.priceSen, weightG: product.weightG, region: "west", creatorBp: 0, joinCashback: false },
      params,
    ).payoutFen;
    const deliverDay =
      s.fulfillment === "cross"
        ? day + dayRng(seed, day, 4).int(params.crossDeliveryMinDays.value, params.crossDeliveryMaxDays.value)
        : day + params.localDeliveryDays.value;
    s.orderBatches.push({
      orderDay: day,
      fulfillment: s.fulfillment,
      qty: shipped,
      payoutFenEach,
      deliverDay,
      returnedQty: null,
      settleDay: null,
      paid: false,
    });
  }
  s.monthStats.wanted += wanted;
  s.monthStats.shipped += shipped;
  s.monthStats.lost += lost;
  s.quarterStats.wanted += wanted;
  s.quarterStats.lost += lost;
  if (wanted > 0) {
    events.push({ type: "orders_shipped", day, organicOrders, adOrders, shipped, lost, perOrderFeeFen, payoutFenEach });
  }
}

/** 8、9. 签收和到账 */
function deliverAndPay(s: GameState, product: Product, params: Params, events: GameEvent[]): void {
  const day = s.day;
  s.orderBatches = s.orderBatches.map((b) => {
    if (b.deliverDay !== day || b.returnedQty !== null) return b;
    const rng = dayRng(s.config.seed, b.orderDay, 5);
    let returned = 0;
    for (let i = 0; i < b.qty; i++) if (rng.int(0, 9999) < product.returnBp) returned++;
    const settleDay = day + (b.fulfillment === "cross" ? params.crossSettleDays.value : params.localSettleDays.value);
    s.monthStats.delivered += b.qty;
    s.monthStats.returned += returned;
    s.totals.ordersReturned += returned;
    events.push({ type: "orders_delivered", day, orderDay: b.orderDay, delivered: b.qty, returned, settleDay });
    return { ...b, returnedQty: returned, settleDay };
  });
  if (day < s.payoutFrozenUntilDay) return;
  s.orderBatches = s.orderBatches.map((b) => {
    if (b.paid || b.settleDay === null || b.settleDay > day || b.returnedQty === null) return b;
    const orders = b.qty - b.returnedQty;
    const amountFen = orders * b.payoutFenEach;
    s.cashFen += amountFen;
    s.totals.payoutFen += amountFen;
    events.push({ type: "payout_received", day, orderDay: b.orderDay, amountFen, orders, banned: false });
    return { ...b, paid: true };
  });
}

/** 10. 季末：本土店的风险（docs/04 第八节） */
function quarterEndRisk(s: GameState, params: Params, events: GameEvent[]): void {
  const day = s.day;
  const q = Math.floor(day / 90);
  const qs = s.quarterStats;
  let risk = s.riskPts;
  risk += dayRng(s.config.seed, q, 7).int(params.riskQuarterMinPts.value, params.riskQuarterMaxPts.value);
  if (qs.lost * 10000 > qs.wanted * params.riskStockoutBp.value) risk += params.riskStockoutPts.value;
  risk += qs.badReviews * params.riskBadReviewPts.value;
  risk += qs.bulkDefaults * params.riskBulkDefaultPts.value;
  risk = Math.min(100, risk);
  s.riskPts = risk;
  events.push({ type: "risk_updated", day, riskPts: risk, level: riskLevel(risk, params) });
  if (risk < params.riskHighPts.value) return;
  if (s.auditCount === 0) {
    s.payoutFrozenUntilDay = day + 1 + params.auditFreezeDays.value;
    s.riskPts = Math.max(0, s.riskPts - params.auditReliefPts.value);
    s.auditCount = 1;
    events.push({ type: "audit_started", day, frozenUntilDay: s.payoutFrozenUntilDay, riskPts: s.riskPts });
    return;
  }
  // 封店：没到账的货款拿回一部分，这一局结束
  let recoveredFen = 0;
  s.orderBatches = s.orderBatches.map((b) => {
    if (b.paid) return b;
    const orders = b.qty - (b.returnedQty ?? 0);
    const amountFen = applyBp(orders * b.payoutFenEach, params.banPayoutBp.value);
    recoveredFen += amountFen;
    events.push({ type: "payout_received", day, orderDay: b.orderDay, amountFen, orders, banned: true });
    return { ...b, paid: true };
  });
  s.cashFen += recoveredFen;
  s.totals.payoutFen += recoveredFen;
  s.phase = "banned";
  events.push({ type: "banned", day, recoveredFen });
}

export function stepDay(state: GameState, product: Product, params: Params): StepResult {
  if (state.phase !== "running" && state.phase !== "closing") {
    throw new Error(`stepDay called after the game ended (phase ${state.phase})`);
  }
  // 等玩家选择时，状态不变
  if (state.pending !== null) return { state, events: [] };

  // 0. 检查大单的货
  const check = checkBulkStock(state, product, params);
  if (check.paused) return { state: check.state, events: check.events };

  const s = copyForDay(check.state);
  const events: GameEvent[] = [...check.events];
  const day = s.day;
  const running = s.phase === "running";

  if (running && day % 30 === 0) monthStart(s, product, params, events); // 1
  // 2. 到货
  for (const b of s.restockBatches) {
    if (b.arriveDay === day) {
      s.stockQty += b.qty;
      events.push({ type: "restock_arrived", day, id: b.id, qty: b.qty });
    }
  }
  scheduledEvents(s, params, events); // 3
  bulkDay(s, product, params, events); // 4
  const market = marketOfDay(s.config.seed, day, product, params); // 5
  if (running) retailDay(s, product, params, events, market.refBidFen, market.demandBp); // 6、7
  deliverAndPay(s, product, params, events); // 8、9
  if (running && s.fulfillment === "local" && day % 90 === 89) quarterEndRisk(s, params, events); // 10

  // 11. 检查（封店、倒闭之后这一局结束，但这一天照样算过完，day 照样加 1）
  if (s.phase !== "banned" && s.cashFen < 0) {
    s.phase = "bankrupt";
    events.push({ type: "bankrupt", day, cashFen: s.cashFen });
  }
  if (s.phase === "running" && day === params.quartersPerGame.value * 90 - 1) {
    s.phase = "closing";
    events.push({ type: "closing_started", day });
  }
  if (
    s.phase === "closing" &&
    s.orderBatches.every((b) => b.paid) &&
    s.bulkOrders.every((b) => b.status === "paid" || b.status === "defaulted")
  ) {
    s.phase = "finished";
    events.push({ type: "finished", day, cashFen: s.cashFen });
  }
  // 12.
  s.day = day + 1;
  return { state: s, events };
}
