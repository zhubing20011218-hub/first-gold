// "这一季大约"：按玩家现在填的数，估一个季度能卖多少、赚多少、季末现金多少。
// 只用平均数（不看每天的波动、不看还没发生的事件），所以和真实结果会有差别。
import { applyBp } from "../../engine/money";
import { ratingFactorBp } from "../../engine/market";
import { settleOrder } from "../../engine/settle";
import { restockCostFen } from "../../engine/stock";
import { adShareBp } from "../../engine/ads";
import { calendarOf } from "../../engine/util";
import {
  DAYS_PER_QUARTER,
  availableQty,
  heatBp,
  inTransitQty,
  leadDays,
  netWorthFen,
  priceFactorVsRival,
  pushBp,
  shopLevel,
  quarterOf,
} from "../../engine/next/core";
import type { GameState, QuarterDecision, World } from "../../engine/next/types";

export interface ProductEstimate {
  productId: string;
  /** 这一季大约有多少人要买 */
  demand: number;
  /** 能卖的货：仓里能卖的 + 路上的 + 这一季进的 */
  supply: number;
  sold: number;
  left: number;
  /** 这一批进货的钱 */
  buyFen: number;
  discountBp: number;
  /** 一单赚多少（打款 − 进价 − 每单费用），不算广告和退货 */
  unitProfitFen: number;
  adFen: number;
  profitFen: number;
}

export interface QuarterEstimate {
  products: ProductEstimate[];
  sold: number;
  /** 进货 + 广告 + 合规 */
  spendFen: number;
  /** 季末账单（固定开支、仓储费）的估计 */
  billsFen: number;
  profitFen: number;
  endCashFen: number;
  left: number;
  adShareBp: number;
  adOrders: number;
  /** 达人直播大约带来多少单 */
  creatorOrders: number;
}

export function estimateQuarter(state: GameState, d: QuarterDecision, world: World): QuarterEstimate {
  const { params, products } = world;
  const q = quarterOf(state.day);
  const push = pushBp(state, params);
  const rf = ratingFactorBp(state.ratingE1, params);
  const routeBp = state.routes.r1 === "bulk" ? params.bulkRouteOrganicBp.value : state.routes.r1 === "cross" ? params.crossOrganicBp.value : 10000;
  const breachBp = Math.max(0, 10000 - Math.max(0, state.breachPts - (q > 0 ? params.breachDecayPts.value : 0)) * params.breachDemandBpPerPt.value);
  const lead = q === 0 ? 0 : leadDays(state.fulfillment, params);
  const { season, year } = calendarOf(state.day);
  const competitionBp = applyBp(params.seasonCompetitionBp.value[season], year === 0 ? 10000 : params.year2CompetitionBp.value);
  const perOrderFen = state.fulfillment === "cross" ? params.crossForwarderFeeFen.value : params.localLabelFeeFen.value;

  // 广告：一个总预算，按货的多少分
  const supplies = products.map((p) => availableQty(state, p.id) + inTransitQty(state, p.id) + (d.buy[p.id] ?? 0));
  const supplySum = supplies.reduce((a, b) => a + b, 0);
  const topIdx = supplies.indexOf(Math.max(...supplies));
  let creatorOrders = 0;
  let share = 0;
  let adOrders = 0;

  let spendFen = 0;
  let sold = 0;
  let left = 0;
  let profitFen = 0;
  let receiveFen = 0;
  const rows: ProductEstimate[] = products.map((p, i) => {
    const price = d.priceSen[p.id] ?? state.priceSen[p.id];
    const pf = priceFactorVsRival(state, q, price, p, params);
    let m = applyBp(p.organicPerDayMilli, params.marketScaleBp.value);
    for (const bp of [heatBp(state, q, p, params), push, pf, rf, routeBp, breachBp]) m = applyBp(m, bp);
    let demand = Math.floor((m * DAYS_PER_QUARTER) / 1000);

    const buy = d.buy[p.id] ?? 0;
    const cost = buy > 0 ? restockCostFen(buy, state.fulfillment, p, params) : null;
    const buyFen = cost ? cost.totalFen : 0;
    spendFen += buyFen;

    let adFen = 0;
    if (d.adBudgetFen > 0 && supplySum > 0 && supplies[i] > 0) {
      adFen = Math.floor((d.adBudgetFen * supplies[i]) / supplySum);
      const refBid = Math.max(1, applyBp(p.baseCpcFen, competitionBp));
      const bid = Math.max(1, applyBp(refBid, d.adBidBp));
      let ratio = Math.floor((bid * push) / refBid);
      if (state.routes.r2 === "ads") ratio = applyBp(ratio, params.adRouteRatioBp.value);
      share = adShareBp(ratio, params);
      let pool = applyBp(applyBp(p.adClickPoolPerDay, params.adPoolScaleBp.value), heatBp(state, q, p, params));
      if (state.routes.r2 === "ads") pool = applyBp(pool, params.adRoutePoolBp.value);
      const clicks = Math.min(applyBp(pool, share) * DAYS_PER_QUARTER, Math.floor(adFen / bid));
      adFen = clicks * bid;
      const orders = Math.floor(applyBp(applyBp(Math.floor((clicks * p.adCvrBp) / 10), pf), rf) / 1000);
      adOrders += orders;
      demand += orders;
    }

    // 选了达人直播：库存最多的那种货每季有几场直播
    if (state.routes.r2 === "creator" && q >= 2 && i === topIdx) {
      const live = Math.floor(applyBp(applyBp(applyBp(p.organicPerDayMilli, params.marketScaleBp.value), params.creatorBurstBp.value), heatBp(state, q, p, params)) / 1000);
      creatorOrders = live * params.creatorPerQuarter.value;
      demand += creatorOrders;
    }

    // 现在没货的话，等新货到之前的那几天卖不了
    const now = availableQty(state, p.id) + inTransitQty(state, p.id);
    const supply = now + buy;
    const lostDays = now === 0 ? lead : 0;
    const sellable = Math.floor((demand * (DAYS_PER_QUARTER - lostDays)) / DAYS_PER_QUARTER);
    const s = Math.min(sellable, supply);
    const payout = settleOrder(
      { fulfillment: state.fulfillment, priceSen: price, weightG: p.weightG, region: "west", creatorBp: 0, joinCashback: false },
      params,
    ).payoutFen;
    const unit = payout - p.costFen - perOrderFen;
    const keepBp = 10000 - p.returnBp;
    const profit = applyBp(s * unit, keepBp) - adFen;
    spendFen += adFen;
    sold += s;
    left += supply - s;
    profitFen += profit;
    // 一个季度里大约七成的货款能到账（送货和结算要两三个星期）
    receiveFen += applyBp(applyBp(s * payout, keepBp), 7000) - s * perOrderFen;
    return {
      productId: p.id,
      demand,
      supply,
      sold: s,
      left: supply - s,
      buyFen,
      discountBp: cost ? cost.discountBp : 0,
      unitProfitFen: unit,
      adFen,
      profitFen: profit,
    };
  });
  const comp = state.fulfillment === "local" ? params.complianceTierCostFen.value[d.compTier] ?? 0 : 0;
  spendFen += comp;
  const billsFen = (params.levelFixedCostFen.value[shopLevel(netWorthFen(state, world), params)] ?? 0) * 3;
  profitFen -= comp + billsFen;
  const endCashFen = state.cashFen - spendFen - billsFen + receiveFen;
  return { products: rows, sold, spendFen, billsFen, profitFen, endCashFen, left, adShareBp: share, adOrders, creatorOrders };
}
