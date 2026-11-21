// 新版的状态和决定（改版方案第 5 稿）。两年 8 个季度，6 种商品一起卖，路线树 4 层。
import type { Product } from "../product";
import type { NextParams } from "../../params/next";

export type Params = NextParams;

/** 商品库和参数，一局里不变 */
export interface World {
  params: Params;
  products: readonly Product[];
}

/** 第 1 层：开局选发货方式。bulk = 主攻企业大单（跨境直发） */
export type Route1 = "cross" | "local" | "bulk";
/** 第 2 层：第一年 7 月选引流重心 */
export type Route2 = "ads" | "creator" | "organic";
/** 第 3 层：第二年 1 月按第一年的结果 */
export type Route3 = "good" | "bad";
/** 第 4 层：第二年 7 月选最后半年怎么冲 */
export type Route4 = "promo" | "bulk" | "safe";

export interface Routes {
  r1: Route1;
  r2: Route2 | null;
  r3: Route3 | null;
  r4: Route4 | null;
}

export type Fulfillment = "cross" | "local";

/** 每个季度玩家的决定 */
export interface QuarterDecision {
  /** 每种货这一季进多少件（季度第一天下单） */
  buy: Record<string, number>;
  /** 每种货的售价（仙） */
  priceSen: Record<string, number>;
  /** 这一季广告总预算（分），按库存自动分给在卖的货 */
  adBudgetFen: number;
  /** 广告出价，相对对手（10000 = 和对手一样） */
  adBidBp: number;
  /** 对哪些询单报价、每件报多少（仙） */
  bids: { inquiryId: string; unitPriceSen: number }[];
  /** 合规：0 不做，1 补齐资料，2 全套认证（只对海外仓） */
  compTier: number;
}

export interface OrderBatch {
  productId: string;
  orderDay: number;
  qty: number;
  payoutFenEach: number;
  /** 每件的进价，用来算利润 */
  unitCostFen: number;
  deliverDay: number;
  returnedQty: number | null;
  settleDay: number | null;
  paid: boolean;
  /** 双 11 当天的订单 */
  promo: boolean;
}

export interface RestockBatch {
  id: string;
  productId: string;
  orderDay: number;
  qty: number;
  unitCostFen: number;
  arriveDay: number;
  rush: boolean;
}

export type BulkStatus = "won" | "shipped" | "delivered" | "paid" | "defaulted";

export interface BulkOrder {
  inquiryId: string;
  productId: string;
  qty: number;
  unitPriceSen: number;
  rank: number;
  valueFen: number;
  depositFen: number;
  warnDay: number;
  shipDay: number;
  dueDay: number;
  balanceDay: number | null;
  status: BulkStatus;
}

export interface Inquiry {
  id: string;
  quarter: number;
  /** 这个季度的第几张（0 开始）。显示几张看路线 */
  index: number;
  productId: string;
  /** 一共要多少件（主攻大单的路线再乘一个倍数） */
  baseQty: number;
  dueDay: number;
  refPriceSen: number;
  /** 三家对手的真实报价 */
  rivalBidSen: number[];
  /** 打听来的对手报价（显示给玩家） */
  rivalEstimateSen: number[];
  /** 客户的名字编号，界面按编号显示名字 */
  clientNo: number;
}

export type EventKind =
  | "viral"
  | "streamer"
  | "homepage"
  | "bigclient"
  | "typhoon"
  | "pricewar"
  | "audit"
  | "malicious";

export const GOOD_EVENTS: readonly EventKind[] = ["viral", "streamer", "homepage", "bigclient"];
export const BAD_EVENTS: readonly EventKind[] = ["typhoon", "pricewar", "audit", "malicious"];

export interface ScheduledEvent {
  quarter: number;
  day: number;
  kind: EventKind;
}

export interface Schedule {
  /** 每个季度每种货的趋势（bp） */
  trendBp: Record<string, number>[];
  /** 每个季度每种货事先看不到的波动（bp） */
  surpriseBp: Record<string, number>[];
  inquiries: Inquiry[];
  /** 每个季度平常显示几张询单 */
  inquiryCount: number[];
  events: ScheduledEvent[];
  /** 每年的运输延误日 */
  delayDays: number[];
  /** 每年的差评日 */
  badReviewDays: number[];
  /** 达人直播日（只在选了达人的路线上生效） */
  creatorDays: number[];
  /** 三家对手每个季度的店铺综合分 */
  rivalComp: number[][];
  /** 三家对手每个季度赚了多少 */
  rivalProfitFen: number[][];
  /** 第 3 层：绿色时的机会、蓝色时的危机 */
  goodCard: EventKind;
  badCard: EventKind;
}

/** 一段时间内的效果 */
export interface Effect {
  kind: "viral" | "homepage" | "pricewar_ignore" | "pricewar_follow";
  productId: string | null;
  fromDay: number;
  toDay: number;
  bp: number;
}

export type Pending =
  | { kind: "bulk_short"; inquiryId: string; productId: string; shortQty: number }
  | { kind: "event"; event: EventKind; productId: string | null; card: boolean }
  | { kind: "pack"; wanted: Record<string, number> };

export type Answer =
  | { kind: "bulk_short"; choice: "rush" | "ignore" }
  | { kind: "event"; choice: "a" | "b" }
  | { kind: "pack"; packBp: number };

export interface MonthStats {
  wanted: number;
  shipped: number;
  lost: number;
  delivered: number;
  returned: number;
  delayed: boolean;
  /** 发出的件数按商品（算仓储费） */
  shippedBy: Record<string, number>;
  /** 每种货发出的件数乘价格分（算推流分的价格一项） */
  pricePtsSum: number;
}

export interface QuarterStats {
  wanted: number;
  lost: number;
  badReviews: number;
  bulkDefaults: number;
  /** 每种货：零售卖了多少、收入多少、进价多少、广告多少 */
  soldBy: Record<string, number>;
  revenueBy: Record<string, number>;
  cogsBy: Record<string, number>;
  adBy: Record<string, number>;
  lostBy: Record<string, number>;
}

export interface Totals {
  setupFeeFen: number;
  complianceFen: number;
  restockFen: number;
  adSpendFen: number;
  perOrderFeeFen: number;
  fixedCostFen: number;
  storageFen: number;
  payoutFen: number;
  bulkInFen: number;
  bulkOutFen: number;
  eventCostFen: number;
  promoFeeFen: number;
  loanFen: number;
  interestFen: number;
  ordersShipped: number;
  ordersReturned: number;
  lostSales: number;
  bulkWon: number;
  bulkDelivered: number;
  bulkDefaulted: number;
  /** 双 11 当天的订单的利润（平台打款减进价、减每单费用，不算退货） */
  promoProfitFen: number;
}

export type Phase = "running" | "bankrupt" | "banned" | "finished";

export interface GameState {
  seed: number;
  day: number;
  phase: Phase;
  routes: Routes;
  fulfillment: Fulfillment;
  cashFen: number;
  /** 每种货在仓库里的件数 */
  stock: Record<string, number>;
  ratingE1: number;
  priceSen: Record<string, number>;
  adBudgetFen: number;
  adBidBp: number;
  /** 推流分五项，月初算（价格一项月初按上个月算好） */
  push: { sales: number; stock: number; price: number; complete: number; speed: number };
  /** 交大单记录：按时次数、违约次数 */
  onTime: number;
  defaults: number;
  /** 违约还没恢复的扣分 */
  breachPts: number;
  riskPts: number;
  auditCount: number;
  payoutFrozenUntilDay: number;
  pending: Pending | null;
  /** 回答过的事件（按顺序），重放时用 */
  answers: Answer[];
  orderBatches: OrderBatch[];
  restockBatches: RestockBatch[];
  bulkOrders: BulkOrder[];
  effects: Effect[];
  schedule: Schedule;
  monthStats: MonthStats;
  quarterStats: QuarterStats;
  totals: Totals;
  /** 价格战时跟着降过价 */
  followedPriceWar: boolean;
  /** 稳住现金的借款（还没还的） */
  loanFen: number;
  /** 每个季度结束时的净资产（成绩卡、第 3 层用） */
  netWorthAtQuarterEnd: number[];
  /** 这些天的停顿（事件、双 11 打包）已经回答过 */
  handled: number[];
  /** 最近一次双 11 打包发出的比例 */
  packBp: number;
}
