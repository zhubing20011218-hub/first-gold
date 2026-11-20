// 商品的字段（docs/05 第一节）。类型放在 engine，因为 engine 只能引用 params 的类型（docs/01 第四节）；
// src/products/types.ts 从这里导出同一个类型。

export type ProductKind = "volume" | "margin" | "risky";

export interface Product {
  id: string;
  /** 走量型 | 利润型 | 高风险型 */
  kind: ProductKind;
  /** 进价，每件 */
  costFen: number;
  /** 打包后的重量 */
  weightG: number;
  /** 打包后的体积，立方厘米。用来算本土店的仓储费 */
  volumeCm3: number;
  /** 起订量 */
  moq: number;
  minPriceSen: number;
  /** 参考售价（市场上的普通价格） */
  refPriceSen: number;
  maxPriceSen: number;
  /** 价格敏感度乘以 100。150 表示贵 10%，订单少 15% */
  elasticityE2: number;
  /** 不投广告时每天的订单，单位是千分之一单 */
  organicPerDayMilli: number;
  /** 市场上每天最多能买到的点击数 */
  adClickPoolPerDay: number;
  /** 平时的市场参考出价，每次点击 */
  baseCpcFen: number;
  /** 广告点击变成订单的比例 */
  adCvrBp: number;
  /** 退货率 */
  returnBp: number;
  /** 四个季节的市场热度倍数：1 到 3 月、4 到 6 月、7 到 9 月、10 到 12 月 */
  seasonBp: readonly [number, number, number, number];
  /** 每年会遇到几次差评 */
  badReviewCount: number;
  /** 供应商每个月最多能供多少件 */
  supplierMonthlyCap: number;
  /** 批发询价单的基础件数 */
  bulkQtyBase: number;
  /** 市场批发参考价，每件 */
  bulkRefPriceSen: number;
  /** 卡片上显示的 5 个评分，1 到 5 */
  scores: {
    demand: number;
    unitProfit: number;
    capital: number;
    afterSales: number;
    competition: number;
  };
}
