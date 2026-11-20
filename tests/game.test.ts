// 任务 03 第 2 步：createGame、startQuarter、stepDay、answerPending（docs/04 第十、十六节）
import { describe, expect, it } from "vitest";
import { malaysia as P } from "../src/params/malaysia";
import { getProduct } from "../src/products/catalog";
import { createGame, reservedQty } from "../src/engine/game";
import { startQuarter } from "../src/engine/quarter";
import { stepDay } from "../src/engine/day";
import { answerPending } from "../src/engine/pending";
import { restockCostFen } from "../src/engine/stock";
import type { GameEvent } from "../src/engine/events";
import type { Fulfillment, GameState, MidChoice, QuarterDecision } from "../src/engine/types";

const hijab = getProduct("hijab");

function decision(partial: Partial<QuarterDecision> = {}): QuarterDecision {
  return {
    monthlyRestockQty: 0,
    priceSen: hijab.refPriceSen,
    adBidFen: 0,
    adDailyBudgetFen: 0,
    bulkQuotes: [],
    buyCompliance: false,
    upgradeToLocal: false,
    ...partial,
  };
}

// 测试场景默认给足启动资金，避免自动补货把钱花光、第 0 天就倒闭
function newGame(fulfillment: Fulfillment, firstStockQty = 300, seed = 11, startCashFen = 2000000) {
  return createGame({ seed, productId: "hijab", fulfillment, startCashFen, firstStockQty }, hijab, P);
}

/**
 * 往前走到 toDay（不含）或停下来要选择。每个季度第一天用 decide(q, state) 的决定。
 * onPending 给出时自动回答。
 */
function advance(
  start: GameState,
  toDay: number,
  decide: (q: number, s: GameState) => QuarterDecision,
  onPending?: MidChoice,
  startedQuarter = -1,
): { state: GameState; events: GameEvent[]; started: number } {
  let state = start;
  let started = startedQuarter;
  const events: GameEvent[] = [];
  while ((state.phase === "running" || state.phase === "closing") && state.day < toDay) {
    const q = Math.floor(state.day / 90);
    if (state.phase === "running" && state.day % 90 === 0 && started < q) {
      const r = startQuarter(state, decide(q, state), hijab, P);
      state = r.state;
      events.push(...r.events);
      started = q;
    }
    if (state.pending !== null) {
      if (!onPending) break;
      const r = answerPending(state, onPending, hijab, P);
      state = r.state;
      events.push(...r.events);
      continue;
    }
    const r = stepDay(state, hijab, P);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events, started };
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

describe("createGame", () => {
  it("跨境直发不扣开通费，只付第一批货", () => {
    const { state, events } = newGame("cross", 300, 11, 500000);
    expect(state.cashFen).toBe(500000 - 256500);
    expect(state.totals.setupFeeFen).toBe(0);
    expect(state.stockQty).toBe(300);
    expect(state.riskPts).toBe(0);
    expect(events.map((e) => e.type)).toEqual(["restock_ordered"]);
  });
  it("本土店先付开通费，再付第一批货（含头程运费）", () => {
    const { state, events } = newGame("local", 300, 11, 500000);
    const first = restockCostFen(300, "local", hijab, P);
    expect(first.headHaulFen).toBe(24000);
    expect(state.cashFen).toBe(500000 - 100000 - 256500 - 24000);
    expect(state.totals.setupFeeFen).toBe(100000);
    expect(state.totals.restockFen).toBe(280500);
    expect(state.riskPts).toBe(P.riskStartPts.value);
    expect(events.map((e) => e.type)).toEqual(["setup_paid", "restock_ordered"]);
  });
  it("第一批货的编号是 R1-01", () => {
    const { events } = newGame("cross", 300);
    expect(events[0]).toMatchObject({ type: "restock_ordered", id: "R1-01", qty: 300 });
  });
  it("firstStockQty 不合法或钱不够时抛出错误", () => {
    expect(() => newGame("cross", 49)).toThrow(/firstStockQty/);
    expect(() => newGame("cross", 801)).toThrow(/firstStockQty/);
    expect(() => newGame("cross", 100.5)).toThrow(/firstStockQty/);
    expect(() => newGame("local", 500, 1, 400000)).toThrow(/not enough cash/);
    expect(() => createGame({ seed: 1, productId: "earbuds", fulfillment: "cross", startCashFen: 500000, firstStockQty: 100 }, hijab, P)).toThrow(/productId/);
  });
});

describe("startQuarter", () => {
  it("不在季度第一天调用时抛出错误", () => {
    const { state } = newGame("cross");
    const r = startQuarter(state, decision(), hijab, P);
    const s1 = stepDay(r.state, hijab, P).state;
    expect(() => startQuarter(s1, decision(), hijab, P)).toThrow(/first day of a quarter/);
  });
  it("决定不合法时抛出错误", () => {
    const { state } = newGame("cross");
    expect(() => startQuarter(state, decision({ priceSen: 1995 }), hijab, P)).toThrow(/priceSen/);
    expect(() => startQuarter(state, decision({ priceSen: 2690 }), hijab, P)).toThrow(/priceSen/);
    expect(() => startQuarter(state, decision({ monthlyRestockQty: 10 }), hijab, P)).toThrow(/monthlyRestockQty/);
    expect(() => startQuarter(state, decision({ adBidFen: -1 }), hijab, P)).toThrow(/adBidFen/);
    expect(() => startQuarter(state, decision({ bulkQuotes: [{ inquiryId: "q1-1", unitPriceSen: 1000 }] }), hijab, P)).toThrow(/quarter/);
  });
  it("升级之后：库存变成路上的补货，fulfillment 变成 local，风险值从起点开始", () => {
    const { state } = newGame("cross", 300);
    const r = startQuarter(state, decision({ upgradeToLocal: true }), hijab, P);
    expect(r.state.fulfillment).toBe("local");
    expect(r.state.stockQty).toBe(0);
    expect(r.state.riskPts).toBe(P.riskStartPts.value);
    const moved = r.state.restockBatches.find((b) => b.id === "UP1");
    expect(moved).toMatchObject({ qty: 300, arriveDay: P.headHaulDays.value });
    expect(r.state.cashFen).toBe(state.cashFen - 100000 - 24000);
    expect(r.events[0]).toMatchObject({ type: "upgraded", feeFen: 100000, moveFreightFen: 24000, movedQty: 300 });
  });
  it("钱不够时升级失败，并有事件", () => {
    const { state } = newGame("cross", 500, 1, 420000);
    expect(state.cashFen).toBe(15000);
    const r = startQuarter(state, decision({ upgradeToLocal: true }), hijab, P);
    expect(r.state.fulfillment).toBe("cross");
    expect(r.state.cashFen).toBe(state.cashFen);
    expect(r.events[0]).toMatchObject({ type: "upgrade_failed" });
  });
  it("不修改传进来的状态", () => {
    const { state } = newGame("cross");
    deepFreeze(state);
    expect(() => startQuarter(state, decision({ upgradeToLocal: true }), hijab, P)).not.toThrow();
  });
});

describe("stepDay：补货", () => {
  it("每个月初补一次", () => {
    const g = newGame("cross", 300);
    const r = advance(g.state, 180, () => decision({ monthlyRestockQty: 100 }));
    const orders = r.events.filter((e) => e.type === "restock_ordered");
    expect(orders.map((e) => e.day)).toEqual([0, 30, 60, 90, 120, 150]);
    expect(orders.map((e) => (e.type === "restock_ordered" ? e.id : ""))).toEqual(["R1-02", "R1-03", "R1-04", "R2-01", "R2-02", "R2-03"]);
  });
  it("超过供应商上限时件数被减少，并且有 restock_reduced 事件", () => {
    const g = newGame("cross", 100, 3, 2000000);
    const r = advance(g.state, 1, () => decision({ monthlyRestockQty: 1000 }));
    expect(r.events.find((e) => e.type === "restock_reduced")).toMatchObject({ wantedQty: 1000, actualQty: 800 });
    expect(r.events.find((e) => e.type === "restock_ordered" && e.day === 0 && e.id !== "R1-01")).toMatchObject({ qty: 800 });
  });
  it("钱不够时件数被减少到买得起的；低于起订量就不补", () => {
    const g = newGame("cross", 100, 3, 200000);
    // 开局后现金 110000，月初扣固定开支 30000，剩 80000，买得起 88 件
    const r = advance(g.state, 1, () => decision({ monthlyRestockQty: 300 }));
    expect(r.events.find((e) => e.type === "restock_reduced")).toMatchObject({ wantedQty: 300, actualQty: 88 });
    const g2 = newGame("cross", 100, 3, 150000);
    // 开局后 60000，扣固定开支剩 30000，只买得起 33 件，低于起订量 50
    const r2 = advance(g2.state, 1, () => decision({ monthlyRestockQty: 300 }));
    expect(r2.events.find((e) => e.type === "restock_reduced")).toMatchObject({ wantedQty: 300, actualQty: 0 });
    expect(r2.events.filter((e) => e.type === "restock_ordered")).toHaveLength(0);
  });
  it("跨境直发 3 天到货，本土店 13 天", () => {
    const c = advance(newGame("cross").state, 20, () => decision({ monthlyRestockQty: 100 }));
    expect(c.events.find((e) => e.type === "restock_arrived")?.day).toBe(3);
    const l = advance(newGame("local").state, 20, () => decision({ monthlyRestockQty: 100 }));
    expect(l.events.find((e) => e.type === "restock_arrived")?.day).toBe(13);
  });
});

describe("stepDay：送达和到账", () => {
  it("跨境直发送达 7 到 12 天（没有延误时），签收后第 15 天到账", () => {
    const r = advance(newGame("cross", 500).state, 200, () => decision({ monthlyRestockQty: 100 }));
    const delays = r.events.filter((e) => e.type === "event_delay").map((e) => e.day);
    const delivered = r.events.filter((e) => e.type === "orders_delivered");
    expect(delivered.length).toBeGreaterThan(20);
    for (const e of delivered) {
      if (e.type !== "orders_delivered") continue;
      const affected = delays.some((d) => d >= e.orderDay && d <= e.day);
      const days = e.day - e.orderDay;
      if (!affected) {
        expect(days).toBeGreaterThanOrEqual(7);
        expect(days).toBeLessThanOrEqual(12);
      }
      expect(e.settleDay - e.day).toBe(15);
    }
    for (const e of r.events) {
      if (e.type !== "payout_received") continue;
      const d = delivered.find((x) => x.type === "orders_delivered" && x.orderDay === e.orderDay);
      expect(d && d.type === "orders_delivered" ? d.settleDay : -1).toBe(e.day);
    }
  });
  it("本土店 3 天送达，签收后第 7 天到账", () => {
    const r = advance(newGame("local", 500).state, 120, () => decision({ monthlyRestockQty: 100 }));
    const delivered = r.events.filter((e) => e.type === "orders_delivered");
    expect(delivered.length).toBeGreaterThan(20);
    for (const e of delivered) {
      if (e.type !== "orders_delivered") continue;
      expect(e.day - e.orderDay).toBe(3);
      expect(e.settleDay - e.day).toBe(7);
    }
  });
  it("不修改传进来的状态", () => {
    const r = advance(newGame("cross", 300).state, 40, () => decision({ monthlyRestockQty: 100 }));
    deepFreeze(r.state);
    expect(() => advance(r.state, 80, () => decision(), undefined, 0)).not.toThrow();
  });
});

/** 走到第 90 天，第二个季度对第一张询价单按对手的价报价（一定中标） */
function toBulkQuarter(fulfillment: Fulfillment, restockQ0: number, restockQ1: number, firstStock = 300) {
  const r0 = advance(newGame(fulfillment, firstStock).state, 90, () => decision({ monthlyRestockQty: restockQ0 }));
  const inquiry = r0.state.schedule.inquiries.find((i) => i.quarter === 1);
  if (!inquiry) throw new Error("no inquiry in quarter 1");
  const r1 = startQuarter(
    r0.state,
    decision({ monthlyRestockQty: restockQ1, bulkQuotes: [{ inquiryId: inquiry.id, unitPriceSen: inquiry.rivalBestSen }] }),
    hijab,
    P,
  );
  return { state: r1.state, events: [...r0.events, ...r1.events], inquiry };
}

describe("大单", () => {
  it("中标收定金；零售不卖留给大单的货", () => {
    const { state, inquiry, events } = toBulkQuarter("cross", 300, 300);
    const bulk = state.bulkOrders[0];
    expect(events.find((e) => e.type === "bulk_won")).toMatchObject({ inquiryId: inquiry.id, depositFen: bulk.depositFen });
    let s = state;
    const evs: GameEvent[] = [];
    while (s.day < bulk.shipDay) {
      if (s.pending) s = answerPending(s, "ignore", hijab, P).state;
      const r = stepDay(s, hijab, P);
      const before = s;
      s = r.state;
      evs.push(...r.events);
      const shipped = r.events.find((e) => e.type === "orders_shipped");
      if (shipped && shipped.type === "orders_shipped" && shipped.shipped > 0 && before.stockQty >= reservedQty(before)) {
        expect(s.stockQty).toBeGreaterThanOrEqual(reservedQty(s));
      }
    }
  });
  it("按时发货：付运费，dueDay 交货、信誉加 2，dueDay + 30 收到尾款", () => {
    const { state } = toBulkQuarter("cross", 500, 500, 500);
    const bulk = state.bulkOrders[0];
    const r = advance(state, bulk.dueDay + 31, () => decision(), "ignore", 1);
    const shipped = r.events.find((e) => e.type === "bulk_shipped");
    expect(shipped).toMatchObject({ day: bulk.shipDay, freightFen: Math.ceil((bulk.qty * 100 * 800) / 1000) });
    expect(r.events.find((e) => e.type === "bulk_delivered")).toMatchObject({ day: bulk.dueDay, bulkRep: 2 });
    expect(r.events.find((e) => e.type === "bulk_paid")).toMatchObject({
      day: bulk.dueDay + 30,
      amountFen: bulk.valueFen - bulk.depositFen,
    });
    expect(r.state.bulkOrders[0].status).toBe("paid");
  });
  it("货不够时：检查那天 stepDay 停下来，pending 有值，day 不变；再调用 stepDay 状态不变", () => {
    const { state } = toBulkQuarter("cross", 0, 0, 60);
    const bulk = state.bulkOrders[0];
    const r = advance(state, 720, () => decision(), undefined, 1);
    expect(r.state.day).toBe(bulk.warnDay);
    expect(r.state.pending).toMatchObject({ kind: "bulk_short", inquiryId: bulk.inquiryId });
    expect(r.events.at(-1)).toMatchObject({ type: "bulk_short" });
    const again = stepDay(r.state, hijab, P);
    expect(again.state).toBe(r.state);
    expect(again.events).toEqual([]);
  });
  it("选加急补货：货在发货前到，大单不违约", () => {
    const { state } = toBulkQuarter("cross", 0, 0, 60);
    const bulk = state.bulkOrders[0];
    const r = advance(state, bulk.dueDay + 1, () => decision(), "rush", 1);
    const rush = r.events.find((e) => e.type === "rush_ordered");
    expect(rush).toBeTruthy();
    if (rush && rush.type === "rush_ordered") expect(rush.arriveDay).toBeLessThanOrEqual(bulk.shipDay);
    expect(r.events.some((e) => e.type === "bulk_defaulted")).toBe(false);
    expect(r.state.bulkOrders[0].status).toBe("delivered");
    expect(r.state.midChoices[bulk.inquiryId]).toBe("rush");
  });
  it("选不处理：到发货那天违约，退定金、赔违约金、信誉不低于 0", () => {
    const { state } = toBulkQuarter("cross", 0, 0, 60);
    const bulk = state.bulkOrders[0];
    const r = advance(state, bulk.shipDay + 1, () => decision(), "ignore", 1);
    const penalty = Math.floor((bulk.valueFen * 2000 + 5000) / 10000);
    expect(r.events.find((e) => e.type === "bulk_defaulted")).toMatchObject({
      day: bulk.shipDay,
      depositFen: bulk.depositFen,
      penaltyFen: penalty,
      bulkRep: 0,
    });
    expect(r.state.totals.bulkOutFen).toBe(bulk.depositFen + penalty);
    expect(r.state.quarterStats.bulkDefaults).toBe(1);
  });
  it("answerPending：没有在等选择时抛出错误；加急补货付不起时抛出错误", () => {
    const { state } = newGame("cross");
    expect(() => answerPending(state, "rush", hijab, P)).toThrow(/pending/);
    const poor: GameState = { ...state, cashFen: 0, pending: { kind: "bulk_short", inquiryId: "q1-1", shortQty: 100 } };
    expect(() => answerPending(poor, "rush", hijab, P)).toThrow(/not enough cash/);
  });
});

describe("本土店的风险", () => {
  // 本土店、从不做合规、其他都正常：补货跟得上，不缺货
  const steady = () => decision({ monthlyRestockQty: 150 });
  it("先被审核一次，之后被封店；审核期间没有平台货款到账；封店时没到账的货款拿回一半", () => {
    const r = advance(newGame("local", 300).state, 800, steady);
    const audit = r.events.find((e) => e.type === "audit_started");
    const ban = r.events.find((e) => e.type === "banned");
    expect(audit).toBeTruthy();
    expect(ban).toBeTruthy();
    if (!audit || audit.type !== "audit_started" || !ban || ban.type !== "banned") return;
    expect(ban.day).toBeGreaterThan(audit.day);
    expect(r.state.phase).toBe("banned");
    const paidDuringAudit = r.events.filter(
      (e) => e.type === "payout_received" && !e.banned && e.day > audit.day && e.day < audit.frozenUntilDay,
    );
    expect(paidDuringAudit).toEqual([]);
    // 封店时拿回的：每一批按 applyBp(件数 × 每单打款, 5000)
    const banPays = r.events.filter((e) => e.type === "payout_received" && e.banned);
    expect(banPays.length).toBeGreaterThan(0);
    const total = banPays.reduce((s, e) => s + (e.type === "payout_received" ? e.amountFen : 0), 0);
    expect(ban.recoveredFen).toBe(total);
    expect(r.state.orderBatches.every((b) => b.paid)).toBe(true);
  });
  it("一直是跨境直发：没有审核和封店，风险值一直是 0", () => {
    const r = advance(newGame("cross", 300).state, 900, () => decision({ monthlyRestockQty: 150 }), "ignore");
    expect(r.events.some((e) => e.type === "audit_started" || e.type === "banned" || e.type === "risk_updated")).toBe(false);
    expect(r.state.riskPts).toBe(0);
  });
  it("每个季度做合规，风险降下来，不会被封店", () => {
    const r = advance(newGame("local", 300).state, 900, () => decision({ monthlyRestockQty: 150, buyCompliance: true }), "ignore");
    expect(r.events.some((e) => e.type === "banned")).toBe(false);
    expect(r.events.filter((e) => e.type === "compliance_bought").length).toBeGreaterThan(0);
  });
});
