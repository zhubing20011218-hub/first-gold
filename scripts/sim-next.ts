// 新版的模拟：npx tsx scripts/sim-next.ts [局数]。只引用 engine、params、products、plan。
// 几种打法 × 54 条路线（第 2、4 层随机），看净资产的分布、结局的分布，用来调难度。
import { nextParams } from "../src/params/next";
import { products } from "../src/products/catalog";
import { createRng, type Rng } from "../src/engine/rng";
import { applyBp, senToFen } from "../src/engine/money";
import { restockCostFen, rushOrder } from "../src/engine/stock";
import {
  availableQty,
  heatBp,
  inTransitQty,
  inquiriesOf,
  inquiryQty,
  finalNetWorthFen,
  quarterCap,
  quarterOf,
} from "../src/engine/next/core";
import { chooseRoute2, chooseRoute4, createGame, rankBid, revealRoute3, routeLayerDue, startQuarter } from "../src/engine/next/game";
import { answer, runUntilStop } from "../src/engine/next/day";
import { endingOf, type EndingId } from "../src/engine/next/summary";
import type { GameState, QuarterDecision, Route1, Route2, Route4, World } from "../src/engine/next/types";
import { estimateQuarter } from "../src/plan/next/estimate";

// 调参数时可以用环境变量临时改：OVERRIDE='{"marketScaleBp":60000}'
const override = JSON.parse(process.env.OVERRIDE ?? "{}") as Record<string, number>;
const P = { ...nextParams };
for (const [k, v] of Object.entries(override)) (P as Record<string, { value: unknown }>)[k] = { ...(P as Record<string, { value: unknown }>)[k], value: v };
const world: World = { params: P, products };

interface Bot {
  id: string;
  /** 进货按预计需求的几倍 */
  stockBp: number;
  /** 最多花现金的几成 */
  spendBp: number;
  /** 广告预算占这一季花的钱的几成 */
  adBp: number;
  adBidBp: number;
  /** 只挑热度高的货 */
  picky: boolean;
  /** 抢单时算最好的报价 */
  smartBid: boolean;
  /** 随机乱填 */
  random: boolean;
}

const BOTS: Bot[] = [
  { id: "稳健", stockBp: 10000, spendBp: 7500, adBp: 1200, adBidBp: 11000, picky: true, smartBid: true, random: false },
  { id: "激进", stockBp: 14000, spendBp: 10000, adBp: 2000, adBidBp: 13000, picky: false, smartBid: true, random: false },
  { id: "赌徒", stockBp: 16000, spendBp: 13000, adBp: 2000, adBidBp: 14000, picky: false, smartBid: true, random: false },
  { id: "保守", stockBp: 7000, spendBp: 5000, adBp: 500, adBidBp: 10000, picky: true, smartBid: false, random: false },
  { id: "随手", stockBp: 10000, spendBp: 8000, adBp: 1000, adBidBp: 10000, picky: false, smartBid: false, random: true },
];

function decide(state: GameState, bot: Bot, rng: Rng): QuarterDecision {
  const q = quarterOf(state.day);
  const priceSen: Record<string, number> = {};
  for (const p of products) priceSen[p.id] = p.refPriceSen;
  const zero: QuarterDecision = { buy: {}, priceSen, adBudgetFen: 0, adBidBp: bot.adBidBp, bids: [], compTier: 0 };
  const est = estimateQuarter(state, zero, world);
  const buy: Record<string, number> = {};
  const want: { id: string; qty: number; score: number }[] = [];
  for (const p of products) {
    const e = est.products.find((x) => x.productId === p.id)!;
    let k = bot.stockBp;
    if (bot.random) k = rng.int(0, 16000);
    if (bot.picky && heatBp(state, q, p, P) < 10000) k = Math.floor(k / 3);
    const have = availableQty(state, p.id) + inTransitQty(state, p.id);
    let qty = Math.max(0, applyBp(e.demand, k) - have);
    if (qty > 0) qty = Math.max(p.moq, Math.ceil(qty / 10) * 10);
    qty = Math.min(qty, quarterCap(p, P));
    want.push({ id: p.id, qty, score: e.unitProfitFen * heatBp(state, q, p, P) });
  }
  // 抢单
  const bids: QuarterDecision["bids"] = [];
  const reserve: Record<string, number> = {};
  for (const inq of inquiriesOf(state, q, P)) {
    const product = products.find((p) => p.id === inq.productId)!;
    if (bot.random && rng.int(0, 1) === 0) continue;
    let best = 0;
    let bestProfit = 0;
    let bestQty = 0;
    const floor = applyBp(inq.refPriceSen, P.bidFloorBp.value);
    const candidates = bot.smartBid ? [] : [applyBp(inq.refPriceSen, rng.int(8500, 9800))];
    if (bot.smartBid) for (let sen = inq.refPriceSen; sen >= floor; sen -= 20) candidates.push(sen);
    for (const sen of candidates) {
      const me = rankBid(state, inq, sen, P, true).find((r) => r.who === -1)!;
      const unit = senToFen(sen, P.cnyPerRmE4.value) - product.costFen - Math.ceil((product.weightG * P.headHaulFenPerKg.value) / 1000);
      const profit = me.qty * unit;
      if (profit > bestProfit) {
        bestProfit = profit;
        best = sen;
        bestQty = me.qty;
      }
    }
    if (best > 0) {
      bids.push({ inquiryId: inq.id, unitPriceSen: Math.round(best / 10) * 10 });
      reserve[inq.productId] = (reserve[inq.productId] ?? 0) + Math.max(bestQty, inquiryQty(inq, state.routes, P) / 2);
    }
  }
  for (const w of want) {
    w.qty += reserve[w.id] ? Math.ceil(reserve[w.id] / 10) * 10 : 0;
    w.qty = Math.min(w.qty, quarterCap(products.find((p) => p.id === w.id)!, P));
  }
  // 钱不够就按比例少进（挑剔的先砍热度低的）
  const budget = Math.max(0, applyBp(state.cashFen, bot.spendBp));
  const adBudget = applyBp(budget, bot.adBp);
  const goodsBudget = budget - adBudget;
  const costOf = (id: string, qty: number): number => (qty > 0 ? restockCostFen(qty, state.fulfillment, products.find((p) => p.id === id)!, P).totalFen : 0);
  let total = want.reduce((a, w) => a + costOf(w.id, w.qty), 0);
  if (total > goodsBudget && total > 0) {
    const ratio = goodsBudget / total;
    for (const w of want) {
      const p = products.find((x) => x.id === w.id)!;
      let qty = Math.floor((w.qty * ratio) / 10) * 10;
      if (qty < p.moq) qty = 0;
      w.qty = qty;
    }
    total = want.reduce((a, w) => a + costOf(w.id, w.qty), 0);
  }
  for (const w of want) buy[w.id] = w.qty;
  const compTier = state.fulfillment === "local" ? (state.riskPts >= 40 ? (bot.random ? rng.int(0, 2) : 1) : 0) : 0;
  return { buy, priceSen, adBudgetFen: adBudget, adBidBp: bot.adBidBp, bids, compTier };
}

interface Result {
  bot: string;
  r1: Route1;
  r2: Route2;
  r4: Route4;
  nw: number;
  ending: EndingId;
  breaches: number;
}

function play(seed: number, bot: Bot, r1: Route1): Result {
  const rng = createRng(seed * 7919 + 17);
  const r2: Route2 = (["ads", "creator", "organic"] as const)[seed % 3];
  const r4: Route4 = (["promo", "bulk", "safe"] as const)[Math.floor(seed / 3) % 3];
  let s = createGame(seed, r1, world).state;
  let guard = 0;
  let startedQ = -1;
  while (s.phase === "running" && guard++ < 2000) {
    if (s.pending) {
      const p = s.pending;
      if (p.kind === "bulk_short") {
        const r = rushOrder(p.shortQty, s.fulfillment, products.find((x) => x.id === p.productId)!, P);
        s = answer(s, { kind: "bulk_short", choice: s.cashFen > r.totalFen ? "rush" : "ignore" }, world).state;
      } else if (p.kind === "event") {
        s = answer(s, { kind: "event", choice: rng.int(0, 1) === 0 ? "a" : "b" }, world).state;
      } else {
        s = answer(s, { kind: "pack", packBp: bot.random ? rng.int(4000, 10000) : rng.int(7000, 9500) }, world).state;
      }
      continue;
    }
    if (s.day % 90 === 0) {
      const layer = routeLayerDue(s);
      if (layer === 2) s = chooseRoute2(s, r2).state;
      if (layer === 3) s = revealRoute3(s, P).state;
      if (layer === 4) s = chooseRoute4(s, r4, P).state;
      if (s.pending) continue;
      if (startedQ !== quarterOf(s.day)) {
        startedQ = quarterOf(s.day);
        s = startQuarter(s, decide(s, bot, rng), world).state;
      }
    }
    s = runUntilStop(s, world).state;
  }
  return { bot: bot.id, r1, r2, r4, nw: finalNetWorthFen(s, world), ending: endingOf(s, world), breaches: s.defaults };
}

const N = Number(process.argv[2] ?? 60);
const results: Result[] = [];
for (const bot of BOTS) for (const r1 of ["cross", "local", "bulk"] as const) for (let seed = 1; seed <= N; seed++) results.push(play(seed, bot, r1));

const yuan = (f: number): string => `¥${Math.round(f / 100).toLocaleString("en-US")}`;
const pct = (n: number, d: number): string => `${Math.round((n / Math.max(1, d)) * 100)}%`;
function stats(rows: Result[], label: string): void {
  const nws = rows.map((r) => r.nw).sort((a, b) => a - b);
  const q = (x: number): number => nws[Math.min(nws.length - 1, Math.floor(nws.length * x))];
  const goal = rows.filter((r) => r.nw >= P.goalNetWorthFen.value).length;
  const dead = rows.filter((r) => r.ending === "bankrupt" || r.ending === "banned").length;
  console.log(
    `${label.padEnd(16)} n=${rows.length}  p10 ${yuan(q(0.1))}  p50 ${yuan(q(0.5))}  p90 ${yuan(q(0.9))}  ≥百万 ${pct(goal, rows.length)}  破产封店 ${pct(dead, rows.length)}`,
  );
}
stats(results, "全部");
for (const bot of BOTS) stats(results.filter((r) => r.bot === bot.id), `打法 ${bot.id}`);
for (const r1 of ["cross", "local", "bulk"]) stats(results.filter((r) => r.r1 === r1), `第1层 ${r1}`);
for (const r2 of ["ads", "creator", "organic"]) stats(results.filter((r) => r.r2 === r2), `第2层 ${r2}`);
for (const r4 of ["promo", "bulk", "safe"]) stats(results.filter((r) => r.r4 === r4), `第4层 ${r4}`);
const endings: Record<string, number> = {};
for (const r of results) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
console.log("结局", Object.entries(endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, results.length)}`).join("  "));
