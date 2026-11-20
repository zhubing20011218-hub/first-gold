// 一局游戏的状态和玩家的决定（docs/04 第二、三节）
import type { MonthStats, PushScore } from "./push";
import type { Schedule } from "./schedule";

/** 跨境直发 | 本土店 */
export type Fulfillment = "cross" | "local";

export interface GameConfig {
  seed: number;
  productId: string;
  /** 开局时的发货方式 */
  fulfillment: Fulfillment;
  startCashFen: number;
  /** 第一批进货的件数 */
  firstStockQty: number;
}

export type MidChoice = "rush" | "ignore";

export interface QuarterDecision {
  /** 每月初自动补货的件数。0 表示不补 */
  monthlyRestockQty: number;
  /** 零售售价 */
  priceSen: number;
  /** 广告出价：愿意为一次点击付多少钱。0 表示不投 */
  adBidFen: number;
  /** 广告每日预算。0 表示不投 */
  adDailyBudgetFen: number;
  /** 对哪些询价单报价、报多少 */
  bulkQuotes: { inquiryId: string; unitPriceSen: number }[];
  /** 季度中间的选择，重放时用（docs/04 第十六节） */
  bulkShortChoices?: { inquiryId: string; choice: MidChoice }[];
  /** 花钱做合规。只对本土店有效 */
  buyCompliance: boolean;
  /** 升级成本土店。只对跨境店有效 */
  upgradeToLocal: boolean;
}

/** 同一天的零售订单合成一批 */
export interface OrderBatch {
  orderDay: number;
  /** 下单那天的发货方式 */
  fulfillment: Fulfillment;
  qty: number;
  /** 每单的平台打款，下单当天按 docs/03 算好 */
  payoutFenEach: number;
  deliverDay: number;
  /** 签收那天才知道 */
  returnedQty: number | null;
  /** 签收那天才知道 */
  settleDay: number | null;
  paid: boolean;
}

export interface RestockBatch {
  id: string;
  orderDay: number;
  qty: number;
  unitCostFen: number;
  arriveDay: number;
  rush: boolean;
}

export type BulkStatus = "won" | "shipped" | "delivered" | "paid" | "defaulted";

/** 中标的大单 */
export interface BulkOrder {
  inquiryId: string;
  qty: number;
  unitPriceSen: number;
  /** 合同金额 */
  valueFen: number;
  depositFen: number;
  /** 哪一天检查货够不够 */
  warnDay: number;
  /** 哪一天要把货发出 */
  shipDay: number;
  dueDay: number;
  /** 尾款到账日，交货那天才知道 */
  balanceDay: number | null;
  status: BulkStatus;
}

export interface QuarterStats {
  wanted: number;
  lost: number;
  badReviews: number;
  bulkDefaults: number;
}

export interface Totals {
  /** 本土店开通费 */
  setupFeeFen: number;
  complianceFen: number;
  /** 进货的钱，含本土店的头程运费、升级时搬库存的运费 */
  restockFen: number;
  adSpendFen: number;
  perOrderFeeFen: number;
  fixedCostFen: number;
  /** 本土店的仓储费 */
  storageFen: number;
  /** 已到账的平台货款（含封店时拿回的那一半） */
  payoutFen: number;
  /** 大单收到的定金和尾款 */
  bulkInFen: number;
  /** 大单付出的运费、退回的定金、违约金 */
  bulkOutFen: number;
  unitsBought: number;
  ordersShipped: number;
  ordersReturned: number;
  lostSales: number;
  adClicks: number;
  bulkWon: number;
  bulkDelivered: number;
  bulkDefaulted: number;
  /** 大单发出的件数 */
  bulkUnits: number;
}

export type Phase = "running" | "closing" | "bankrupt" | "banned" | "finished";

export interface Pending {
  kind: "bulk_short";
  inquiryId: string;
  shortQty: number;
}

export interface GameState {
  config: GameConfig;
  day: number;
  phase: Phase;
  /** 现在的发货方式，升级后会变 */
  fulfillment: Fulfillment;
  cashFen: number;
  stockQty: number;
  /** 店铺评分乘以 10 */
  ratingE1: number;
  priceSen: number;
  adBidFen: number;
  adDailyBudgetFen: number;
  monthlyRestockQty: number;
  /** 推流分，每个月初重新算（价格那一项用的时候按当前售价再算） */
  pushScore: PushScore;
  /** 大单信誉，0 到 bulkRepMax */
  bulkRep: number;
  /** 本土店的风险值，0 到 100 */
  riskPts: number;
  /** 被审核过几次 */
  auditCount: number;
  /** 这一天之前平台货款不到账。没有冻结时是 0 */
  payoutFrozenUntilDay: number;
  /** 正在等玩家选择（docs/04 第十六节） */
  pending: Pending | null;
  /** 每张大单在检查那天的结果 */
  midChoices: Record<string, MidChoice | "none">;
  orderBatches: OrderBatch[];
  /** 全部补货单，包括已经到货的。开局的第一批货不在这里（它第 0 天就在库存里） */
  restockBatches: RestockBatch[];
  bulkOrders: BulkOrder[];
  /** 开局时就定好的事件和询价单 */
  schedule: Schedule;
  /** 这个月的统计 */
  monthStats: MonthStats;
  /** 这个季度的统计 */
  quarterStats: QuarterStats;
  /** 累计数 */
  totals: Totals;
}
