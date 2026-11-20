// 任务 03 第 3 步：整局必须成立的关系（docs/04 第 14.6 节 1 到 10、第十五节 11 到 13）。
// 200 个种子，覆盖 6 种商品、两种开局方式、中途升级。
import { describe, expect, it } from "vitest";
import { malaysia as P } from "../src/params/malaysia";
import { products } from "../src/products/catalog";
import { replay } from "../src/engine/replay";
import { buildQuarterBills, verifyQuarter } from "../src/engine/bills";
import { inTransitBatches, reservedQty } from "../src/engine/game";
import { marketOfDay } from "../src/engine/market";
import type { GameEvent } from "../src/engine/events";
import type { Fulfillment } from "../src/engine/types";
import { createRng, playGame, randomConfig, randomDecisions, withChoices, type Played } from "./helpers/play";

interface Case {
  seed: number;
  productIdx: number;
  fulfillment: Fulfillment;
  upgradeQuarter?: number;
}

const cases: Case[] = Array.from({ length: 200 }, (_, i) => {
  const seed = 1000 + i * 7919;
  const fulfillment: Fulfillment = i % 2 === 0 ? "cross" : "local";
  // 跨境直发的局里，一半中途升级
  const upgradeQuarter = fulfillment === "cross" && i % 4 === 0 ? 1 + (i % 6) : undefined;
  return { seed, productIdx: i % 6, fulfillment, upgradeQuarter };
});

function playCase(c: Case, decisionSeed = 0): { played: Played; config: ReturnType<typeof randomConfig>; decisions: ReturnType<typeof randomDecisions> } {
  const product = products[c.productIdx];
  const rng = createRng(c.seed + decisionSeed);
  const config = randomConfig(rng, c.seed, product, P, c.fulfillment);
  const decisions = randomDecisions(rng, c.seed, product, P, { upgradeQuarter: c.upgradeQuarter });
  const played = playGame(config, decisions, product, P, (g) => (g.next() < 0.5 ? "rush" : "ignore"), rng, true);
  return { played, config, decisions };
}

const results = cases.map((c) => ({ c, ...playCase(c) }));

describe("整局必须成立的关系（200 个种子）", () => {
  it("覆盖到了：6 种商品、两种开局、中途升级、各种结局", () => {
    const productsSeen = new Set(results.map((r) => r.c.productIdx));
    expect(productsSeen.size).toBe(6);
    expect(results.some((r) => r.c.fulfillment === "local")).toBe(true);
    expect(results.some((r) => r.played.events.some((e) => e.type === "upgraded"))).toBe(true);
    const phases = new Set(results.map((r) => r.played.state.phase));
    expect(phases.has("finished")).toBe(true);
    expect(phases.has("bankrupt")).toBe(true);
    expect(results.some((r) => r.played.events.some((e) => e.type === "bulk_short"))).toBe(true);
    expect(results.some((r) => r.played.events.some((e) => e.type === "rush_ordered"))).toBe(true);
  });

  it("1. 重放一致：同样的 config 和决定再算一遍，最后的状态完全相同", () => {
    for (const r of results) {
      const product = products[r.c.productIdx];
      const decisions = withChoices(r.decisions, r.played.choices);
      const a = replay(r.config, decisions, product, P);
      const b = replay(r.config, decisions, product, P);
      expect(a.state).toEqual(b.state);
    }
  });

  it("2. 现金对得上", () => {
    for (const { played, config } of results) {
      for (const s of [...played.states, played.state]) {
        const t = s.totals;
        const expected =
          config.startCashFen - t.setupFeeFen - t.complianceFen - t.restockFen - t.adSpendFen - t.perOrderFeeFen -
          t.fixedCostFen - t.storageFen + t.payoutFen + t.bulkInFen - t.bulkOutFen;
        expect(s.cashFen).toBe(expected);
      }
    }
  });

  it("3. 库存对得上", () => {
    for (const { played } of results) {
      for (const s of [...played.states, played.state]) {
        const transit = inTransitBatches(s).reduce((sum, b) => sum + b.qty, 0);
        expect(s.stockQty).toBe(s.totals.unitsBought - s.totals.ordersShipped - s.totals.bulkUnits - transit);
      }
    }
  });

  it("4. finished 时：所有订单批次都已到账，所有大单都是 paid 或 defaulted", () => {
    for (const { played } of results) {
      if (played.state.phase !== "finished") continue;
      expect(played.state.orderBatches.every((b) => b.paid)).toBe(true);
      expect(played.state.bulkOrders.every((b) => b.status === "paid" || b.status === "defaulted")).toBe(true);
    }
  });

  it("5. 库存、评分、信誉、风险值、各项累计数都不小于 0；每个月的推流分在 0 到 100 之间", () => {
    for (const { played } of results) {
      for (const s of played.states) {
        expect(s.stockQty).toBeGreaterThanOrEqual(0);
        expect(s.ratingE1).toBeGreaterThanOrEqual(0);
        expect(s.bulkRep).toBeGreaterThanOrEqual(0);
        expect(s.riskPts).toBeGreaterThanOrEqual(0);
        for (const v of Object.values(s.totals)) expect(v).toBeGreaterThanOrEqual(0);
      }
      for (const e of played.events) {
        if (e.type !== "month_started") continue;
        expect(e.push.total).toBeGreaterThanOrEqual(0);
        expect(e.push.total).toBeLessThanOrEqual(100);
      }
    }
  });

  it("6. 每个季度最后一天结束时，以及 finished 时，除了 bankrupt 和 banned，cashFen 不小于 0；季度中间可以是负数", () => {
    let midNegative = 0;
    for (const { played } of results) {
      for (const s of played.states) {
        const quarterEnd = s.day % 90 === 0 && s.day <= 720;
        if (s.phase !== "bankrupt" && s.phase !== "banned" && quarterEnd) expect(s.cashFen).toBeGreaterThanOrEqual(0);
        if (s.phase === "finished") expect(s.cashFen).toBeGreaterThanOrEqual(0);
        if (s.phase === "running" && !quarterEnd && s.cashFen < 0) midNegative++;
      }
      if (played.state.phase === "bankrupt") {
        const e = played.events.find((x) => x.type === "bankrupt");
        expect(e && (e.day % 90 === 89 || e.day >= 720)).toBe(true);
      }
    }
    // 确认这 200 局里真的出现过"季度中间是负数但没倒闭"
    expect(midNegative).toBeGreaterThan(0);
  });

  it("7. 运气和决定无关：同一个种子、两组不同的决定，市场热度、事件日期、询价单完全相同", () => {
    for (const r of results.slice(0, 60)) {
      const other = playCase(r.c, 99);
      const product = products[r.c.productIdx];
      expect(other.played.state.schedule).toEqual(r.played.state.schedule);
      const datesOf = (evs: GameEvent[], type: "event_delay" | "event_bad_review", until: number) =>
        evs.filter((e) => e.type === type && e.day < until).map((e) => e.day);
      const until = Math.min(r.played.state.day, other.played.state.day);
      expect(datesOf(other.played.events, "event_delay", until)).toEqual(datesOf(r.played.events, "event_delay", until));
      expect(datesOf(other.played.events, "event_bad_review", until)).toEqual(datesOf(r.played.events, "event_bad_review", until));
      // 对手出价和市场热度只由种子和日子决定
      for (const e of r.played.events) {
        if (e.type === "ads_ran") expect(e.refBidFen).toBe(marketOfDay(r.c.seed, e.day, product, P).refBidFen);
      }
    }
  });

  it("8. 零售不动大单的货：零售发了货的那天，结束时库存不小于留给大单的货", () => {
    for (const { played } of results) {
      const shippedDays = new Set(
        played.events.filter((e) => e.type === "orders_shipped" && e.shipped > 0).map((e) => e.day),
      );
      for (const s of played.states) {
        if (shippedDays.has(s.day - 1)) expect(s.stockQty).toBeGreaterThanOrEqual(reservedQty(s));
      }
    }
  });

  it("9. 风控只影响本土店：一直是跨境直发的局，没有审核和封店，风险值一直是 0", () => {
    for (const { played, c } of results) {
      if (c.fulfillment !== "cross" || played.events.some((e) => e.type === "upgraded")) continue;
      expect(played.events.some((e) => e.type === "audit_started" || e.type === "banned")).toBe(false);
      for (const s of played.states) expect(s.riskPts).toBe(0);
    }
  });

  it("10. 审核期间没有平台货款到账", () => {
    for (const { played } of results) {
      const audit = played.events.find((e) => e.type === "audit_started");
      if (!audit || audit.type !== "audit_started") continue;
      const during = played.events.filter(
        (e) => e.type === "payout_received" && !e.banned && e.day > audit.day && e.day < audit.frozenUntilDay,
      );
      expect(during).toEqual([]);
    }
  });

  it("11. pending 不是 null 时调用 stepDay，状态不变", () => {
    for (const { played } of results) expect(played.pausedStepUnchanged).toBe(true);
  });

  it("12. 把实际做过的选择填进 bulkShortChoices 再重放，最后的状态完全相同", () => {
    for (const r of results) {
      const product = products[r.c.productIdx];
      const again = replay(r.config, withChoices(r.decisions, r.played.choices), product, P);
      expect(again.state).toEqual(r.played.state);
    }
  });

  it("13. 每个季度 verifyQuarter 成立，账单的编号没有重复", () => {
    for (const { played } of results) {
      played.quarterCash.forEach((qc, q) => {
        const bills = buildQuarterBills(q, played.events, P);
        expect(verifyQuarter(qc.startFen, bills, qc.endFen), `第 ${q + 1} 季度`).toBe(true);
        expect(new Set(bills.map((b) => b.id)).size).toBe(bills.length);
      });
    }
  });
});
