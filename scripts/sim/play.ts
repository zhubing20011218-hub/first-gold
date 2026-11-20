// 按一种打法玩完一局，并记下报告要用的数（任务 04 第二节）。只引用 engine、params、products。
import type { Product } from "../../src/engine/product";
import type { Fulfillment, GameState } from "../../src/engine/types";
import type { Params } from "../../src/engine/util";
import { createRng } from "../../src/engine/rng";
import { applyBp } from "../../src/engine/money";
import { createGame } from "../../src/engine/game";
import { startQuarter } from "../../src/engine/quarter";
import { stepDay } from "../../src/engine/day";
import { answerPending } from "../../src/engine/pending";
import { affordableQty } from "../../src/engine/stock";
import { netWorthFen } from "../../src/engine/summary";
import type { GameEvent } from "../../src/engine/events";
import type { Strategy } from "./strategies";

export type Route = "cross" | "local" | "upgrade";
export type Ending = "bankrupt" | "banned" | "survived" | "firstGold";

export interface GameResult {
  ending: Ending;
  netWorthFen: number;
  minCashFen: number;
  minCashDay: number;
  pushSum: [number, number];
  pushCount: [number, number];
  adSpendFen: number;
  adBudgetFen: number;
  shipped: number;
  lost: number;
  returned: number;
  bulkWon: number;
  bulkDelivered: number;
  bulkDefaulted: number;
  /** 大单的收入：收到的定金和尾款，减去违约时退回的定金（任务 04） */
  bulkIncomeFen: number;
  bulkRefundFen: number;
  retailIncomeFen: number;
  storageFen: number;
  restocks: number;
  restocks5: number;
  restocks10: number;
  audited: boolean;
  banQuarter: number | null;
  days: number;
  bankruptDay: number | null;
}

export function playWithStrategy(product: Product, params: Params, strategy: Strategy, route: Route, seed: number, rngSalt: number): GameResult {
  const rng = createRng(seed * 7919 + rngSalt);
  const startFulfillment: Fulfillment = route === "local" ? "local" : "cross";
  const startCashFen = params.startCashFen.value;
  const setup = startFulfillment === "local" ? params.localSetupFeeFen.value : 0;
  const budget = applyBp(startCashFen - setup, strategy.firstStockBp(rng));
  const firstStockQty = Math.max(product.moq, Math.min(product.supplierMonthlyCap, affordableQty(budget, startFulfillment, product, params)));

  const opening = createGame({ seed, productId: product.id, fulfillment: startFulfillment, startCashFen, firstStockQty }, product, params);
  let state: GameState = opening.state;
  const r: GameResult = {
    ending: "survived",
    netWorthFen: 0,
    minCashFen: state.cashFen,
    minCashDay: 0,
    pushSum: [0, 0],
    pushCount: [0, 0],
    adSpendFen: 0,
    adBudgetFen: 0,
    shipped: 0,
    lost: 0,
    returned: 0,
    bulkWon: 0,
    bulkDelivered: 0,
    bulkDefaulted: 0,
    bulkIncomeFen: 0,
    bulkRefundFen: 0,
    retailIncomeFen: 0,
    storageFen: 0,
    restocks: 0,
    restocks5: 0,
    restocks10: 0,
    audited: false,
    banQuarter: null,
    days: 0,
    bankruptDay: null,
  };
  const quarterShipped: number[] = [];
  const onEvents = (evs: GameEvent[]): void => {
    for (const e of evs) {
      const q = Math.floor(e.day / 90);
      switch (e.type) {
        case "month_started": {
          const y = e.day < 360 ? 0 : 1;
          r.pushSum[y] += e.push.total;
          r.pushCount[y] += 1;
          break;
        }
        case "ads_ran":
          r.adSpendFen += e.adSpendFen;
          r.adBudgetFen += e.budgetFen;
          break;
        case "orders_shipped":
          quarterShipped[q] = (quarterShipped[q] ?? 0) + e.shipped;
          break;
        case "bulk_shipped":
          quarterShipped[q] = (quarterShipped[q] ?? 0) + e.qty;
          break;
        case "restock_ordered":
          r.restocks += 1;
          if (e.discountBp === params.buyTier1DiscountBp.value) r.restocks5 += 1;
          if (e.discountBp === params.buyTier2DiscountBp.value) r.restocks10 += 1;
          break;
        case "audit_started":
          r.audited = true;
          break;
        case "banned":
          r.banQuarter = q + 1;
          break;
        case "bulk_defaulted":
          r.bulkRefundFen += e.depositFen;
          break;
        case "bankrupt":
          r.bankruptDay = e.day;
          break;
        default:
          break;
      }
    }
  };
  onEvents(opening.events);

  let started = -1;
  while (state.phase === "running" || state.phase === "closing") {
    const q = Math.floor(state.day / 90);
    if (state.phase === "running" && state.day % 90 === 0 && started < q) {
      const lastMonthlyShipped =
        q === 0 ? Math.floor((product.organicPerDayMilli * 30) / 1000) : Math.floor((quarterShipped[q - 1] ?? 0) / 3);
      const decision = strategy.decide({
        state,
        quarter: q,
        product,
        params,
        rng,
        lastMonthlyShipped,
        upgrade: route === "upgrade" && q === 4 && state.fulfillment === "cross",
      });
      const res = startQuarter(state, decision, product, params);
      state = res.state;
      onEvents(res.events);
      started = q;
    }
    if (state.pending !== null) {
      const res = answerPending(state, strategy.midChoice(state, state.pending.shortQty, rng), product, params);
      state = res.state;
      onEvents(res.events);
      continue;
    }
    const res = stepDay(state, product, params);
    state = res.state;
    onEvents(res.events);
    if (state.cashFen < r.minCashFen) {
      r.minCashFen = state.cashFen;
      r.minCashDay = state.day - 1;
    }
  }

  const t = state.totals;
  r.netWorthFen = netWorthFen(state, product, params);
  r.ending =
    state.phase === "bankrupt"
      ? "bankrupt"
      : state.phase === "banned"
        ? "banned"
        : r.netWorthFen >= params.goalNetWorthFen.value
          ? "firstGold"
          : "survived";
  r.shipped = t.ordersShipped;
  r.lost = t.lostSales;
  r.returned = t.ordersReturned;
  r.bulkWon = t.bulkWon;
  r.bulkDelivered = t.bulkDelivered;
  r.bulkDefaulted = t.bulkDefaulted;
  r.bulkIncomeFen = t.bulkInFen - r.bulkRefundFen;
  r.retailIncomeFen = t.payoutFen;
  r.storageFen = t.storageFen;
  r.days = state.day;
  return r;
}
