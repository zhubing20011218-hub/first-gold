// 新版引擎（改版方案第 5 稿）的测试：开局、路线树、进货、抢单排名、停顿和回答、结局、同一个种子结果一样
import { describe, expect, it } from "vitest";
import { nextParams } from "../src/params/next";
import { products } from "../src/products/catalog";
import { composite, inquiriesOf, inquiryQty, netWorthFen, quarterCap } from "../src/engine/next/core";
import {
  chooseRoute2,
  chooseRoute4,
  createGame,
  priceScore,
  rankBid,
  revealRoute3,
  routeLayerDue,
  startQuarter,
  type Step,
} from "../src/engine/next/game";
import { answer, runUntilStop, stepDay } from "../src/engine/next/day";
import { ENDING_ORDER, endingOf, leafIndex } from "../src/engine/next/summary";
import type { GameState, QuarterDecision, World } from "../src/engine/next/types";
import { estimateQuarter } from "../src/plan/next/estimate";

const world: World = { params: nextParams, products };
const P = nextParams;

function decision(_state: GameState, buyEach = 500): QuarterDecision {
  const buy: Record<string, number> = {};
  const priceSen: Record<string, number> = {};
  for (const p of products) {
    buy[p.id] = Math.min(Math.max(p.moq, buyEach), quarterCap(p, P));
    priceSen[p.id] = p.refPriceSen;
  }
  return { buy, priceSen, adBudgetFen: 100000, adBidBp: 10000, bids: [], compTier: 0 };
}

/** 用简单的打法玩完一局，事件都选 a，打包 80% */
function playAll(seed: number, r1: "cross" | "local" | "bulk" = "cross"): GameState {
  let s = createGame(seed, r1, world).state;
  let startedQ = -1;
  for (let guard = 0; guard < 3000 && s.phase === "running"; guard++) {
    if (s.pending) {
      const k = s.pending.kind;
      s = answer(s, k === "pack" ? { kind: "pack", packBp: 8000 } : k === "event" ? { kind: "event", choice: "a" } : { kind: "bulk_short", choice: "rush" }, world).state;
      continue;
    }
    const layer = routeLayerDue(s);
    if (layer === 2) s = chooseRoute2(s, "organic").state;
    else if (layer === 3) s = revealRoute3(s, P).state;
    else if (layer === 4) s = chooseRoute4(s, "safe", P).state;
    if (s.pending) continue;
    const q = Math.floor(s.day / 90);
    if (s.day % 90 === 0 && startedQ !== q) {
      startedQ = q;
      s = startQuarter(s, decision(s, 300), world).state;
    }
    s = runUntilStop(s, world).state;
  }
  return s;
}

describe("新版：开局", () => {
  it("跨境直发不付开通费，海外仓付开通费", () => {
    expect(createGame(1, "cross", world).state.cashFen).toBe(P.startCashFen.value);
    expect(createGame(1, "local", world).state.cashFen).toBe(P.startCashFen.value - P.localSetupFeeFen.value);
    expect(createGame(1, "bulk", world).state.fulfillment).toBe("cross");
  });
  it("开局排好 8 个季度的趋势，第 2 到第 8 季度每季一件事", () => {
    const s = createGame(3, "cross", world).state;
    expect(s.schedule.trendBp).toHaveLength(8);
    expect(s.schedule.events).toHaveLength(7);
    expect(s.schedule.events.every((e) => e.quarter >= 1)).toBe(true);
  });
  it("第 1 季度的货开张当天就到", () => {
    const g = createGame(5, "cross", world).state;
    const s = startQuarter(g, decision(g), world).state;
    const after = stepDay(s, world).state;
    for (const p of products) expect(after.stock[p.id]).toBeGreaterThan(0);
  });
});

describe("新版：进货的限制", () => {
  it("少于起订量、超过供应商上限都不行", () => {
    const g = createGame(1, "cross", world).state;
    const d = decision(g);
    expect(() => startQuarter(g, { ...d, buy: { ...d.buy, hijab: 10 } }, world)).toThrow();
    expect(() => startQuarter(g, { ...d, buy: { ...d.buy, hijab: quarterCap(products[2], P) + 10 } }, world)).toThrow();
  });
  it("钱不够也能下单，现金变成负数，季末再结", () => {
    const g = createGame(1, "cross", world).state;
    const d = decision(g, 3000);
    const s = startQuarter(g, d, world).state;
    expect(s.cashFen).toBeLessThan(0);
  });
});

describe("新版：抢单", () => {
  it("报价分：参考价 0 分，地板价 100 分", () => {
    expect(priceScore(1400, 1400, P)).toBe(0);
    expect(priceScore(1092, 1400, P)).toBe(100);
    expect(priceScore(500, 1400, P)).toBe(100);
  });
  it("报得越低，排名不会变差；第 1 名分到一半", () => {
    const s = playUntilQuarter(9, 1);
    const inq = inquiriesOf(s, 1, P)[0];
    const qty = inquiryQty(inq, s.routes, P);
    let lastRank = 99;
    for (let sen = inq.refPriceSen; sen >= applyFloor(inq.refPriceSen); sen -= 20) {
      const me = rankBid(s, inq, sen, P, false).find((r) => r.who === -1)!;
      expect(me.rank).toBeLessThanOrEqual(lastRank);
      lastRank = me.rank;
    }
    const top = rankBid(s, inq, applyFloor(inq.refPriceSen), P, false).find((r) => r.rank === 1)!;
    expect(top.qty).toBe(Math.floor(qty / 2 / 10) * 10);
  });
  it("主攻企业大单：询单件数更多，综合分加分", () => {
    const a = createGame(2, "cross", world).state;
    const b = createGame(2, "bulk", world).state;
    const inq = b.schedule.inquiries[0];
    expect(inquiryQty(inq, b.routes, P)).toBeGreaterThan(inquiryQty(inq, a.routes, P));
    expect(composite(b, P).total - composite(a, P).total).toBe(P.bulkRouteCompositeBonus.value);
  });
  it("违约：退定金、赔违约金、综合分大扣", () => {
    let s = playUntilQuarter(4, 1);
    const inq = inquiriesOf(s, 1, P)[0];
    const d = decision(s, 0);
    for (const k of Object.keys(d.buy)) d.buy[k] = 0;
    d.bids = [{ inquiryId: inq.id, unitPriceSen: applyFloor(inq.refPriceSen) }];
    s = startQuarter(s, d, world).state;
    // 卖光库存，再一路"不管"
    for (const p of products) s = { ...s, stock: { ...s.stock, [p.id]: 0 } };
    const before = composite(s, P).total;
    for (let i = 0; i < 200 && s.phase === "running" && Math.floor(s.day / 90) === 1; i++) {
      if (s.pending) {
        const k = s.pending.kind;
        s = answer(s, k === "bulk_short" ? { kind: "bulk_short", choice: "ignore" } : k === "pack" ? { kind: "pack", packBp: 8000 } : { kind: "event", choice: "b" }, world).state;
        continue;
      }
      s = stepDay(s, world).state;
    }
    expect(s.defaults).toBe(1);
    expect(composite(s, P).total).toBeLessThan(before);
  });
});

function applyFloor(ref: number): number {
  return Math.ceil((ref * P.bidFloorBp.value) / 10000 / 10) * 10;
}

function playUntilQuarter(seed: number, q: number): GameState {
  let s = createGame(seed, "cross", world).state;
  let startedQ = -1;
  while (s.phase === "running" && !(s.day === q * 90 && s.pending === null && routeLayerDue(s) === null)) {
    if (s.pending) {
      const k = s.pending.kind;
      s = answer(s, k === "pack" ? { kind: "pack", packBp: 8000 } : k === "event" ? { kind: "event", choice: "a" } : { kind: "bulk_short", choice: "rush" }, world).state;
      continue;
    }
    const layer = routeLayerDue(s);
    if (layer === 2) s = chooseRoute2(s, "ads").state;
    else if (layer === 3) s = revealRoute3(s, P).state;
    else if (layer === 4) s = chooseRoute4(s, "bulk", P).state;
    if (s.pending || (s.day === q * 90 && routeLayerDue(s) === null)) continue;
    const cq = Math.floor(s.day / 90);
    if (s.day % 90 === 0 && startedQ !== cq) {
      startedQ = cq;
      s = startQuarter(s, decision(s, 400), world).state;
    }
    s = runUntilStop(s, world).state;
  }
  return s;
}

describe("新版：路线树", () => {
  it("第 3 季度初先选第 2 层，没选不能开始这一季", () => {
    const s = playUntilQuarterRaw(6, 2);
    expect(routeLayerDue(s)).toBe(2);
    expect(() => startQuarter(s, decision(s), world)).toThrow();
    const r = chooseRoute2(s, "creator");
    expect(r.state.routes.r2).toBe("creator");
    expect(routeLayerDue(r.state)).toBeNull();
  });
  it("全力冲大促当场付报名费", () => {
    const s = playUntilQuarterRaw(6, 6);
    const r = chooseRoute4(s, "promo", P);
    expect(r.state.cashFen).toBe(s.cashFen - P.promoFeeFen.value);
  });
  it("叶子编号 0 到 53，每条路线不一样", () => {
    const seen = new Set<number>();
    for (const r1 of ["cross", "local", "bulk"] as const)
      for (const r2 of ["ads", "creator", "organic"] as const)
        for (const r3 of ["good", "bad"] as const)
          for (const r4 of ["promo", "bulk", "safe"] as const) {
            const g = createGame(1, r1, world).state;
            const i = leafIndex({ ...g, routes: { r1, r2, r3, r4 } });
            expect(i).not.toBeNull();
            seen.add(i as number);
          }
    expect(seen.size).toBe(54);
    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(53);
  });
});

/** 走到第 q 个季度第一天，路线还没选 */
function playUntilQuarterRaw(seed: number, q: number): GameState {
  let s = createGame(seed, "cross", world).state;
  let startedQ = -1;
  for (let guard = 0; guard < 3000; guard++) {
    if (s.phase !== "running") break;
    if (s.pending) {
      const k = s.pending.kind;
      s = answer(s, k === "pack" ? { kind: "pack", packBp: 8000 } : k === "event" ? { kind: "event", choice: "a" } : { kind: "bulk_short", choice: "rush" }, world).state;
      continue;
    }
    if (s.day === q * 90 && routeLayerDue(s) !== null) break;
    const layer = routeLayerDue(s);
    if (layer === 2) s = chooseRoute2(s, "ads").state;
    else if (layer === 3) s = revealRoute3(s, P).state;
    else if (layer === 4) s = chooseRoute4(s, "bulk", P).state;
    if (s.pending) continue;
    const cq = Math.floor(s.day / 90);
    if (s.day % 90 === 0 && startedQ !== cq) {
      startedQ = cq;
      s = startQuarter(s, decision(s, 400), world).state;
    }
    s = runUntilStop(s, world).state;
  }
  return s;
}

describe("新版：一整局", () => {
  it("同一个种子、同样的打法，结果完全一样", () => {
    const a = playAll(11);
    const b = playAll(11);
    expect(a.cashFen).toBe(b.cashFen);
    expect(netWorthFen(a, world)).toBe(netWorthFen(b, world));
    expect(a.answers).toEqual(b.answers);
  });
  it("不同的种子结果不一样", () => {
    expect(playAll(12).cashFen).not.toBe(playAll(13).cashFen);
  });
  it("一局走完 8 个季度，结局在 12 个里面", () => {
    for (const r1 of ["cross", "local", "bulk"] as const) {
      const s = playAll(21, r1);
      expect(s.phase === "finished" || s.phase === "bankrupt" || s.phase === "banned").toBe(true);
      if (s.phase === "finished") expect(s.netWorthAtQuarterEnd).toHaveLength(8);
      expect(ENDING_ORDER).toContain(endingOf(s, world));
    }
  });
  it("双 11 会停下来让玩家打包，第 4、第 8 季度各一次", () => {
    let s = createGame(31, "cross", world).state;
    let packs = 0;
    let startedQ = -1;
    for (let guard = 0; guard < 3000 && s.phase === "running"; guard++) {
      if (s.pending) {
        if (s.pending.kind === "pack") packs++;
        const k = s.pending.kind;
        s = answer(s, k === "pack" ? { kind: "pack", packBp: 6000 } : k === "event" ? { kind: "event", choice: "b" } : { kind: "bulk_short", choice: "ignore" }, world).state;
        continue;
      }
      const layer = routeLayerDue(s);
      if (layer === 2) s = chooseRoute2(s, "ads").state;
      else if (layer === 3) s = revealRoute3(s, P).state;
      else if (layer === 4) s = chooseRoute4(s, "promo", P).state;
      if (s.pending) continue;
      const cq = Math.floor(s.day / 90);
      if (s.day % 90 === 0 && startedQ !== cq) {
        startedQ = cq;
        s = startQuarter(s, decision(s, 300), world).state;
      }
      s = runUntilStop(s, world).state;
    }
    expect(s.phase === "finished" ? packs : 2).toBe(2);
  });
  it("传进去的状态不会被改", () => {
    const g = createGame(41, "local", world).state;
    const s = startQuarter(g, decision(g), world).state;
    const copy = JSON.stringify(s);
    stepDay(s, world);
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe("新版：这一季大约", () => {
  it("多进货，预计卖出不会变少；什么都不进，第一季卖不出", () => {
    const g = createGame(1, "cross", world).state;
    const small = estimateQuarter(g, decision(g, 200), world);
    const big = estimateQuarter(g, decision(g, 2000), world);
    expect(big.sold).toBeGreaterThanOrEqual(small.sold);
    const none = decision(g, 0);
    for (const k of Object.keys(none.buy)) none.buy[k] = 0;
    expect(estimateQuarter(g, none, world).sold).toBe(0);
  });
  it("进货的钱和引擎扣的一样", () => {
    const g = createGame(1, "cross", world).state;
    const d = decision(g, 600);
    const e = estimateQuarter(g, { ...d, adBudgetFen: 0 }, world);
    const r: Step = startQuarter(g, { ...d, adBudgetFen: 0 }, world);
    expect(g.cashFen - r.state.cashFen).toBe(e.spendFen);
  });
});
