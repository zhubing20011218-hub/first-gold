// 每单结算的核对用例（docs/03 第五节、第 10.1 到 10.4 节）。期望的数字照抄文档。
import { describe, expect, it } from "vitest";
import { malaysia } from "../src/params/malaysia";
import { crossShippingSen, settleOrder, unitProfit, type SettleInput } from "../src/engine/settle";
import { createRng } from "../src/engine/rng";

const P = malaysia;

describe("跨境运费核对表（docs/03 第五节）", () => {
  it("[G03-5#01] 1 克 = 19 仙", () => expect(crossShippingSen(1, P)).toBe(19));
  it("[G03-5#02] 30 克 = 19 仙", () => expect(crossShippingSen(30, P)).toBe(19));
  it("[G03-5#03] 31 克 = 32 仙", () => expect(crossShippingSen(31, P)).toBe(32));
  it("[G03-5#04] 40 克 = 32 仙", () => expect(crossShippingSen(40, P)).toBe(32));
  it("[G03-5#05] 50 克 = 45 仙", () => expect(crossShippingSen(50, P)).toBe(45));
  it("[G03-5#06] 51 克 = 57 仙", () => expect(crossShippingSen(51, P)).toBe(57));
  it("[G03-5#07] 100 克 = 108 仙", () => expect(crossShippingSen(100, P)).toBe(108));
  it("[G03-5#08] 101 克 = 121 仙", () => expect(crossShippingSen(101, P)).toBe(121));
  it("[G03-5#09] 200 克 = 235 仙", () => expect(crossShippingSen(200, P)).toBe(235));
  it("[G03-5#10] 250 克 = 299 仙", () => expect(crossShippingSen(250, P)).toBe(299));
  it("[G03-5#11] 300 克 = 363 仙", () => expect(crossShippingSen(300, P)).toBe(363));
  it("[G03-5#12] 500 克 = 617 仙", () => expect(crossShippingSen(500, P)).toBe(617));
  it("[G03-5#13] 1000 克 = 1253 仙", () => expect(crossShippingSen(1000, P)).toBe(1253));
});

/** 没有写出的输入：joinCashback false，creatorBp 0，commissionBp 不传 */
function input(partial: Partial<SettleInput> & Pick<SettleInput, "fulfillment" | "priceSen" | "region">): SettleInput {
  return { weightG: 1, creatorBp: 0, joinCashback: false, ...partial };
}

describe("settleOrder 核对用例（docs/03 第 10.1 节）", () => {
  it("[G03-10.1#01] C1 跨境直发 RM20.00 100 克 西马", () => {
    expect(settleOrder(input({ fulfillment: "cross", priceSen: 2000, weightG: 100, region: "west" }), P)).toMatchObject({
      commissionSen: 292, transactionFeeSen: 87, fixedFeeSen: 54, sstSen: 182, crossShippingSen: 108,
      platformShippingSen: 0, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: 1277, payoutFen: 2107,
    });
  });
  it("[G03-10.1#02] C2 跨境直发 RM20.00 100 克 东马", () => {
    expect(settleOrder(input({ fulfillment: "cross", priceSen: 2000, weightG: 100, region: "east" }), P)).toMatchObject({
      commissionSen: 292, transactionFeeSen: 106, fixedFeeSen: 54, sstSen: 182, crossShippingSen: 108,
      platformShippingSen: 0, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: 1258, payoutFen: 2076,
    });
  });
  it("[G03-10.1#03] C3 跨境直发 RM6.90 30 克 西马", () => {
    expect(settleOrder(input({ fulfillment: "cross", priceSen: 690, weightG: 30, region: "west" }), P)).toMatchObject({
      commissionSen: 101, transactionFeeSen: 37, fixedFeeSen: 54, sstSen: 63, crossShippingSen: 19,
      platformShippingSen: 0, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: 416, payoutFen: 686,
    });
  });
  it("[G03-10.1#04] C4 跨境直发 RM6.90 31 克 西马", () => {
    expect(settleOrder(input({ fulfillment: "cross", priceSen: 690, weightG: 31, region: "west" }), P)).toMatchObject({
      commissionSen: 101, transactionFeeSen: 37, fixedFeeSen: 54, sstSen: 63, crossShippingSen: 32,
      platformShippingSen: 0, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: 403, payoutFen: 665,
    });
  });
  it("[G03-10.1#05] C5 跨境直发 RM29.90 250 克 西马", () => {
    expect(settleOrder(input({ fulfillment: "cross", priceSen: 2990, weightG: 250, region: "west" }), P)).toMatchObject({
      commissionSen: 436, transactionFeeSen: 124, fixedFeeSen: 54, sstSen: 272, crossShippingSen: 299,
      platformShippingSen: 0, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: 1805, payoutFen: 2978,
    });
  });
  it("[G03-10.1#06] C6 跨境直发 RM45.90 120 克 西马 达人佣金 10%", () => {
    expect(
      settleOrder(input({ fulfillment: "cross", priceSen: 4590, weightG: 120, region: "west", creatorBp: 1000 }), P),
    ).toMatchObject({
      commissionSen: 669, transactionFeeSen: 184, fixedFeeSen: 54, sstSen: 418, crossShippingSen: 134,
      platformShippingSen: 0, cashbackFeeSen: 0, creatorFeeSen: 459, payoutSen: 2672, payoutFen: 4409,
    });
  });
  it("[G03-10.1#07] C7 跨境直发 RM1.00 1000 克 东马（打款是负数）", () => {
    expect(settleOrder(input({ fulfillment: "cross", priceSen: 100, weightG: 1000, region: "east" }), P)).toMatchObject({
      commissionSen: 15, transactionFeeSen: 34, fixedFeeSen: 54, sstSen: 9, crossShippingSen: 1253,
      platformShippingSen: 0, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: -1265, payoutFen: -2087,
    });
  });
  it("[G03-10.1#08] L1 本土店 RM20.00 西马", () => {
    expect(settleOrder(input({ fulfillment: "local", priceSen: 2000, region: "west" }), P)).toMatchObject({
      commissionSen: 200, transactionFeeSen: 94, fixedFeeSen: 54, sstSen: 0, crossShippingSen: 0,
      platformShippingSen: 29, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: 1623, payoutFen: 2678,
    });
  });
  it("[G03-10.1#09] L2 本土店 RM20.00 东马", () => {
    expect(settleOrder(input({ fulfillment: "local", priceSen: 2000, region: "east" }), P)).toMatchObject({
      commissionSen: 200, transactionFeeSen: 113, fixedFeeSen: 54, sstSen: 0, crossShippingSen: 0,
      platformShippingSen: 60, cashbackFeeSen: 0, creatorFeeSen: 0, payoutSen: 1573, payoutFen: 2595,
    });
  });
  it("[G03-10.1#10] L3 本土店 RM20.00 西马 参加返现", () => {
    expect(
      settleOrder(input({ fulfillment: "local", priceSen: 2000, region: "west", joinCashback: true }), P),
    ).toMatchObject({
      commissionSen: 200, transactionFeeSen: 94, fixedFeeSen: 54, sstSen: 0, crossShippingSen: 0,
      platformShippingSen: 29, cashbackFeeSen: 97, creatorFeeSen: 0, payoutSen: 1526, payoutFen: 2518,
    });
  });
  it("[G03-10.1#11] L4 本土店 RM32.90 西马 达人佣金 8%", () => {
    expect(
      settleOrder(input({ fulfillment: "local", priceSen: 3290, region: "west", creatorBp: 800 }), P),
    ).toMatchObject({
      commissionSen: 329, transactionFeeSen: 143, fixedFeeSen: 54, sstSen: 0, crossShippingSen: 0,
      platformShippingSen: 29, cashbackFeeSen: 0, creatorFeeSen: 263, payoutSen: 2472, payoutFen: 4079,
    });
  });
});

describe("unitProfit 核对用例（docs/03 第 10.2 节）", () => {
  it("[G03-10.2#01] U1 在 C1 的基础上，成本 500", () => {
    const r = unitProfit(
      { ...input({ fulfillment: "cross", priceSen: 2000, weightG: 100, region: "west" }), costFen: 500, adsFen: 0, otherFen: 0 },
      P,
    );
    expect(r).toMatchObject({ perOrderFeeFen: 130, revenueFen: 3300, profitFen: 1477, marginBp: 4476 });
  });
  it("[G03-10.2#02] U2 在 L1 的基础上，成本 500", () => {
    const r = unitProfit(
      { ...input({ fulfillment: "local", priceSen: 2000, region: "west" }), costFen: 500, adsFen: 0, otherFen: 0 },
      P,
    );
    expect(r).toMatchObject({ perOrderFeeFen: 200, revenueFen: 3300, profitFen: 1978, marginBp: 5994 });
  });
  it("[G03-10.2#03] U3 在 C4 的基础上，成本 400", () => {
    const r = unitProfit(
      { ...input({ fulfillment: "cross", priceSen: 690, weightG: 31, region: "west" }), costFen: 400, adsFen: 0, otherFen: 0 },
      P,
    );
    expect(r).toMatchObject({ perOrderFeeFen: 130, revenueFen: 1139, profitFen: 135, marginBp: 1185 });
  });
  it("[G03-10.2#04] U4 在 C5 的基础上，成本 1500 广告 300 其他 50", () => {
    const r = unitProfit(
      {
        ...input({ fulfillment: "cross", priceSen: 2990, weightG: 250, region: "west" }),
        costFen: 1500,
        adsFen: 300,
        otherFen: 50,
      },
      P,
    );
    expect(r).toMatchObject({ perOrderFeeFen: 130, revenueFen: 4934, profitFen: 998, marginBp: 2023 });
  });
});

describe("必须成立的关系（docs/03 第 10.4 节）", () => {
  it("500 组带种子的随机输入，每一组都满足 4 条关系", () => {
    const rng = createRng(20261120);
    let checked = 0;
    for (let i = 0; i < 500; i++) {
      const fulfillment = rng.next() < 0.5 ? "cross" : "local";
      const inp: SettleInput = {
        fulfillment,
        priceSen: rng.int(1, 50000),
        weightG: rng.int(1, 3000),
        region: rng.next() < 0.5 ? "west" : "east",
        creatorBp: rng.next() < 0.5 ? 0 : rng.int(0, 3000),
        joinCashback: rng.next() < 0.5,
        commissionBp: rng.next() < 0.7 ? undefined : rng.int(0, 3000),
      };
      const r = settleOrder(inp, P);
      const fees = [
        r.commissionSen,
        r.transactionFeeSen,
        r.fixedFeeSen,
        r.sstSen,
        r.crossShippingSen,
        r.platformShippingSen,
        r.cashbackFeeSen,
        r.creatorFeeSen,
      ];
      // 1. 每一项费用都是整数，并且不小于 0
      for (const f of fees) {
        expect(Number.isInteger(f)).toBe(true);
        expect(f).toBeGreaterThanOrEqual(0);
      }
      // 2. totalFeeSen 等于八项费用相加
      expect(r.totalFeeSen).toBe(fees.reduce((a, b) => a + b, 0));
      // 3. priceSen 等于 totalFeeSen + payoutSen
      expect(inp.priceSen).toBe(r.totalFeeSen + r.payoutSen);
      // 4. 两种发货方式各自没有的费用是 0
      if (fulfillment === "cross") {
        expect(r.platformShippingSen).toBe(0);
        expect(r.cashbackFeeSen).toBe(0);
      } else {
        expect(r.sstSen).toBe(0);
        expect(r.crossShippingSen).toBe(0);
      }
      checked++;
    }
    expect(checked).toBe(500);
  });
});

describe("不合法的输入会抛出错误", () => {
  const ok = input({ fulfillment: "cross", priceSen: 2000, weightG: 100, region: "west" });
  it("priceSen 是 0", () => expect(() => settleOrder({ ...ok, priceSen: 0 }, P)).toThrow(/priceSen/));
  it("priceSen 是负数", () => expect(() => settleOrder({ ...ok, priceSen: -100 }, P)).toThrow(/priceSen/));
  it("priceSen 是小数", () => expect(() => settleOrder({ ...ok, priceSen: 19.9 }, P)).toThrow(/priceSen/));
  it("跨境直发时 weightG 是 0", () => expect(() => settleOrder({ ...ok, weightG: 0 }, P)).toThrow(/weightG/));
  it("本土店不检查 weightG", () => {
    expect(() => settleOrder({ ...ok, fulfillment: "local", weightG: 0 }, P)).not.toThrow();
  });
  it("crossShippingSen 的 weightG 是 0", () => expect(() => crossShippingSen(0, P)).toThrow(/weightG/));
  it("unitProfit 的成本是负数", () =>
    expect(() => unitProfit({ ...ok, costFen: -1, adsFen: 0, otherFen: 0 }, P)).toThrow(/costFen/));
});

describe("参数对象作为参数传进去", () => {
  it("换一组参数，结果跟着变（代码里没有写死的数字）", () => {
    const changed = {
      ...P,
      crossShipBaseFeeSen: { ...P.crossShipBaseFeeSen, value: 100 },
      crossCommissionBp: { ...P.crossCommissionBp, value: 0 },
    };
    expect(crossShippingSen(1, changed)).toBe(106);
    expect(settleOrder(input({ fulfillment: "cross", priceSen: 2000, weightG: 100, region: "west" }), changed).commissionSen).toBe(0);
  });
  it("传了 commissionBp 时用它，不用默认值", () => {
    const r = settleOrder(input({ fulfillment: "local", priceSen: 2000, region: "west", commissionBp: 500 }), P);
    expect(r.commissionSen).toBe(100);
  });
  it("跨境直发时 joinCashback 不起作用", () => {
    const a = settleOrder(input({ fulfillment: "cross", priceSen: 2000, weightG: 100, region: "west" }), P);
    const b = settleOrder(input({ fulfillment: "cross", priceSen: 2000, weightG: 100, region: "west", joinCashback: true }), P);
    expect(b).toEqual(a);
  });
});
