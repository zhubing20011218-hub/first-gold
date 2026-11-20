// 任务 03 第 3 步：一局里每个季度的账单加起来等于现金的变化（docs/04 第十七节）
import { describe, expect, it } from "vitest";
import { malaysia as P } from "../src/params/malaysia";
import { getProduct } from "../src/products/catalog";
import { createGame } from "../src/engine/game";
import { startQuarter } from "../src/engine/quarter";
import { stepDay } from "../src/engine/day";
import { answerPending } from "../src/engine/pending";
import { buildQuarterBills, verifyQuarter } from "../src/engine/bills";
import type { GameEvent } from "../src/engine/events";
import type { Fulfillment, GameState, MidChoice, QuarterDecision } from "../src/engine/types";

const hijab = getProduct("hijab");

function decision(partial: Partial<QuarterDecision> = {}): QuarterDecision {
  return { monthlyRestockQty: 0, priceSen: hijab.refPriceSen, adBidFen: 0, adDailyBudgetFen: 0, bulkQuotes: [], buyCompliance: false, upgradeToLocal: false, ...partial };
}

function newGame(fulfillment: Fulfillment, firstStockQty = 300, seed = 11, startCashFen = 2000000) {
  return createGame({ seed, productId: "hijab", fulfillment, startCashFen, firstStockQty }, hijab, P);
}

function advance(start: GameState, toDay: number, decide: (q: number, s: GameState) => QuarterDecision, onPending: MidChoice, startedQuarter: number): { state: GameState; events: GameEvent[] } {
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
      const r = answerPending(state, onPending, hijab, P);
      state = r.state;
      events.push(...r.events);
      continue;
    }
    const r = stepDay(state, hijab, P);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

describe("账单", () => {
  it("每个季度的账单加起来等于现金的变化", () => {
    let state = newGame("cross", 300).state;
    const opening = newGame("cross", 300).events;
    const all: GameEvent[] = [...opening];
    let startCash = 2000000;
    for (let q = 0; q < 8 && state.phase === "running"; q++) {
      const r = advance(state, (q + 1) * 90, () => decision({ monthlyRestockQty: 150, adBidFen: 30, adDailyBudgetFen: 3000 }), "ignore", q - 1);
      all.push(...r.events);
      state = r.state;
      const bills = buildQuarterBills(q, all, P);
      expect(verifyQuarter(startCash, bills, state.cashFen), `第 ${q + 1} 季度`).toBe(true);
      expect(new Set(bills.map((b) => b.id)).size).toBe(bills.length);
      startCash = state.cashFen;
    }
  });
});
