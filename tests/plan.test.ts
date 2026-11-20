// 任务 05：参考数字、现金计划、季末结账、季度报表、提醒、最关键的决定（docs/06）
import { describe, expect, it } from "vitest";
import { malaysia as P } from "../src/params/malaysia";
import { getProduct, products } from "../src/products/catalog";
import { createGame } from "../src/engine/game";
import { startQuarter } from "../src/engine/quarter";
import { stepDay } from "../src/engine/day";
import { answerPending } from "../src/engine/pending";
import { buildQuarterBills } from "../src/engine/bills";
import type { GameEvent } from "../src/engine/events";
import type { GameState, QuarterDecision } from "../src/engine/types";
import { referenceNumbers } from "../src/plan/reference";
import { cashPlan } from "../src/plan/cashPlan";
import { planVsActual, quarterResult, settleVerdict } from "../src/plan/report";
import { quarterCauses } from "../src/plan/causes";
import { decideReminders, playReminders } from "../src/plan/reminders";
import { keyDecision, keyDecisionRun, pickKeyQuarter } from "../src/plan/keyDecision";
import { expectedMonthly } from "../src/plan/reference";
import { netWorthFen } from "../src/engine/summary";
import type { Bill } from "../src/engine/bills";
import type { GameConfig } from "../src/engine/types";
import type { Product } from "../src/engine/product";
import { createRng, randomConfig, randomDecisions } from "./helpers/play";

const hijab = getProduct("hijab");

function decision(partial: Partial<QuarterDecision> = {}): QuarterDecision {
  return { monthlyRestockQty: 0, priceSen: 1990, adBidFen: 0, adDailyBudgetFen: 0, bulkQuotes: [], buyCompliance: false, upgradeToLocal: false, ...partial };
}

/** docs/06 第 10.1 节的状态：头巾，第 0 个季度，跨境直发，现金 320000，库存 200 */
function r1State(): GameState {
  const { state } = createGame({ seed: 1, productId: "hijab", fulfillment: "cross", startCashFen: 500000, firstStockQty: 200 }, hijab, P);
  return { ...state, cashFen: 320000, stockQty: 200 };
}

/** docs/06 第 10.2 节 X2 的状态 */
function x2State(): GameState {
  const { state } = createGame({ seed: 1, productId: "hijab", fulfillment: "local", startCashFen: 500000, firstStockQty: 100 }, hijab, P);
  const batch = (qty: number, returnedQty: number | null, settleDay: number | null) => ({
    orderDay: 0,
    fulfillment: "local" as const,
    qty,
    payoutFenEach: 2663,
    deliverDay: 3,
    returnedQty,
    settleDay,
    paid: false,
  });
  return {
    ...state,
    cashFen: 250000,
    stockQty: 100,
    payoutFrozenUntilDay: 0,
    orderBatches: [batch(10, 1, 30), batch(5, null, null), batch(8, 0, 95)],
    bulkOrders: [
      { inquiryId: "x", qty: 100, unitPriceSen: 1000, valueFen: 165000, depositFen: 49500, warnDay: 20, shipDay: 30, dueDay: 30, balanceDay: 60, status: "delivered" },
    ],
  };
}

describe("参考数字（docs/06 第 10.1 节）", () => {
  it("[G06-10.1#01] R1 头巾 第 0 季度 跨境 现金 320000 库存 200", () => {
    const r = referenceNumbers(r1State(), hijab, P);
    expect(r.expMonthly).toBe(264);
    expect(r.stockDays).toBe(22);
    expect(r.tierQty).toEqual([250, 500]);
    expect(r.refBidFen).toBe(36);
    expect(r.upgradeCostFen).toBe(116000);
    expect(r.lastMonthlyWanted).toBeNull();
  });
});

describe("现金计划（docs/06 第 10.2 节）", () => {
  it("[G06-10.2#01] X1 补货 450，预算 6400", () => {
    expect(cashPlan(r1State(), decision({ monthlyRestockQty: 450, priceSen: 1890, adBidFen: 43, adDailyBudgetFen: 6400 }), hijab, P)).toEqual({
      startFen: 320000, restockFen: 1215000, fixedFen: 90000, complianceFen: 0, upgradeFen: 0, sureOutFen: 1305000, adsMaxFen: 576000, sureInFen: 0, worstEndFen: -1561000,
    });
  });
  it("[G06-10.2#02] X2 本土店 补货 100，预算 2000，做合规，有到账和尾款", () => {
    expect(cashPlan(x2State(), decision({ monthlyRestockQty: 100, adBidFen: 20, adDailyBudgetFen: 2000, buyCompliance: true }), hijab, P)).toEqual({
      startFen: 250000, restockFen: 294000, fixedFen: 90000, complianceFen: 60000, upgradeFen: 0, sureOutFen: 444000, adsMaxFen: 180000, sureInFen: 139467, worstEndFen: -234533,
    });
  });
  it("[G06-10.2#03] X3 补货 0，预算 0，升级", () => {
    expect(cashPlan(r1State(), decision({ upgradeToLocal: true }), hijab, P)).toEqual({
      startFen: 320000, restockFen: 0, fixedFen: 90000, complianceFen: 0, upgradeFen: 116000, sureOutFen: 206000, adsMaxFen: 0, sureInFen: 0, worstEndFen: 114000,
    });
  });
  it("冻结到季末之后的货款不算", () => {
    expect(cashPlan({ ...x2State(), payoutFrozenUntilDay: 120 }, decision(), hijab, P).sureInFen).toBe(115500);
  });
});

describe("季末结账的结论（docs/06 第 10.3 节）", () => {
  const s = r1State();
  it("[G06-10.3#01] running → continue", () => expect(settleVerdict({ ...s, phase: "running" })).toBe("continue"));
  it("[G06-10.3#02] bankrupt → bankrupt", () => expect(settleVerdict({ ...s, phase: "bankrupt" })).toBe("bankrupt"));
  it("[G06-10.3#03] banned → banned", () => expect(settleVerdict({ ...s, phase: "banned" })).toBe("banned"));
  it("[G06-10.3#04] finished → finished", () => expect(settleVerdict({ ...s, phase: "finished" })).toBe("finished"));
});

/** 200 局：每个季度第一天的状态和随机的合法决定，并且真的跑完这个季度 */
function quarters(n: number) {
  const out: { start: GameState; d: QuarterDecision; end: GameState; events: GameEvent[]; idx: number }[] = [];
  for (let i = 0; i < n; i++) {
    const product = products[i % 6];
    const seed = 3000 + i * 13;
    const rng = createRng(seed);
    const config = randomConfig(rng, seed, product, P, i % 2 === 0 ? "cross" : "local");
    const decisions = randomDecisions(rng, seed, product, P, { upgradeQuarter: i % 4 === 0 ? 2 : undefined });
    let state = createGame(config, product, P).state;
    while (state.phase === "running") {
      const q = Math.floor(state.day / 90);
      const start = state;
      const d = decisions[q];
      const events: GameEvent[] = [];
      const sq = startQuarter(state, d, product, P);
      events.push(...sq.events);
      state = sq.state;
      while ((state.phase === "running" && state.day < (q + 1) * 90) || state.phase === "closing") {
        if (state.pending) {
          const r = answerPending(state, rng.next() < 0.5 ? "rush" : "ignore", product, P);
          events.push(...r.events);
          state = r.state;
          continue;
        }
        const r = stepDay(state, product, P);
        events.push(...r.events);
        state = r.state;
      }
      out.push({ start, d, end: state, events, idx: i % 6 });
    }
  }
  return out;
}

describe("另外要测试的（docs/06 第 10.4 节）", () => {
  const qs = quarters(200);
  it("1. 现金计划的各项关系成立，各项不小于 0", () => {
    expect(qs.length).toBeGreaterThan(400);
    for (const { start, d, idx } of qs) {
      const p = cashPlan(start, d, products[idx], P);
      expect(p.worstEndFen).toBe(p.startFen + p.sureInFen - p.sureOutFen - p.adsMaxFen);
      expect(p.sureOutFen).toBe(p.restockFen + p.fixedFen + p.complianceFen + p.upgradeFen);
      for (const k of ["restockFen", "fixedFen", "complianceFen", "upgradeFen", "sureOutFen", "adsMaxFen", "sureInFen"] as const) expect(p[k]).toBeGreaterThanOrEqual(0);
    }
  });
  it("2. 真的跑完这个季度：实际花掉不大于预计花掉，实际广告费不大于广告最多", () => {
    for (const { start, d, end, events, idx } of qs) {
      const q = Math.floor(start.day / 90);
      const plan = cashPlan(start, d, products[idx], P);
      const bills = buildQuarterBills(q, events, P);
      const pa = planVsActual(plan, bills, end.cashFen);
      expect(pa.actualOutFen).toBeLessThanOrEqual(pa.planOutFen);
      expect(pa.actualAdsFen).toBeLessThanOrEqual(pa.adsMaxFen);
      expect(pa.actualEndFen).toBe(end.cashFen);
    }
  });
  it("3. 最关键的决定：同一局算两次结果相同；换掉的季度确实影响结果", () => {
    for (let i = 0; i < 6; i++) {
      const product = products[i];
      const rng = createRng(77 + i);
      const config = { ...randomConfig(rng, 77 + i, product, P, "cross"), startCashFen: 2000000 };
      const decisions = randomDecisions(rng, 77 + i, product, P);
      const a = keyDecision(config, decisions, product, P);
      const b = keyDecision(config, decisions, product, P);
      expect(a).toEqual(b);
      expect(a).not.toBeNull();
      if (a) {
        expect(a.quarter).toBeGreaterThanOrEqual(0);
        expect(a.quarter).toBeLessThan(8);
      }
    }
  });
  it("3. 用 keyDecision 自己的重算：换掉的季度之前每一天都和玩家真实的那一局一样（玩家选过加急），之后用玩家的决定", () => {
    const found = findGameWithRush();
    expect(found).not.toBeNull();
    if (!found) return;
    const { config, decisions, product, real, rushQuarter } = found;
    // 不换季度重算一次，就是玩家真实的那一局
    expect(keyDecisionRun(config, decisions, product, P, null)).toEqual(real);
    const k = rushQuarter + 1;
    const days = (swap: number | null): GameState[] => {
      const out: GameState[] = [];
      keyDecisionRun(config, decisions, product, P, swap, (st) => out.push(st));
      return out;
    };
    const orig = days(null);
    const swapped = days(k);
    expect(swapped.length).toBeGreaterThan((k + 1) * 90 + 1);
    for (let d = 0; d < k * 90; d++) expect(swapped[d]).toEqual(orig[d]);
    // 换掉的季度用参考价，下一个季度回到玩家定的售价
    expect(swapped[k * 90 + 1].priceSen).toBe(product.refPriceSen);
    expect(swapped[(k + 1) * 90 + 1].priceSen).toBe(decisions[k + 1].priceSen);
    // 季度中间的选择按询价编号对上：对不上的当作"不处理"，和一个选择都没有一样
    const none = decisions.map((d) => ({ ...d, bulkShortChoices: [] }));
    const wrongId = decisions.map((d) => ({ ...d, bulkShortChoices: [{ inquiryId: "no-such-inquiry", choice: "rush" as const }] }));
    const ignoredAll = keyDecisionRun(config, none, product, P, null);
    expect(keyDecisionRun(config, wrongId, product, P, null)).toEqual(ignoredAll);
    expect(ignoredAll).not.toEqual(real);
    // keyDecision 的"玩家的净资产"就是真实那一局的
    const kd = keyDecision(config, decisions, product, P);
    expect(kd?.playerNetWorthFen).toBe(netWorthFen(real, product, P));
  });
  it("3. 一样大时取靠前的季度", () => {
    expect(pickKeyQuarter(100, [150, 50, 150])?.quarter).toBe(0);
    expect(pickKeyQuarter(100, [110, 300, -100])?.quarter).toBe(1);
    expect(pickKeyQuarter(100, [110, 120, 400])).toEqual({ quarter: 2, playerNetWorthFen: 100, referenceNetWorthFen: 400 });
    expect(pickKeyQuarter(100, [])).toBeNull();
    // 比的是变化的绝对值：变少 200 比变多 50 大
    expect(pickKeyQuarter(100, [150, -100])?.quarter).toBe(1);
  });
  it("3. 玩家没有的季度：沿用这一局上一个季度的补货量、售价和广告，不报大单、不买合规、不升级，一直算到结束", () => {
    const config = { seed: 5, productId: "hijab", fulfillment: "local" as const, startCashFen: 3000000, firstStockQty: 300 };
    const first = createGame(config, hijab, P).state;
    const q2Inquiry = first.schedule.inquiries.find((i) => i.quarter === 2);
    expect(q2Inquiry).toBeDefined();
    const base = decision({ monthlyRestockQty: 200, priceSen: 2190, adBidFen: 40, adDailyBudgetFen: 3000 });
    const decs = [
      base,
      base,
      { ...base, buyCompliance: true, upgradeToLocal: true, bulkQuotes: q2Inquiry ? [{ inquiryId: q2Inquiry.id, unitPriceSen: hijab.bulkRefPriceSen }] : [] },
    ];
    // 不换季度：第 3 个季度以后沿用玩家第 2 个季度的补货量、售价、广告；合规只在第 2 个季度买了一次
    const seen: GameState[] = [];
    const end = keyDecisionRun(config, decs, hijab, P, null, (st) => seen.push(st));
    // 一直算到这一局结束（这一局没有撑到第 720 天也算结束）
    expect(["finished", "bankrupt", "banned"]).toContain(end.phase);
    expect(seen.length).toBeGreaterThan(452);
    for (const day of [271, 451]) {
      expect(seen[day].priceSen).toBe(2190);
      expect(seen[day].monthlyRestockQty).toBe(200);
      expect(seen[day].adBidFen).toBe(40);
      expect(seen[day].adDailyBudgetFen).toBe(3000);
    }
    expect(seen[271].totals.complianceFen).toBe(P.complianceCostFen.value);
    expect(end.totals.complianceFen).toBe(P.complianceCostFen.value);
    // 换掉第 2 个季度：以后的季度沿用的是参考做法的值（参考价、不投广告）
    const swapped: GameState[] = [];
    keyDecisionRun(config, decs, hijab, P, 2, (st) => swapped.push(st));
    expect(swapped.length).toBeGreaterThan(272);
    for (const day of [181, 271]) {
      expect(swapped[day].priceSen).toBe(hijab.refPriceSen);
      expect(swapped[day].adBidFen).toBe(0);
      expect(swapped[day].adDailyBudgetFen).toBe(0);
    }
    expect(swapped[swapped.length - 1].totals.complianceFen).toBe(0);
  });
  it("4. 为什么：最多 3 条，顺序和文档一样", () => {
    const order = [
      "cause_cash_negative", "cause_bulk_default", "cause_audit", "cause_rush", "cause_stockout", "cause_bulk_reserved", "cause_ads_unspent",
      "cause_ads_loss", "cause_price_low", "cause_price_high", "cause_storage", "cause_cash_wait", "cause_push_up",
    ];
    let seen = 0;
    const kinds = new Set<string>();
    for (const { start, end, events, idx } of qs) {
      const c = quarterCauses(Math.floor(start.day / 90), events, start, end, products[idx], P);
      expect(c.length).toBeLessThanOrEqual(3);
      const pos = c.map((x) => order.indexOf(x.key));
      expect(pos.every((p) => p >= 0)).toBe(true);
      expect([...pos].sort((a, b) => a - b)).toEqual(pos);
      seen += c.length;
      for (const x of c) kinds.add(x.key);
    }
    expect(seen).toBeGreaterThan(100);
    // 13 种原因都出现过（季度中间选了加急的事件也算进这个季度）
    expect([...kinds].sort()).toEqual([...order].sort());
  });
});

describe("季度的结果和提醒", () => {
  it("quarterResult：零售、缺货、大单、推流分", () => {
    const qs = quarters(6);
    for (const { start, end, events } of qs) {
      const r = quarterResult(Math.floor(start.day / 90), events, start, end, P);
      const shipped = events.reduce((s, e) => s + (e.type === "orders_shipped" ? e.shipped : 0), 0);
      expect(r.retailShipped).toBe(shipped);
      expect(r.pushDelta).toBe(r.push - (start.pushScore.sales + start.pushScore.stock + start.pushScore.price + start.pushScore.complete + start.pushScore.speed));
    }
  });
  it("做决定时的提醒：库存不够卖 15 天", () => {
    const s = { ...r1State(), stockQty: 100 };
    expect(decideReminders(s, hijab, P)).toEqual([{ area: "purchase", key: "stockDays", day: 0, data: { days: 11 } }]);
    expect(decideReminders(r1State(), hijab, P)).toEqual([]);
  });
  it("做决定时的提醒：本土店风险不是低；有货款会到", () => {
    const s = { ...x2State(), riskPts: 45 };
    expect(decideReminders(s, hijab, P).find((r) => r.area === "finance")).toEqual({ area: "finance", key: "riskLevel", day: 0, data: { level: 1 } });
    expect(decideReminders(x2State(), hijab, P).find((r) => r.area === "finance")).toEqual({ area: "finance", key: "payoutComing", day: 0, data: { amountFen: 23967 } });
  });
  it("播放时的提醒：现金从不小于 0 变成小于 0 只提醒一次", () => {
    const ev = (day: number): GameEvent => ({ type: "restock_arrived", day, id: "R1-02", qty: 50 });
    const r = playReminders(
      [
        { events: [ev(1)], cashAfterFen: 100 },
        { events: [ev(2)], cashAfterFen: -5 },
        { events: [ev(3)], cashAfterFen: -10 },
      ],
      500,
    );
    expect(r.filter((x) => x.key === "cashNegative")).toEqual([{ area: "finance", key: "cashNegative", day: 2, data: { cashFen: -5 } }]);
    expect(r.filter((x) => x.key === "restockArrived")).toHaveLength(3);
  });
});

describe("开局第一批进货（docs/09 第五节）", () => {
  it("最多件数、默认值、要花多少", async () => {
    const { maxFirstStock, defaultFirstStock, firstStockCost, setupCards } = await import("../src/plan/setup");
    // 跨境：5000 元按 9 元一件买得起 555 件，供应商上限 800 → 555；默认一半取整到 10 → 270
    expect(maxFirstStock(500000, "cross", hijab, P)).toBe(555);
    expect(defaultFirstStock(500000, "cross", hijab, P)).toBe(270);
    // 本土店：先扣 1000 元开通费，每件 9 元加 0.8 元头程 → 408 件，默认 200
    expect(maxFirstStock(500000, "local", hijab, P)).toBe(408);
    expect(defaultFirstStock(500000, "local", hijab, P)).toBe(200);
    // 默认值不低于起订量
    expect(defaultFirstStock(60000, "cross", hijab, P)).toBe(50);
    expect(firstStockCost(500000, 300, "local", hijab, P)).toEqual({ setupFen: 100000, costFen: 280500, leftFen: 119500 });
    const cards = setupCards(123, products);
    expect(cards.map((p) => p.kind)).toEqual(["volume", "margin", "risky"]);
    expect(setupCards(123, products)).toEqual(cards);
    expect(setupCards(4294967295, products).every(Boolean)).toBe(true);
  });
});

describe("输入检查（docs/09 第五节）", () => {
  it("补货量、售价、出价、预算、大单报价", async () => {
    const { checkRestock, checkPrice, checkBid, checkBudget, checkQuote } = await import("../src/plan/inputs");
    expect(checkRestock(0, hijab).error).toBeNull();
    expect(checkRestock(30, hijab).error).toEqual({ key: "restockZeroOrMoq", data: { moq: 50 } });
    expect(checkRestock(801, hijab).error).toEqual({ key: "restockCap", data: { cap: 800 } });
    expect(checkPrice(1990, hijab, P).error).toBeNull();
    expect(checkPrice(1995, hijab, P).error?.key).toBe("priceRange");
    expect(checkPrice(2690, hijab, P).error?.key).toBe("priceRange");
    const s = r1State();
    expect(checkBid(108, s, hijab, P).error).toBeNull();
    expect(checkBid(109, s, hijab, P).error).toEqual({ key: "max", data: { fen: 108 } });
    expect(checkBid(17, s, hijab, P).hints).toEqual([{ key: "hintBid", data: {} }]);
    expect(checkBid(18, s, hijab, P).hints).toEqual([]);
    expect(checkBudget(999900).error).toBeNull();
    expect(checkBudget(1000000).error?.key).toBe("budgetMax");
    const withInquiry: GameState = { ...s, schedule: { ...s.schedule, inquiries: [{ id: "q0-1", quarter: 0, qty: 300, dueDay: 60, rivalBestSen: 1010 }] } };
    // 报价 RM 5.00 = ¥8.25，低于进价 ¥9 加运费 ¥0.80
    expect(checkQuote("q0-1", 500, 450, withInquiry, hijab, P).hints.map((h) => h.key)).toContain("hintQuote");
    // 每月补 0 件：到第 50 天要 300 件，200 − ceil(264 × 50 / 30) = −240，还差 540 件
    expect(checkQuote("q0-1", 1050, 0, withInquiry, hijab, P).hints).toEqual([{ key: "hintBulkShort", data: { day: 50, qty: 300, short: 540 } }]);
    expect(checkQuote("q0-1", 2101, 450, withInquiry, hijab, P).error).toEqual({ key: "max", data: { sen: 2100 } });
  });
});

describe("纪念海报的数字（docs/10 第九节）", () => {
  it("桶里装多少、溢出几个金币、几倍", async () => {
    const { posterNumbers } = await import("../src/plan/poster");
    // 目标净资产 ¥50,000（规则包第 9 版）
    expect(posterNumbers(2500000, P)).toEqual({ fillBp: 5000, overflow: 0, multipleE1: 5 });
    expect(posterNumbers(4999999, P)).toEqual({ fillBp: 9999, overflow: 0, multipleE1: 9 });
    expect(posterNumbers(5000000, P)).toEqual({ fillBp: 10000, overflow: 0, multipleE1: 10 });
    expect(posterNumbers(8000000, P)).toEqual({ fillBp: 10000, overflow: 6, multipleE1: 16 });
    expect(posterNumbers(99000000, P)).toEqual({ fillBp: 10000, overflow: 12, multipleE1: 198 });
    expect(posterNumbers(-200000, P)).toEqual({ fillBp: 0, overflow: 0, multipleE1: -1 });
  });
});

/** 找一局玩家在季度中间选过加急、并且加急之后至少还有两个季度的游戏（按固定的种子顺序找） */
function findGameWithRush(): { config: GameConfig; decisions: QuarterDecision[]; product: Product; real: GameState; rushQuarter: number } | null {
  for (let i = 0; i < 120; i++) {
    const product = products[i % 6];
    const seed = 900 + i;
    const rng = createRng(seed);
    const config = { ...randomConfig(rng, seed, product, P, "cross"), startCashFen: 3000000 };
    const decisions = randomDecisions(rng, seed, product, P).map((d) => ({ ...d, bulkShortChoices: [] as { inquiryId: string; choice: "rush" | "ignore" }[] }));
    let state = createGame(config, product, P).state;
    let started = -1;
    let rushQuarter = -1;
    while (state.phase === "running" || state.phase === "closing") {
      const q = Math.floor(state.day / 90);
      if (state.phase === "running" && state.day % 90 === 0 && started < q) {
        state = startQuarter(state, decisions[q], product, P).state;
        started = q;
      }
      if (state.pending) {
        decisions[q].bulkShortChoices.push({ inquiryId: state.pending.inquiryId, choice: "rush" });
        if (rushQuarter < 0) rushQuarter = q;
        state = answerPending(state, "rush", product, P).state;
        continue;
      }
      state = stepDay(state, product, P).state;
    }
    if (rushQuarter >= 0 && rushQuarter <= 4 && state.day >= 720) return { config, decisions, product, real: state, rushQuarter };
  }
  return null;
}

const ev = (o: Record<string, unknown>): GameEvent => o as unknown as GameEvent;

describe("固定数字：参考数字", () => {
  it("expMonthly：第 1 个季度以后按上个季度和季节换算，第二年的系数从第 4 个季度（第 5 季）开始", () => {
    const base = r1State();
    const at = (day: number): number => expectedMonthly({ ...base, day, quarterStats: { ...base.quarterStats, wanted: 300 } }, hijab, P);
    expect(at(90)).toBe(36); // 100 × 8000 / 22000
    expect(at(270)).toBe(144); // 100 × 13000 / 9000
    expect(at(360)).toBe(203); // 100 × 26400 / 13000
    expect(at(450)).toBe(36); // 100 × 9600 / 26400
  });
  it("stockDays 扣掉留给大单的货", () => {
    const s = r1State();
    expect(referenceNumbers(s, hijab, P).stockDays).toBe(22);
    const won = { ...x2State().bulkOrders[0], status: "won" as const, qty: 100, shipDay: 120, warnDay: 110, dueDay: 120, balanceDay: null };
    expect(referenceNumbers({ ...s, bulkOrders: [won] }, hijab, P).stockDays).toBe(11);
  });
});

describe("固定数字：现金计划", () => {
  it("跨境店选了合规不算合规费；补货按供应商上限截", () => {
    const p = cashPlan(r1State(), decision({ buyCompliance: true, monthlyRestockQty: 1000 }), hijab, P);
    expect(p.complianceFen).toBe(0);
    expect(p.restockFen).toBe(3 * 800 * 900);
  });
  it("大单尾款日正好是季末最后一天算进来，晚一天不算", () => {
    const s = r1State();
    const bulk = (balanceDay: number) => ({ ...x2State().bulkOrders[0], balanceDay });
    const base = cashPlan(s, decision(), hijab, P).sureInFen;
    expect(cashPlan({ ...s, bulkOrders: [bulk(89)] }, decision(), hijab, P).sureInFen - base).toBe(115500);
    expect(cashPlan({ ...s, bulkOrders: [bulk(90)] }, decision(), hijab, P).sureInFen - base).toBe(0);
  });
});

describe("固定数字：报表", () => {
  it("planVsActual 的实际花掉包括开通费，实际广告费只算 ads", () => {
    const bill = (kind: string, amountFen: number): Bill => ({ id: kind, day: 0, role: "finance", kind, amountFen }) as unknown as Bill;
    const plan = cashPlan(r1State(), decision(), hijab, P);
    const pa = planVsActual(plan, [bill("setup", -10000), bill("restock", -5000), bill("fixed", -900), bill("compliance", -100), bill("ads", -300), bill("payout", 999)], 1);
    expect(pa.actualOutFen).toBe(16000);
    expect(pa.actualAdsFen).toBe(300);
  });
  it("quarterResult：中了几张、交了几张，只算这个季度的", () => {
    const s = r1State();
    const events = [ev({ type: "bulk_won", day: 10 }), ev({ type: "bulk_delivered", day: 40 }), ev({ type: "bulk_delivered", day: 80 }), ev({ type: "bulk_delivered", day: 95 })];
    const r = quarterResult(0, events, s, s, P);
    expect(r.bulkWon).toBe(1);
    expect(r.bulkDelivered).toBe(2);
  });
});

describe("固定数字：做决定时的提醒", () => {
  const keys = (s: GameState): string[] => decideReminders(s, hijab, P).map((r) => r.key);
  it("够卖 15 天不提醒，14 天提醒", () => {
    expect(keys({ ...r1State(), stockQty: 132 })).not.toContain("stockDays"); // 132 × 30 / 264 = 15
    expect(keys({ ...r1State(), stockQty: 131 })).toContain("stockDays"); // 14
  });
  it("有大单这个季度要发货时只提醒大单，不再提醒够卖几天", () => {
    const won = { ...x2State().bulkOrders[0], status: "won" as const, qty: 10, shipDay: 60, warnDay: 50, dueDay: 60, balanceDay: null };
    const k = keys({ ...r1State(), stockQty: 20, bulkOrders: [won] });
    expect(k).toContain("bulkDue");
    expect(k).not.toContain("stockDays");
  });
  it("expMonthly 是 0 时估不出来，不提醒", () => {
    const s = r1State();
    const z = { ...s, day: 90, stockQty: 0, quarterStats: { ...s.quarterStats, wanted: 0 } };
    expect(expectedMonthly(z, hijab, P)).toBe(0);
    expect(keys(z)).not.toContain("stockDays");
  });
});

describe("固定数字：为什么的三个门槛", () => {
  const s = r1State();
  const causeKeys = (events: GameEvent[], end: GameState = s): string[] => quarterCauses(0, events, s, end, hijab, P).map((c) => c.key);
  const shipped = (wanted: number, lost: number) =>
    ev({ type: "orders_shipped", day: 5, organicOrders: wanted, adOrders: 0, shipped: wanted - lost, lost, perOrderFeeFen: 0, payoutFenEach: 0, demandBp: 10000 });
  it("缺货正好 5% 不算，超过才算", () => {
    expect(causeKeys([shipped(100, 5)])).not.toContain("cause_stockout");
    expect(causeKeys([shipped(100, 6)])).toContain("cause_stockout");
  });
  it("广告花掉正好 60% 不算，不到才算", () => {
    const ads = (spend: number) => ev({ type: "ads_ran", day: 5, budgetFen: 1000, adSpendFen: spend, clicks: 1, adOrders: 0, refBidFen: 0, demandBp: 10000 });
    expect(causeKeys([ads(600)])).not.toContain("cause_ads_unspent");
    expect(causeKeys([ads(599)])).toContain("cause_ads_unspent");
  });
  it("推流分高 5 分算，高 4 分不算", () => {
    const up = (n: number): GameState => ({ ...s, pushScore: { ...s.pushScore, sales: s.pushScore.sales + n } });
    expect(causeKeys([], up(5))).toContain("cause_push_up");
    expect(causeKeys([], up(4))).not.toContain("cause_push_up");
  });
});

describe("固定数字：第 10 版写明的几处", () => {
  it("开局三张卡：第 i 种取这一类里的第 ((seed >>> 0) >>> i) % 个数 个", async () => {
    const { setupCards } = await import("../src/plan/setup");
    const ids = (seed: number) => setupCards(seed, products).map((p) => p.id);
    expect(ids(0)).toEqual(["phone_case", "hijab", "blouse"]);
    expect(ids(1)).toEqual(["arm_sleeve", "hijab", "blouse"]);
    expect(ids(5)).toEqual(["arm_sleeve", "hijab", "earbuds"]);
    expect(ids(7)).toEqual(["arm_sleeve", "mini_fan", "earbuds"]);
  });
  it("第一批进货的默认值是最大件数（已经按供应商上限截过）的一半", async () => {
    const { defaultFirstStock, maxFirstStock } = await import("../src/plan/setup");
    expect(maxFirstStock(100000000, "cross", hijab, P)).toBe(800);
    expect(defaultFirstStock(100000000, "cross", hijab, P)).toBe(400);
  });
  it("收尾阶段的结论是 continue", () => {
    expect(settleVerdict({ ...r1State(), phase: "closing" })).toBe("continue");
  });
  const s = r1State();
  const keysOf = (events: GameEvent[], end: GameState) => quarterCauses(0, events, s, end, hijab, P);
  it("cause_storage：压着的货 = 季末库存 − 季末那个月发出的零售和大单", () => {
    const end: GameState = { ...s, fulfillment: "local", stockQty: 100, monthStats: { ...s.monthStats, shipped: 20, bulkUnits: 30 } };
    const c = keysOf([ev({ type: "month_started", day: 30, fixedCostFen: 0, storageFeeFen: 700, push: {} })], end).find((x) => x.key === "cause_storage");
    expect(c?.data).toEqual({ qty: 50, feeFen: 700 });
  });
  it("cause_ads_loss：每单的广告费四舍五入", () => {
    const ads = ev({ type: "ads_ran", day: 5, budgetFen: 30001, adSpendFen: 30001, clicks: 9, adOrders: 2, refBidFen: 0, demandBp: 10000 });
    const c = keysOf([ads], s).find((x) => x.key === "cause_ads_loss");
    expect(c?.data.costFen).toBe(15001);
  });
  it("cause_bulk_reserved：算上已中标、还没发货的大单", () => {
    const won = { ...x2State().bulkOrders[0], status: "won" as const, qty: 40, shipDay: 120, warnDay: 110, dueDay: 120, balanceDay: null };
    const shipped = ev({ type: "orders_shipped", day: 5, organicOrders: 100, adOrders: 0, shipped: 97, lost: 3, perOrderFeeFen: 0, payoutFenEach: 0, demandBp: 10000 });
    const c = keysOf([shipped, ev({ type: "bulk_shipped", day: 50, qty: 25 })], { ...s, bulkOrders: [won] }).find((x) => x.key === "cause_bulk_reserved");
    expect(c?.data).toEqual({ qty: 65 });
  });
});
