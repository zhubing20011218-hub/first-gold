// 事件：只带数据，不带中文（docs/01 第四节、docs/04 第十三节）。界面把事件变成文字和动画。
import type { PushResult } from "./push";
import type { MidChoice } from "./types";

type E<T extends string, D = object> = { type: T; day: number } & D;

export type GameEvent =
  /** 开局：本土店的开通费 */
  | E<"setup_paid", { feeFen: number }>
  | E<"month_started", { fixedCostFen: number; storageFeeFen: number; push: PushResult }>
  | E<"restock_ordered", { id: string; qty: number; unitCostFen: number; discountBp: number; goodsFen: number; headHaulFen: number; totalFen: number; arriveDay: number }>
  /** 被供应商上限减少 */
  | E<"restock_reduced", { wantedQty: number; actualQty: number; capQty: number }>
  | E<"restock_arrived", { id: string; qty: number }>
  | E<"event_delay", { delayDays: number }>
  | E<"event_bad_review", { ratingE1: number }>
  | E<"ads_ran", { budgetFen: number; adSpendFen: number; clicks: number; adOrders: number; refBidFen: number }>
  | E<"orders_shipped", { organicOrders: number; adOrders: number; shipped: number; lost: number; perOrderFeeFen: number; payoutFenEach: number }>
  | E<"orders_delivered", { orderDay: number; delivered: number; returned: number; settleDay: number }>
  | E<"payout_received", { orderDay: number; amountFen: number; orders: number; banned: boolean }>
  | E<"bulk_won", { inquiryId: string; unitPriceSen: number; effectiveSen: number; valueFen: number; depositFen: number; shipDay: number; warnDay: number }>
  | E<"bulk_lost", { inquiryId: string; unitPriceSen: number; effectiveSen: number; rivalBestSen: number }>
  | E<"bulk_on_track", { inquiryId: string; projectedQty: number }>
  | E<"bulk_short", { inquiryId: string; shortQty: number }>
  | E<"rush_ordered", { inquiryId: string; id: string; qty: number; unitCostFen: number; totalFen: number; arriveDay: number }>
  | E<"mid_choice", { inquiryId: string; choice: MidChoice }>
  | E<"bulk_shipped", { inquiryId: string; qty: number; freightFen: number }>
  | E<"bulk_delivered", { inquiryId: string; balanceDay: number; bulkRep: number }>
  | E<"bulk_paid", { inquiryId: string; amountFen: number }>
  | E<"bulk_defaulted", { inquiryId: string; depositFen: number; penaltyFen: number; bulkRep: number }>
  | E<"compliance_bought", { costFen: number; riskPts: number }>
  | E<"upgraded", { feeFen: number; moveFreightFen: number; movedQty: number }>
  | E<"upgrade_failed", { needFen: number; cashFen: number }>
  | E<"risk_updated", { riskPts: number; level: "low" | "mid" | "high" }>
  | E<"audit_started", { frozenUntilDay: number; riskPts: number }>
  | E<"banned", { recoveredFen: number }>
  | E<"bankrupt", { cashFen: number }>
  | E<"closing_started">
  | E<"finished", { cashFen: number }>;

export type GameEventType = GameEvent["type"];
