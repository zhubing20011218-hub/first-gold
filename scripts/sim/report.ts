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
  earlyBankruptBp: number;
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
    earlyBankruptBp: bp(rs.filter((r) => r.bankruptDay !== null && r.bankruptDay < 30).length, rs.length),
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
  out.push("| 组合 | 倒闭 | 被封店 | 活下来了 | 第一桶金 | 第一个月就倒闭 | 净资产 最低 | 中位数 | 最高 | 现金最低点 中位数 | 出现在第几天 | 一局天数 |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const r of rows) {
    out.push(
      `| ${name(r)} | ${share(r.endings.bankrupt, r.n)} | ${share(r.endings.banned, r.n)} | ${share(r.endings.survived, r.n)} | ${share(r.endings.firstGold, r.n)} | ${pct(r.earlyBankruptBp)} | ${yuan(r.nwMin)} | ${yuan(r.nwMedian)} | ${yuan(r.nwMax)} | ${yuan(r.minCashMedian)} | ${r.minCashDayMedian} | ${r.daysMedian} |`,
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
      `| ${name(r)} | ${f1(r.pushAvg)} | ${f1(r.pushY1)} | ${r.pushY2 === 0 ? "-" : f1(r.pushY2)} | ${yuan(r.adSpendAvg)} | ${r.adSpendAvg === 0 ? "-" : pct(r.adSpendRatioBp)} | ${f0(r.shippedAvg)} | ${f0(r.lostAvg)} | ${f0(r.returnedAvg)} | ${f1(r.bulkWonAvg)} | ${f1(r.bulkDeliveredAvg)} | ${f1(r.bulkDefaultedAvg)} | ${pct(r.bulkShareBp)} | ${local ? yuan(r.storageAvg) : "-"} | ${pct(r.disc5Bp)} | ${pct(r.disc10Bp)} | ${local ? pct(r.auditedBp) : "-"} | ${local && r.banQuarterAvg !== null ? f1(r.banQuarterAvg) : "-"} |`,
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

function conclusions(input: ReportInput): string[] {
  const { rows, productNames, strategyNames } = input;
  const name = (r: Row): string => `${productNames[r.productId]}·${ROUTE_NAMES[r.route]}·${strategyNames[r.strategy]}`;
  const dead = (r: Row): number => bp(r.endings.bankrupt + r.endings.banned, r.n);
  const gold = (r: Row): number => bp(r.endings.firstGold, r.n);
  const lines: string[] = [];

  // 1. 必输和必赢
  const sureDead = rows.filter((r) => dead(r) >= 9000);
  const sureGold = rows.filter((r) => gold(r) >= 9000);
  const anyGold = rows.filter((r) => r.endings.firstGold > 0);
  lines.push(
    `**1. 必输和必赢。** ${rows.length} 个组合里，${sureDead.length} 个几乎一定倒闭或被封店（九成以上），${sureGold.length} 个几乎一定赚到第一桶金（九成以上），只有 ${anyGold.length} 个组合出现过"赚到第一桶金"。` +
      (sureGold.length > 0 ? `几乎必赢的：${sureGold.slice(0, 8).map(name).join("、")}。` : "") +
      ` 按打法看，几乎必输的组合数：${input.strategyOrder
        .map((s) => `${strategyNames[s]} ${sureDead.filter((r) => r.strategy === s).length}`)
        .join("，")}（每种打法共 18 个组合）。`,
  );
  lines.push("");

  // 2. 三种路线
  const byRoute = (route: Route) => rows.filter((r) => r.route === route);
  const routeLine = (route: Route): string => {
    const rs = byRoute(route);
    const nw = median(rs.map((r) => r.nwMedian));
    const g = avg(rs.map(gold));
    const ban = avg(rs.map((r) => bp(r.endings.banned, r.n)));
    const bk = avg(rs.map((r) => bp(r.endings.bankrupt, r.n)));
    return `${ROUTE_NAMES[route]}：各组合净资产中位数的中位数 ${yuan(nw)}，平均第一桶金 ${pct(Math.round(g))}，倒闭 ${pct(Math.round(bk))}，被封店 ${pct(Math.round(ban))}`;
  };
  lines.push(`**2. 三种路线。** ${(["cross", "local", "upgrade"] as Route[]).map(routeLine).join("；")}。`);
  const crossOk = byRoute("cross").filter((r) => dead(r) < 9000);
  const localBetter = crossOk.filter((c) => {
    const l = rows.find((r) => r.route === "local" && r.productId === c.productId && r.strategy === c.strategy);
    return l !== undefined && l.nwMedian > c.nwMedian;
  }).length;
  lines.push(
    `在跨境店没有几乎必输的 ${crossOk.length} 个组合里，同样的商品和打法换成一直本土，净资产中位数更高的有 ${localBetter} 个。"本土店长期赚得更多、但风险更高"是否成立，看这个数和上面的被封店比例。`,
  );
  lines.push("");

  // 3. 零售和大单
  const bulkOnly = rows.filter((r) => r.strategy === "bulkOnly");
  const retailOnly = rows.filter((r) => r.strategy === "conservative");
  lines.push(
    `**3. 零售和大单。** 所有组合的大单收入占比平均 ${pct(Math.round(avg(rows.map((r) => r.bulkShareBp))))}。只做大单的 18 个组合，平均第一桶金 ${pct(Math.round(avg(bulkOnly.map(gold))))}，倒闭或被封店 ${pct(Math.round(avg(bulkOnly.map(dead))))}，平均每局中标 ${f1(avg(bulkOnly.map((r) => r.bulkWonAvg)))} 张、违约 ${f1(avg(bulkOnly.map((r) => r.bulkDefaultedAvg)))} 张。不做大单的保守打法，平均第一桶金 ${pct(Math.round(avg(retailOnly.map(gold))))}，倒闭或被封店 ${pct(Math.round(avg(retailOnly.map(dead))))}。` +
      ` 只做一条线就能稳赢（九成以上）的组合：${[...bulkOnly, ...retailOnly].filter((r) => gold(r) >= 9000).map(name).join("、") || "没有"}。`,
  );
  lines.push("");

  // 4. 建议
  const early = avg(rows.map((r) => r.earlyBankruptBp));
  const allDead = avg(rows.map(dead));
  const adRatio = avg(rows.filter((r) => r.adSpendAvg > 0).map((r) => r.adSpendRatioBp));
  const sugg: string[] = [];
  if (early >= 1000) {
    sugg.push(
      `平均 ${pct(Math.round(early))} 的局在第一个月就倒闭。主要原因是自动补货按"买得起的最大件数"进货，把现金花光，当天的每单费用和下个月的固定开支一扣就成了负数（文档问题 D15）。建议补货时给现金留一个底，例如留出一个月的固定开支，或者"买得起"只算现金的一部分`,
    );
  }
  if (allDead >= 5000) {
    sugg.push(`全部组合平均 ${pct(Math.round(allDead))} 的局倒闭或被封店，整体偏难。可以考虑提高启动资金、降低每月固定开支（现在 ¥300），或者缩短回款天数`);
  }
  if (anyGold.length < rows.length / 3) {
    sugg.push(`只有 ${anyGold.length} 个组合出现过"赚到第一桶金"，目标 ${yuan(input.goalFen)} 对多数商品和打法太高，可以降低目标或提高每单利润`);
  }
  for (const sid of input.strategyOrder) {
    const rs = rows.filter((r) => r.strategy === sid);
    const g = avg(rs.map(gold));
    const dd = avg(rs.map(dead));
    if (g >= 7000) {
      sugg.push(`"${strategyNames[sid]}"打法平均 ${pct(Math.round(g))} 的局赚到第一桶金，太容易。可以提高目标净资产（现在 ${yuan(input.goalFen)}），或者降低每单利润、提高固定开支`);
    }
    if (dd >= 9000) {
      sugg.push(`"${strategyNames[sid]}"打法平均 ${pct(Math.round(dd))} 的局倒闭或被封店，这是这种打法把钱花过了头，季末付不起`);
    }
  }
  if (adRatio > 0) sugg.push(`投了广告的组合，实际花掉的平均只占预算的 ${pct(Math.round(adRatio))}，广告的点击池和对手出价可以再看一看`);
  const ties = input.sandbox.reduce((s, x) => s + x.seedsWithTies, 0);
  if (ties > 0) sugg.push(`沙盘检查里有 ${ties} 个种子出现了不同打法结果相同，多半是这些打法都在同一天倒闭`);
  lines.push(`**4. 最需要调整的数值（只是建议，没有改任何数值）。** ${sugg.map((s, i) => `（${i + 1}）${s}。`).join("")}`);
  return lines;
}
