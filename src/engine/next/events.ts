// 新版的事件：只带数据，不带中文。界面把事件变成文字和动画。
import type { EventKind, Route1, Route2, Route3, Route4 } from "./types";

type E<T extends string, D = object> = { type: T; day: number } & D;

export type NextEvent =
  | E<"setup_paid", { feeFen: number }>
  | E<"route_chosen", { layer: number; option: Route1 | Route2 | Route3 | Route4 }>
  | E<"promo_fee_paid", { feeFen: number }>
  | E<"month_started", { fixedCostFen: number; storageFeeFen: number; pushTotal: number }>
  | E<"restock_ordered", { id: string; productId: string; qty: number; unitCostFen: number; totalFen: number; arriveDay: number }>
  | E<"restock_arrived", { id: string; productId: string; qty: number }>
  | E<"compliance_bought", { tier: number; costFen: number; riskPts: number }>
  | E<"compliance_failed", { tier: number; needFen: number }>
  | E<"bid_result", { inquiryId: string; productId: string; rank: number; qty: number; unitPriceSen: number; totals: number[] }>
  | E<"bulk_won", { inquiryId: string; productId: string; qty: number; valueFen: number; depositFen: number; shipDay: number }>
  | E<"bulk_short", { inquiryId: string; productId: string; shortQty: number }>
  | E<"rush_ordered", { inquiryId: string; productId: string; qty: number; totalFen: number; arriveDay: number }>
  | E<"bulk_shipped", { inquiryId: string; productId: string; qty: number; freightFen: number }>
  | E<"bulk_delivered", { inquiryId: string; balanceDay: number }>
  | E<"bulk_paid", { inquiryId: string; amountFen: number }>
  | E<"bulk_defaulted", { inquiryId: string; depositFen: number; penaltyFen: number; breachPts: number }>
  | E<"sales", { productId: string; organic: number; ad: number; extra: number; shipped: number; lost: number; adSpendFen: number; payoutFenEach: number }>
  | E<"orders_delivered", { productId: string; delivered: number; returned: number }>
  | E<"payout_received", { amountFen: number; orders: number }>
  | E<"event_delay", { delayDays: number }>
  | E<"event_bad_review", { ratingE1: number }>
  | E<"event_started", { kind: EventKind; productId: string | null; card: boolean }>
  | E<"event_answered", { kind: EventKind; choice: "a" | "b"; costFen: number }>
  | E<"creator_live", { productId: string; orders: number }>
  | E<"double11", { packBp: number; wanted: number; shipped: number }>
  | E<"risk_updated", { riskPts: number }>
  | E<"audit_started", { frozenUntilDay: number }>
  | E<"banned">
  | E<"loan_taken", { amountFen: number }>
  | E<"loan_repaid", { amountFen: number; interestFen: number }>
  | E<"quarter_ended", { quarter: number; netWorthFen: number; cashFen: number }>
  | E<"bankrupt", { cashFen: number }>
  | E<"finished", { netWorthFen: number }>;
