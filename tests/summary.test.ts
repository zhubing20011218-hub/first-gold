// 任务 03 第 3 步：replay、netWorthFen、riskLevel、账单的三个函数（docs/04 第十一、十三、十七节）
import { describe, expect, it } from "vitest";
import { malaysia as P } from "../src/params/malaysia";
import { getProduct } from "../src/products/catalog";
import { createGame } from "../src/engine/game";
import { carryOver, netWorthFen, riskLevel } from "../src/engine/summary";
import { buildQuarterBills, verifyQuarter, type Bill } from "../src/engine/bills";
import { replay } from "../src/engine/replay";
import type { GameEvent } from "../src/engine/events";
import type { QuarterDecision } from "../src/engine/types";

const hijab = getProduct("hijab");
const steady: QuarterDecision = {
  monthlyRestockQty: 150,
  priceSen: 1990,
  adBidFen: 30,
  adDailyBudgetFen: 3000,
  bulkQuotes: [],
  buyCompliance: false,
  upgradeToLocal: false,
};

describe("riskLevel", () => {
  it("小于 40 低，小于 70 中，其余高", () => {
    expect(riskLevel(0, P)).toBe("low");
    expect(riskLevel(39, P)).toBe("low");
    expect(riskLevel(40, P)).toBe("mid");
    expect(riskLevel(69, P)).toBe("mid");
    expect(riskLevel(70, P)).toBe("high");
    expect(riskLevel(100, P)).toBe("high");
  });
});

describe("netWorthFen", () => {
  it("现金加上库存按进价的五成", () => {
    const { state } = createGame({ seed: 1, productId: "hijab", fulfillment: "cross", startCashFen: 500000, firstStockQty: 100 }, hijab, P);
    expect(netWorthFen(state, hijab, P)).toBe(410000 + 45000);
  });
});

describe("replay", () => {
  it("从开局算到结束，每一天都有事件列表，开局的事件在第 0 天", () => {
    const config = { seed: 5, productId: "hijab", fulfillment: "cross" as const, startCashFen: 2000000, firstStockQty: 300 };
    const r = replay(config, Array.from({ length: 8 }, () => steady), hijab, P);
    expect(["finished", "bankrupt", "banned"]).toContain(r.state.phase);
    expect(r.eventsByDay[0][0]).toMatchObject({ type: "restock_ordered", id: "R1-01" });
    expect(r.eventsByDay.length).toBe(r.state.day);
    r.eventsByDay.forEach((evs, d) => evs.forEach((e) => expect(e.day).toBe(d)));
  });
  it("决定的个数不对时抛出错误", () => {
    const config = { seed: 5, productId: "hijab", fulfillment: "cross" as const, startCashFen: 2000000, firstStockQty: 300 };
    expect(() => replay(config, [steady], hijab, P)).toThrow(/8 decisions/);
  });
});

describe("carryOver", () => {
  it("带到下个季度的四样", () => {
    const config = { seed: 5, productId: "hijab", fulfillment: "cross" as const, startCashFen: 2000000, firstStockQty: 300 };
    const full = replay(config, Array.from({ length: 8 }, () => steady), hijab, P);
    const c = carryOver(full.state);
    expect(c.payoutInTransit.batches).toBe(full.state.orderBatches.filter((b) => !b.paid).length);
    expect(c.reservedQty).toBe(0);
    const start = createGame(config, hijab, P).state;
    // 手工构造一个状态：三批货款（一批有退货、一批还没签收、一批已到账）、四张大单、两张补货单、冻结中
    const bulkBase = { qty: 100, unitPriceSen: 1000, valueFen: 165000, depositFen: 49500, warnDay: 100, shipDay: 120, dueDay: 130, balanceDay: null };
    const built = {
      ...start,
      day: 200,
      payoutFrozenUntilDay: 215,
      orderBatches: [
        { orderDay: 180, fulfillment: "cross" as const, qty: 10, payoutFenEach: 2000, deliverDay: 190, returnedQty: 2, settleDay: 205, paid: false },
        { orderDay: 195, fulfillment: "cross" as const, qty: 5, payoutFenEach: 2000, deliverDay: 205, returnedQty: null, settleDay: null, paid: false },
        { orderDay: 150, fulfillment: "cross" as const, qty: 7, payoutFenEach: 2000, deliverDay: 160, returnedQty: 0, settleDay: 175, paid: true },
      ],
      bulkOrders: [
        { ...bulkBase, inquiryId: "a", status: "won" as const },
        { ...bulkBase, inquiryId: "b", status: "shipped" as const },
        { ...bulkBase, inquiryId: "c", status: "delivered" as const, balanceDay: 160 },
        { ...bulkBase, inquiryId: "d", status: "paid" as const, balanceDay: 150 },
      ],
      restockBatches: [
        { id: "R3-01", orderDay: 180, qty: 50, unitCostFen: 900, arriveDay: 183, rush: false },
        { id: "R3-02", orderDay: 198, qty: 60, unitCostFen: 900, arriveDay: 201, rush: false },
      ],
    };
    const cb = carryOver(built);
    // (10 − 2) × 2000 + 5 × 2000 = 26000
    expect(cb.payoutInTransit).toEqual({ batches: 2, amountFen: 26000, frozenUntilDay: 215 });
    expect(cb.openBulks.map((b) => b.inquiryId)).toEqual(["a", "b", "c"]);
    expect(cb.restockInTransit.map((b) => b.id)).toEqual(["R3-02"]);
    expect(cb.reservedQty).toBe(100);
    expect(carryOver({ ...built, payoutFrozenUntilDay: 0 }).payoutInTransit.frozenUntilDay).toBeNull();
    const c0 = carryOver(start);
    expect(c0).toEqual({ payoutInTransit: { batches: 0, amountFen: 0, frozenUntilDay: null }, openBulks: [], restockInTransit: [], reservedQty: 0 });
  });
});

describe("账单", () => {
  const ev = (e: GameEvent): GameEvent => e;
  const events: GameEvent[] = [
    ev({ type: "setup_paid", day: 0, feeFen: 100000 }),
    ev({ type: "restock_ordered", day: 0, id: "R1-01", qty: 100, unitCostFen: 900, discountBp: 0, goodsFen: 90000, headHaulFen: 8000, totalFen: 98000, arriveDay: 0 }),
    ev({ type: "month_started", day: 0, fixedCostFen: 30000, storageFeeFen: 0, push: { sales: 6, stock: 20, price: 12, complete: 17, speed: 20, total: 75, pushBp: 11000 } }),
    ev({ type: "ads_ran", day: 1, budgetFen: 3000, adSpendFen: 900, clicks: 30, adOrders: 1, refBidFen: 36, demandBp: 10000 }),
    ev({ type: "ads_ran", day: 2, budgetFen: 3000, adSpendFen: 600, clicks: 20, adOrders: 1, refBidFen: 36, demandBp: 10000 }),
    ev({ type: "ads_ran", day: 31, budgetFen: 3000, adSpendFen: 300, clicks: 10, adOrders: 0, refBidFen: 36, demandBp: 10000 }),
    ev({ type: "orders_shipped", day: 1, organicOrders: 3, adOrders: 1, shipped: 4, lost: 0, perOrderFeeFen: 200, payoutFenEach: 2663, demandBp: 10000 }),
    ev({ type: "orders_shipped", day: 2, organicOrders: 2, adOrders: 1, shipped: 3, lost: 0, perOrderFeeFen: 200, payoutFenEach: 2663, demandBp: 10000 }),
    ev({ type: "payout_received", day: 11, orderDay: 1, amountFen: 10652, orders: 4, banned: false }),
    ev({ type: "month_started", day: 30, fixedCostFen: 30000, storageFeeFen: 1500, push: { sales: 6, stock: 20, price: 12, complete: 17, speed: 20, total: 75, pushBp: 11000 } }),
    ev({ type: "bulk_won", day: 90, inquiryId: "q1-1", unitPriceSen: 1000, effectiveSen: 1000, valueFen: 495000, depositFen: 148500, shipDay: 140, warnDay: 130 }),
  ];
  it("编号、经手的角色、广告和每单费用每个月合成一笔", () => {
    const bills = buildQuarterBills(0, events, P);
    const byId = (id: string): Bill | undefined => bills.find((b) => b.id === id);
    expect(bills.map((b) => b.id)).toEqual([
      "Q1-SET-01", "Q1-RST-01", "Q1-FIX-01", "Q1-ADS-01", "Q1-FEE-01", "Q1-PAY-01", "Q1-FIX-02", "Q1-STO-01", "Q1-ADS-02",
    ]);
    expect(byId("Q1-ADS-01")).toMatchObject({ day: 1, role: "ops", kind: "ads", amountFen: -1500, count: 50 });
    expect(byId("Q1-FEE-01")).toMatchObject({ role: "ops", amountFen: -1400, count: 7 });
    expect(byId("Q1-RST-01")).toMatchObject({ role: "purchase", amountFen: -98000, refId: "R1-01", count: 100 });
    expect(byId("Q1-PAY-01")).toMatchObject({ role: "finance", amountFen: 10652, count: 4 });
    expect(byId("Q1-STO-01")).toMatchObject({ role: "finance", amountFen: -1500 });
    // 第 90 天的定金属于第 2 季度
    expect(buildQuarterBills(1, events, P)).toEqual([
      { id: "Q2-DEP-01", day: 90, role: "finance", kind: "bulk_deposit", amountFen: 148500, refId: "q1-1" },
    ]);
  });
  it("第 720 天之后的钱算在第 8 季度", () => {
    const late: GameEvent[] = [ev({ type: "payout_received", day: 735, orderDay: 715, amountFen: 5000, orders: 2, banned: false })];
    expect(buildQuarterBills(7, late, P)).toHaveLength(1);
  });
  it("verifyQuarter：季初现金加上所有账等于季末现金", () => {
    const bills = buildQuarterBills(0, events, P);
    const sum = bills.reduce((s, b) => s + b.amountFen, 0);
    expect(verifyQuarter(500000, bills, 500000 + sum)).toBe(true);
    expect(verifyQuarter(500000, bills, 500000 + sum + 1)).toBe(false);
  });
});
