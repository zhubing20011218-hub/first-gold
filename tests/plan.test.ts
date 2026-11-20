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
import { keyDecision, referencePlan } from "../src/plan/keyDecision";
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
          state = answerPending(state, rng.next() < 0.5 ? "rush" : "ignore", product, P).state;
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
  it("3. 换掉的那个季度之前，重算的每一天和原来完全一样（参考做法只从那个季度开始起作用）", () => {
    const product = hijab;
    const config = { seed: 5, productId: "hijab", fulfillment: "cross" as const, startCashFen: 2000000, firstStockQty: 300 };
    const decisions = Array.from({ length: 8 }, () => decision({ monthlyRestockQty: 200, priceSen: 2190, adBidFen: 40, adDailyBudgetFen: 3000 }));
    // 第 3 个季度第一天之前，换不换第 3 个季度，状态都一样
    const runTo = (swap: boolean): GameState => {
      let s = createGame(config, product, P).state;
      let started = -1;
      while (s.day < 270) {
        const q = Math.floor(s.day / 90);
        if (s.day % 90 === 0 && started < q) {
          s = startQuarter(s, swap && q === 3 ? referencePlan(s, product, P) : decisions[q], product, P).state;
          started = q;
        }
        s = s.pending ? answerPending(s, "ignore", product, P).state : stepDay(s, product, P).state;
      }
      return s;
    };
    expect(runTo(true)).toEqual(runTo(false));
    const k = keyDecision(config, decisions, product, P);
    expect(k?.referenceNetWorthFen).not.toBe(k?.playerNetWorthFen);
  });
  it("4. 为什么：最多 3 条，顺序和文档一样", () => {
    const order = [
      "cause_cash_negative", "cause_bulk_default", "cause_audit", "cause_rush", "cause_stockout", "cause_bulk_reserved", "cause_ads_unspent",
      "cause_ads_loss", "cause_price_low", "cause_price_high", "cause_storage", "cause_cash_wait", "cause_push_up",
    ];
    let seen = 0;
    for (const { start, end, events, idx } of qs) {
      const c = quarterCauses(Math.floor(start.day / 90), events, start, end, products[idx], P);
      expect(c.length).toBeLessThanOrEqual(3);
      const pos = c.map((x) => order.indexOf(x.key));
      expect(pos.every((p) => p >= 0)).toBe(true);
      expect([...pos].sort((a, b) => a - b)).toEqual(pos);
      seen += c.length;
    }
    expect(seen).toBeGreaterThan(100);
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
    expect(posterNumbers(1500000, P)).toEqual({ fillBp: 5000, overflow: 0, multipleE1: 5 });
    expect(posterNumbers(3000000, P)).toEqual({ fillBp: 10000, overflow: 0, multipleE1: 10 });
    expect(posterNumbers(4800000, P)).toEqual({ fillBp: 10000, overflow: 6, multipleE1: 16 });
    expect(posterNumbers(99000000, P)).toEqual({ fillBp: 10000, overflow: 12, multipleE1: 330 });
    expect(posterNumbers(-200000, P)).toEqual({ fillBp: 0, overflow: 0, multipleE1: -1 });
  });
});
