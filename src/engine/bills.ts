// 季度账单（docs/04 第十七节）。把一个季度的事件整理成一笔一笔的账。
import type { GameEvent } from "./events";
import type { Params } from "./util";

export type BillKind =
  | "restock"
  | "rush"
  | "bulk_freight"
  | "ads"
  | "order_fee"
  | "payout"
  | "bulk_deposit"
  | "bulk_balance"
  | "bulk_penalty"
  | "fixed"
  | "storage"
  | "compliance"
  | "setup";

export type BillRole = "purchase" | "ops" | "finance";

export interface Bill {
  /** 例如 "Q4-RST-02"：第 4 个季度、进货、第 2 笔 */
  id: string;
  day: number;
  role: BillRole;
  kind: BillKind;
  /** 收入是正数，支出是负数 */
  amountFen: number;
  /** 对应的补货单或询价单的编号 */
  refId?: string;
  /** 这一笔包含多少件、多少单或多少次点击 */
  count?: number;
}

const CODE: Record<BillKind, string> = {
  restock: "RST",
  rush: "RSH",
  bulk_freight: "FRT",
  ads: "ADS",
  order_fee: "FEE",
  payout: "PAY",
  bulk_deposit: "DEP",
  bulk_balance: "BAL",
  bulk_penalty: "PEN",
  fixed: "FIX",
  storage: "STO",
  compliance: "CMP",
  setup: "SET",
};

const ROLE: Record<BillKind, BillRole> = {
  restock: "purchase",
  rush: "purchase",
  bulk_freight: "purchase",
  ads: "ops",
  order_fee: "ops",
  payout: "finance",
  bulk_deposit: "finance",
  bulk_balance: "finance",
  bulk_penalty: "finance",
  fixed: "finance",
  storage: "finance",
  compliance: "finance",
  setup: "finance",
};

/** 事件属于第几个季度。第 720 天之后收尾阶段的钱算在最后一个季度 */
export function quarterOfDay(day: number, quarters: number): number {
  return Math.min(Math.floor(day / 90), quarters - 1);
}

type Draft = Omit<Bill, "id" | "role">;

/** 把一个事件变成 0 到 2 笔账（还没编号） */
function draftsOf(e: GameEvent): Draft[] {
  switch (e.type) {
    case "setup_paid":
      return [{ day: e.day, kind: "setup", amountFen: -e.feeFen }];
    case "upgraded":
      return [{ day: e.day, kind: "setup", amountFen: -(e.feeFen + e.moveFreightFen), count: e.movedQty }];
    case "restock_ordered":
      return [{ day: e.day, kind: "restock", amountFen: -e.totalFen, refId: e.id, count: e.qty }];
    case "rush_ordered":
      return [{ day: e.day, kind: "rush", amountFen: -e.totalFen, refId: e.id, count: e.qty }];
    case "bulk_shipped":
      return e.freightFen > 0
        ? [{ day: e.day, kind: "bulk_freight", amountFen: -e.freightFen, refId: e.inquiryId, count: e.qty }]
        : [];
    case "payout_received":
      return [{ day: e.day, kind: "payout", amountFen: e.amountFen, count: e.orders }];
    case "bulk_won":
      return [{ day: e.day, kind: "bulk_deposit", amountFen: e.depositFen, refId: e.inquiryId }];
    case "bulk_paid":
      return [{ day: e.day, kind: "bulk_balance", amountFen: e.amountFen, refId: e.inquiryId }];
    case "bulk_defaulted":
      return [{ day: e.day, kind: "bulk_penalty", amountFen: -(e.depositFen + e.penaltyFen), refId: e.inquiryId }];
    case "month_started": {
      const out: Draft[] = [{ day: e.day, kind: "fixed", amountFen: -e.fixedCostFen }];
      if (e.storageFeeFen > 0) out.push({ day: e.day, kind: "storage", amountFen: -e.storageFeeFen });
      return out;
    }
    case "compliance_bought":
      return [{ day: e.day, kind: "compliance", amountFen: -e.costFen }];
    default:
      return [];
  }
}

/**
 * 一个季度的账单。events 可以是整局的事件，这里只取属于第 q 个季度的。
 * 广告费和每单的费用每个月合成一笔，记在这个月第一次发生的那天。
 */
export function buildQuarterBills(q: number, events: readonly GameEvent[], params: Params): Bill[] {
  const quarters = params.quartersPerGame.value;
  const drafts: Draft[] = [];
  const monthly = new Map<string, Draft>();
  for (const e of events) {
    if (quarterOfDay(e.day, quarters) !== q) continue;
    if (e.type === "ads_ran" && e.adSpendFen > 0) {
      addMonthly(monthly, drafts, "ads", e.day, -e.adSpendFen, e.clicks);
    } else if (e.type === "orders_shipped" && e.shipped > 0) {
      addMonthly(monthly, drafts, "order_fee", e.day, -e.shipped * e.perOrderFeeFen, e.shipped);
    } else {
      drafts.push(...draftsOf(e));
    }
  }
  // 按日期排（同一天保持事件的先后），同一种 kind 里从 01 开始编号
  const sorted = drafts.map((d, i) => ({ d, i })).sort((a, b) => a.d.day - b.d.day || a.i - b.i);
  const seq = new Map<BillKind, number>();
  return sorted.map(({ d }) => {
    const n = (seq.get(d.kind) ?? 0) + 1;
    seq.set(d.kind, n);
    return { ...d, id: `Q${q + 1}-${CODE[d.kind]}-${String(n).padStart(2, "0")}`, role: ROLE[d.kind] };
  });
}

function addMonthly(monthly: Map<string, Draft>, drafts: Draft[], kind: BillKind, day: number, amountFen: number, count: number): void {
  const key = `${kind}:${Math.floor(day / 30)}`;
  const existing = monthly.get(key);
  if (existing) {
    existing.amountFen += amountFen;
    existing.count = (existing.count ?? 0) + count;
    return;
  }
  const draft: Draft = { day, kind, amountFen, count };
  monthly.set(key, draft);
  drafts.push(draft);
}

/** 季初现金加上这个季度所有的账，等于季末现金 */
export function verifyQuarter(startCashFen: number, bills: readonly Bill[], endCashFen: number): boolean {
  return startCashFen + bills.reduce((sum, b) => sum + b.amountFen, 0) === endCashFen;
}
