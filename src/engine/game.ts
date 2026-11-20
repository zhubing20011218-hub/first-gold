// 开局和几个共用的小函数（docs/04 第十三节 createGame）
import type { GameEvent } from "./events";
import type { Product } from "./product";
import { computePushScore, emptyMonthStats } from "./push";
import { buildSchedule } from "./schedule";
import { restockCostFen } from "./stock";
import type { GameConfig, GameState, QuarterStats, RestockBatch, Totals } from "./types";
import type { Params } from "./util";

export type { Fulfillment, GameConfig, GameState } from "./types";

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

export function emptyQuarterStats(): QuarterStats {
  return { wanted: 0, lost: 0, badReviews: 0, bulkDefaults: 0 };
}

export function emptyTotals(): Totals {
  return {
    setupFeeFen: 0,
    complianceFen: 0,
    restockFen: 0,
    adSpendFen: 0,
    perOrderFeeFen: 0,
    fixedCostFen: 0,
    storageFen: 0,
    payoutFen: 0,
    bulkInFen: 0,
    bulkOutFen: 0,
    unitsBought: 0,
    ordersShipped: 0,
    ordersReturned: 0,
    lostSales: 0,
    adClicks: 0,
    bulkWon: 0,
    bulkDelivered: 0,
    bulkDefaulted: 0,
    bulkUnits: 0,
  };
}

/** 留给大单的货：所有 status 是 "won" 的大单的件数之和（docs/04 第 7.3 节） */
export function reservedQty(state: GameState): number {
  return state.bulkOrders.filter((b) => b.status === "won").reduce((s, b) => s + b.qty, 0);
}

/** 还没到货的补货单。到货在当天的第 2 步，所以 arriveDay 不小于 state.day 的都还在路上 */
export function inTransitBatches(state: GameState): RestockBatch[] {
  return state.restockBatches.filter((b) => b.arriveDay >= state.day);
}

/** 补货单的编号："R" + (季度 + 1) + "-" + 两位序号。开局的第一批货是 R1-01（docs/04 第十七节） */
export function nextRestockId(state: GameState, day: number): string {
  const q = Math.floor(day / 90);
  const inQuarter = state.restockBatches.filter(
    (b) => b.id.startsWith("R") && Math.floor(b.orderDay / 90) === q,
  ).length;
  const seq = inQuarter + 1 + (q === 0 ? 1 : 0);
  return `R${q + 1}-${String(seq).padStart(2, "0")}`;
}

export function createGame(config: GameConfig, product: Product, params: Params): StepResult {
  if (config.productId !== product.id) {
    throw new Error(`config.productId ${config.productId} does not match product ${product.id}`);
  }
  if (config.fulfillment !== "cross" && config.fulfillment !== "local") {
    throw new Error(`fulfillment must be "cross" or "local", got ${String(config.fulfillment)}`);
  }
  if (!Number.isInteger(config.startCashFen) || config.startCashFen < 0) {
    throw new Error(`startCashFen must be an integer >= 0, got ${config.startCashFen}`);
  }
  const qty = config.firstStockQty;
  if (!Number.isInteger(qty) || qty < product.moq || qty > product.supplierMonthlyCap) {
    throw new Error(
      `firstStockQty must be an integer between moq ${product.moq} and supplierMonthlyCap ${product.supplierMonthlyCap}, got ${qty}`,
    );
  }

  const local = config.fulfillment === "local";
  const setupFeeFen = local ? params.localSetupFeeFen.value : 0;
  const cost = restockCostFen(qty, config.fulfillment, product, params);
  if (setupFeeFen + cost.totalFen > config.startCashFen) {
    throw new Error(`not enough cash for setup and first stock: need ${setupFeeFen + cost.totalFen}, have ${config.startCashFen}`);
  }

  const totals = emptyTotals();
  totals.setupFeeFen = setupFeeFen;
  totals.restockFen = cost.totalFen;
  totals.unitsBought = qty;

  const state: GameState = {
    config,
    day: 0,
    phase: "running",
    fulfillment: config.fulfillment,
    cashFen: config.startCashFen - setupFeeFen - cost.totalFen,
    stockQty: qty,
    ratingE1: params.initialRatingE1.value,
    priceSen: product.refPriceSen,
    adBidFen: 0,
    adDailyBudgetFen: 0,
    monthlyRestockQty: 0,
    pushScore: (({ sales, stock, price, complete, speed }) => ({ sales, stock, price, complete, speed }))(
      computePushScore(emptyMonthStats(), false, product.refPriceSen, config.fulfillment, product, params),
    ),
    bulkRep: 0,
    riskPts: local ? params.riskStartPts.value : 0,
    auditCount: 0,
    payoutFrozenUntilDay: 0,
    pending: null,
    midChoices: {},
    orderBatches: [],
    restockBatches: [],
    bulkOrders: [],
    schedule: buildSchedule(config.seed, product, params),
    monthStats: emptyMonthStats(),
    quarterStats: emptyQuarterStats(),
    totals,
  };

  const events: GameEvent[] = [];
  if (local) events.push({ type: "setup_paid", day: 0, feeFen: setupFeeFen });
  events.push({
    type: "restock_ordered",
    day: 0,
    id: "R1-01",
    qty,
    unitCostFen: cost.unitCostFen,
    discountBp: cost.discountBp,
    goodsFen: cost.goodsFen,
    headHaulFen: cost.headHaulFen,
    totalFen: cost.totalFen,
    arriveDay: 0,
  });
  return { state, events };
}
