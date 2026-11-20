// 把一组局的结果汇总成报告里的一行，再拼成 模拟报告.md（任务 04 第 2.4 节）
import type { Ending, GameResult, Route } from "./play";

export interface Row {
  productId: string;
  route: Route;
  strategy: string;
  n: number;
  endings: Record<Ending, number>;
  nwMin: number;
  nwMedian: number;
  nwMax: number;
  minCashMedian: number;
  minCashDayMedian: number;
  pushAvg: number;
  pushY1: number;
  pushY2: number;
  adSpendAvg: number;
  adSpendRatioBp: number;
  shippedAvg: number;
  lostAvg: number;
  returnedAvg: number;
  bulkWonAvg: number;
  bulkDeliveredAvg: number;
  bulkDefaultedAvg: number;
  bulkShareBp: number;
  storageAvg: number;
  disc5Bp: number;
  disc10Bp: number;
  auditedBp: number;
  banQuarterAvg: number | null;
  daysMedian: number;
  /** 第一个季度结束之前倒闭的局 */
  firstQuarterBankruptBp: number;
  /** 平均每局定的广告预算（每天的预算加起来） */
  adBudgetAvg: number;
}

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}
const avg = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const bp = (part: number, whole: number): number => (whole === 0 ? 0 : Math.round((part * 10000) / whole));

export function summarize(productId: string, route: Route, strategy: string, rs: GameResult[]): Row {
  const endings: Record<Ending, number> = { bankrupt: 0, banned: 0, survived: 0, firstGold: 0 };
  for (const r of rs) endings[r.ending] += 1;
  const pushY1 = rs.reduce((s, r) => s + r.pushSum[0], 0) / Math.max(1, rs.reduce((s, r) => s + r.pushCount[0], 0));
  const y2Count = rs.reduce((s, r) => s + r.pushCount[1], 0);
  const pushY2 = y2Count === 0 ? 0 : rs.reduce((s, r) => s + r.pushSum[1], 0) / y2Count;
  const allPush = rs.reduce((s, r) => s + r.pushSum[0] + r.pushSum[1], 0);
  const allCount = rs.reduce((s, r) => s + r.pushCount[0] + r.pushCount[1], 0);
  const restocks = rs.reduce((s, r) => s + r.restocks, 0);
  const bans = rs.filter((r) => r.banQuarter !== null).map((r) => r.banQuarter ?? 0);
  return {
    productId,
    route,
    strategy,
    n: rs.length,
    endings,
    nwMin: Math.min(...rs.map((r) => r.netWorthFen)),
    nwMedian: median(rs.map((r) => r.netWorthFen)),
    nwMax: Math.max(...rs.map((r) => r.netWorthFen)),
    minCashMedian: median(rs.map((r) => r.minCashFen)),
    minCashDayMedian: median(rs.map((r) => r.minCashDay)),
    pushAvg: allCount === 0 ? 0 : allPush / allCount,
    pushY1,
    pushY2,
    adSpendAvg: avg(rs.map((r) => r.adSpendFen)),
    adSpendRatioBp: bp(rs.reduce((s, r) => s + r.adSpendFen, 0), rs.reduce((s, r) => s + r.adBudgetFen, 0)),
    shippedAvg: avg(rs.map((r) => r.shipped)),
    lostAvg: avg(rs.map((r) => r.lost)),
    returnedAvg: avg(rs.map((r) => r.returned)),
    bulkWonAvg: avg(rs.map((r) => r.bulkWon)),
    bulkDeliveredAvg: avg(rs.map((r) => r.bulkDelivered)),
    bulkDefaultedAvg: avg(rs.map((r) => r.bulkDefaulted)),
    bulkShareBp: bp(
      rs.reduce((s, r) => s + r.bulkIncomeFen, 0),
      rs.reduce((s, r) => s + r.bulkIncomeFen + r.retailIncomeFen, 0),
    ),
    storageAvg: avg(rs.map((r) => r.storageFen)),
    disc5Bp: bp(rs.reduce((s, r) => s + r.restocks5, 0), restocks),
    disc10Bp: bp(rs.reduce((s, r) => s + r.restocks10, 0), restocks),
    auditedBp: bp(rs.filter((r) => r.audited).length, rs.length),
    banQuarterAvg: bans.length === 0 ? null : avg(bans),
    daysMedian: median(rs.map((r) => r.days)),
    firstQuarterBankruptBp: bp(rs.filter((r) => r.bankruptDay !== null && r.bankruptDay < 90).length, rs.length),
    adBudgetAvg: avg(rs.map((r) => r.adBudgetFen)),
  };
}

// ---------- 显示 ----------
const yuan = (fen: number): string => {
  const v = Math.round(fen / 100);
  return `${v < 0 ? "-" : ""}¥${Math.abs(v).toLocaleString("en-US")}`;
};
const pct = (b: number): string => `${(b / 100).toFixed(0)}%`;
const share = (count: number, n: number): string => pct(bp(count, n));
const f1 = (x: number): string => x.toFixed(1);
const f0 = (x: number): string => Math.round(x).toLocaleString("en-US");

export const ROUTE_NAMES: Record<Route, string> = { cross: "一直跨境", local: "一直本土", upgrade: "第二年升级" };

export interface SandboxCheck {
  productId: string;
  seedsWithTies: number;
  seeds: number;
}

export interface ReportInput {
  rows: Row[];
  sandbox: SandboxCheck[];
  productNames: Record<string, string>;
  strategyNames: Record<string, string>;
  strategyOrder: string[];
  goalFen: number;
  startCashFen: number;
  fixedCostFen: number;
  seeds: number;
}

export function buildReport(input: ReportInput): string {
  const { rows, productNames, strategyNames } = input;
  const name = (r: Row): string => `${productNames[r.productId]} · ${ROUTE_NAMES[r.route]} · ${strategyNames[r.strategy]}`;
  const out: string[] = [];
  out.push("# 模拟报告");
  out.push("");
  out.push(
    `由 \`npm run sim\` 生成（\`scripts/simulate.ts\`），不要手改。6 种商品 × 3 种店铺路线 × ${input.strategyOrder.length} 种打法，每种组合跑种子 1 到 ${input.seeds}。启动资金 ${yuan(input.startCashFen)}，"赚到第一桶金"要求净资产不少于 ${yuan(input.goalFen)}。`,
  );
  out.push("");
  out.push("金额是人民币，四舍五入到元。比例是占这一行局数的比例。");
  out.push("");

  out.push("## 一、结局和净资产");
  out.push("");
  out.push("| 组合 | 倒闭 | 被封店 | 活下来了 | 第一桶金 | 第一个季度就倒闭 | 净资产 最低 | 中位数 | 最高 | 现金最低点 中位数 | 出现在第几天 | 一局天数 |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    out.push(
      `| ${name(r)} | ${share(r.endings.bankrupt, r.n)} | ${share(r.endings.banned, r.n)} | ${share(r.endings.survived, r.n)} | ${share(r.endings.firstGold, r.n)} | ${pct(r.firstQuarterBankruptBp)} | ${yuan(r.nwMin)} | ${yuan(r.nwMedian)} | ${yuan(r.nwMax)} | ${yuan(r.minCashMedian)} | ${r.minCashDayMedian} | ${r.daysMedian} |`,
    );
  }
  out.push("");

  out.push("## 二、经营");
  out.push("");
  out.push("| 组合 | 推流分 平均 | 第一年 | 第二年 | 广告 每局花费 | 花掉的占预算 | 零售 发出 | 缺货 | 退货 | 大单 中标 | 按时交货 | 违约 | 大单收入占比 | 仓储费 | 进货 5% 折扣 | 10% 折扣 | 被审核 | 平均第几季度被封 |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const local = r.route !== "cross";
    out.push(
      `| ${name(r)} | ${f1(r.pushAvg)} | ${f1(r.pushY1)} | ${r.pushY2 === 0 ? "-" : f1(r.pushY2)} | ${yuan(r.adSpendAvg)} | ${r.adBudgetAvg === 0 ? "-" : pct(r.adSpendRatioBp)} | ${f0(r.shippedAvg)} | ${f0(r.lostAvg)} | ${f0(r.returnedAvg)} | ${f1(r.bulkWonAvg)} | ${f1(r.bulkDeliveredAvg)} | ${f1(r.bulkDefaultedAvg)} | ${pct(r.bulkShareBp)} | ${local ? yuan(r.storageAvg) : "-"} | ${pct(r.disc5Bp)} | ${pct(r.disc10Bp)} | ${local ? pct(r.auditedBp) : "-"} | ${local && r.banQuarterAvg !== null ? f1(r.banQuarterAvg) : "-"} |`,
    );
  }
  out.push("");

  out.push("## 三、沙盘是否成立");
  out.push("");
  out.push("每种商品取种子 1 到 20（一直跨境），同一个种子下各种打法的净资产是否互不相同。下表是出现了两种打法结果完全一样的种子数，正常应该是 0 或很少。");
  out.push("");
  out.push("| 商品 | 出现相同结果的种子数 |");
  out.push("|---|---|");
  for (const s of input.sandbox) out.push(`| ${productNames[s.productId]} | ${s.seedsWithTies} / ${s.seeds} |`);
  out.push("");

  out.push("## 四、结论");
  out.push("");
  out.push(...conclusions(input));
  out.push("");
  return `${out.join("\n")}`;
}

function listAll(names: string[]): string {
  return names.length === 0 ? "没有" : names.join("、");
}

function conclusions(input: ReportInput): string[] {
  const { rows, productNames, strategyNames } = input;
  const name = (r: Row): string => `${productNames[r.productId]}·${ROUTE_NAMES[r.route]}·${strategyNames[r.strategy]}`;
  const dead = (r: Row): number => bp(r.endings.bankrupt + r.endings.banned, r.n);
  const gold = (r: Row): number => bp(r.endings.firstGold, r.n);
  const banned = (r: Row): number => bp(r.endings.banned, r.n);
  const lines: string[] = [];

  // 1. 必输和必赢
  const sureDead = rows.filter((r) => dead(r) >= 9000);
  const sureGold = rows.filter((r) => gold(r) >= 9000);
  lines.push(
    `**1. 必输和必赢：有。** ${rows.length} 个组合里，${sureDead.length} 个几乎一定倒闭或被封店（九成以上），${sureGold.length} 个几乎一定赚到第一桶金（九成以上）。` +
      `几乎必输的按打法分：${input.strategyOrder.map((s) => `${strategyNames[s]} ${sureDead.filter((r) => r.strategy === s).length} 个`).join("，")}。` +
      `几乎必赢的 ${sureGold.length} 个：${listAll(sureGold.map(name))}。`,
  );
  lines.push("");

  // 2. 三种路线
  const byRoute = (route: Route) => rows.filter((r) => r.route === route);
  const routeLine = (route: Route): string => {
    const rs = byRoute(route);
    return `${ROUTE_NAMES[route]}：各组合净资产中位数的中位数 ${yuan(median(rs.map((r) => r.nwMedian)))}，平均第一桶金 ${pct(Math.round(avg(rs.map(gold))))}，被封店 ${pct(Math.round(avg(rs.map(banned))))}`;
  };
  const pairs = byRoute("cross")
    .filter((c) => dead(c) < 9000)
    .map((c) => ({ c, l: rows.find((r) => r.route === "local" && r.productId === c.productId && r.strategy === c.strategy) }))
    .filter((p): p is { c: Row; l: Row } => p.l !== undefined);
  const localMore = pairs.filter((p) => p.l.nwMedian > p.c.nwMedian).length;
  const localRiskier = avg(byRoute("local").map(banned)) > avg(byRoute("cross").map(banned));
  const holds = localMore * 2 > pairs.length && localRiskier;
  lines.push(
    `**2. 三种路线：本土店"长期赚得更多、但风险更高"${holds ? "成立" : "不成立"}。** ${(["cross", "local", "upgrade"] as Route[]).map(routeLine).join("；")}。` +
      `跨境店不是几乎必输的 ${pairs.length} 个组合里，换成一直本土、净资产中位数更高的有 ${localMore} 个；被封店只发生在本土店和升级之后。`,
  );
  lines.push("");

  // 3. 零售和大单
  const bulkShare = avg(rows.map((r) => r.bulkShareBp));
  const bulkOnly = rows.filter((r) => r.strategy === "bulkOnly");
  const retailOnly = rows.filter((r) => r.strategy === "conservative");
  const oneLineWins = [...bulkOnly, ...retailOnly].filter((r) => gold(r) >= 9000);
  lines.push(
    `**3. 零售和大单：${bulkShare < 5000 ? "零售更赚钱" : "大单更赚钱"}。** 所有组合里，大单的收入（收到的定金和尾款，减去违约退回的定金）平均只占总收入的 ${pct(Math.round(bulkShare))}。` +
      `只做大单的 18 个组合，平均第一桶金 ${pct(Math.round(avg(bulkOnly.map(gold))))}，倒闭或被封店 ${pct(Math.round(avg(bulkOnly.map(dead))))}，平均每局中标 ${f1(avg(bulkOnly.map((r) => r.bulkWonAvg)))} 张、违约 ${f1(avg(bulkOnly.map((r) => r.bulkDefaultedAvg)))} 张；不做大单的保守打法，平均第一桶金 ${pct(Math.round(avg(retailOnly.map(gold))))}。` +
      `只做一条线就能稳赢（九成以上）的 ${oneLineWins.length} 个：${listAll(oneLineWins.map(name))}。`,
  );
  lines.push("");

  // 4. 有没有一种打法在所有商品上都稳赢
  const winners: string[] = [];
  for (const sid of input.strategyOrder) {
    for (const route of ["cross", "local", "upgrade"] as Route[]) {
      const rs = rows.filter((r) => r.strategy === sid && r.route === route);
      if (rs.length > 0 && rs.every((r) => gold(r) >= 9000)) winners.push(`${strategyNames[sid]}·${ROUTE_NAMES[route]}`);
    }
  }
  lines.push(
    `**4. 有没有一种打法在所有商品上都稳赢：${winners.length > 0 ? "有" : "没有"}。** ` +
      (winners.length > 0 ? `在 6 种商品上都九成以上赚到第一桶金的：${listAll(winners)}。这不符合"没有必赢的打法"。` : "没有一种打法加路线在 6 种商品上都九成以上赚到第一桶金。"),
  );
  lines.push("");

  // 5. 建议
  const sugg: string[] = [];
  for (const sid of input.strategyOrder) {
    const rs = rows.filter((r) => r.strategy === sid);
    const g = avg(rs.map(gold));
    const dd = avg(rs.map(dead));
    if (g >= 7000) {
      sugg.push(`"${strategyNames[sid]}"打法平均 ${pct(Math.round(g))} 的局赚到第一桶金，太容易。可以提高目标净资产（现在 ${yuan(input.goalFen)}），或者降低每单利润、提高每月固定开支（现在 ${yuan(input.fixedCostFen)}）`);
    }
    if (dd >= 9000) sugg.push(`"${strategyNames[sid]}"打法平均 ${pct(Math.round(dd))} 的局倒闭或被封店，这是这种打法把钱花过了头，季末付不起`);
  }
  const withBudget = rows.filter((r) => r.adBudgetAvg > 0);
  if (withBudget.length > 0) {
    sugg.push(`定了广告预算的 ${withBudget.length} 个组合，实际花掉的平均只占预算的 ${pct(Math.round(avg(withBudget.map((r) => r.adSpendRatioBp))))}（现金是负数时广告花不出去，这些也算在里面），广告的点击池和对手出价可以再看一看`);
  }
  const ties = input.sandbox.reduce((s, x) => s + x.seedsWithTies, 0);
  if (ties > 0) sugg.push(`沙盘检查里有 ${ties} 个种子出现了不同打法结果相同，多半是这些打法都在同一天倒闭`);
  lines.push(`**5. 最需要调整的数值（只是建议，没有改任何数值）。** ${sugg.map((x, i) => `（${i + 1}）${x}。`).join("")}`);
  return lines;
}
