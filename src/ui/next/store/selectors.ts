// 新版界面：把引擎的状态变成每个画面要显示的东西。数字都来自 engine 和 plan。
import { nextParams as P } from "../../../params/next";
import { products } from "../../../products/catalog";
import { applyBp, senToFen } from "../../../engine/money";
import { rushOrder } from "../../../engine/stock";
import {
  availableQty,
  composite,
  heatBp,
  heatFires,
  inTransitQty,
  inquiriesOf,
  inquiryQty,
  leadDays,
  netWorthFen,
  finalNetWorthFen,
  quarterCap,
  quarterOf,
  recordPts,
  reservedQty,
  rivalPriceOf,
  shopLevel,
} from "../../../engine/next/core";
import { priceScore, rankBid, routeLayerDue } from "../../../engine/next/game";
import { endingOf, ENDING_ORDER, productLines, type EndingId } from "../../../engine/next/summary";
import type { NextEvent } from "../../../engine/next/events";
import type { GameState, Inquiry, QuarterDecision } from "../../../engine/next/types";
import { estimateQuarter, type QuarterEstimate } from "../../../plan/next/estimate";
import { nt } from "../../../text/next";
import { world, type NextUi } from "./store";

export const PRODUCT_IDS = products.map((p) => p.id);
export const ENDING_IDS = ENDING_ORDER;

// ---------------- 顶部 ----------------
export interface TopView {
  quarterLabel: string;
  quarter: number;
  netWorthFen: number;
  goalPct: number;
  cashFen: number;
  level: number;
}

export function topView(game: GameState): TopView {
  const q = Math.min(7, quarterOf(game.day));
  const nw = netWorthFen(game, world);
  return {
    quarterLabel: nt.top.quarter(Math.floor(q / 4) + 1, nt.top.months[q % 4]),
    quarter: q,
    netWorthFen: nw,
    goalPct: Math.max(0, Math.min(100, (nw / P.goalNetWorthFen.value) * 100)),
    cashFen: game.cashFen,
    level: shopLevel(nw, P),
  };
}

// ---------------- 路线图 ----------------
const CX = 560;
const CY = 500;
const SX = 1.2;
const SY = 0.92;
const R = [0, 105, 195, 280, 352, 418];
const COUNT = [3, 3, 2, 3, 1];
const SIZE = [0, 50, 42, 36, 30];
const GR = [0, 14, 10, 8, 6, 5];

function pos(r: number, a: number): [number, number] {
  const t = (a * Math.PI) / 180;
  return [CX + r * SX * Math.cos(t), CY + r * SY * Math.sin(t)];
}
const f = (p: [number, number]): string => `${Math.round(p[0])} ${Math.round(p[1])}`;
function road(r1: number, a1: number, r2: number, a2: number): string {
  const c1 = r1 === 0 ? pos((r2 - r1) * 0.5, a2) : pos(r1 + (r2 - r1) * 0.55, a1);
  const c2 = pos(r2 - (r2 - r1) * 0.5, a2);
  return `M${f(pos(r1, a1))} C${f(c1)} ${f(c2)} ${f(pos(r2, a2))}`;
}
function circ(p: [number, number], r: number): string {
  return `M${Math.round(p[0] - r)} ${Math.round(p[1])} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 `;
}
function kids(depth: number, a: number, w: number): { a: number; w: number }[] {
  const n = COUNT[depth];
  const out: { a: number; w: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ a: a - w / 2 + (w * (i + 0.5)) / n, w: w / n });
  return out;
}

const ghost = ((): { roads: string[]; circles: string[] } => {
  const roads = ["", "", "", "", "", ""];
  const circles = ["", "", "", "", "", ""];
  const walk = (depth: number, a: number, w: number): void => {
    if (depth >= 5) return;
    for (const k of kids(depth, a, w)) {
      roads[depth + 1] += `${road(R[depth], a, R[depth + 1], k.a)} `;
      circles[depth + 1] += circ(pos(R[depth + 1], k.a), GR[depth + 1]);
      walk(depth + 1, k.a, k.w);
    }
  };
  walk(0, 90, 360);
  return { roads, circles };
})();

export const LAYER_KEYS: string[][] = [
  ["cross", "local", "bulk"],
  ["ads", "creator", "organic"],
  ["good", "bad"],
  ["promo", "wholesale", "safe"],
];

export interface MapNode {
  x: number;
  y: number;
  size: number;
  state: "chosen" | "option" | "other" | "good" | "bad" | "mystery";
  label: string;
  tag: string;
  key: string;
  picked: boolean;
}

export interface MapView {
  ghostRoads: string[];
  ghostCircles: string[];
  roads: { d: string; chosen: boolean; open: boolean }[];
  nodes: MapNode[];
  walker: [number, number];
  ending: { x: number; y: number; name: string; good: boolean } | null;
  /** 现在要选第几层（0 开始），null 是只看 */
  layer: number | null;
  panel: {
    step: string;
    when: string;
    title: string;
    news: string | null;
    newsGood: boolean;
    options: { key: string; letter: string; title: string; desc: string; picked: boolean }[];
    reveal: boolean;
  };
  netWorthFen: number;
  goalPct: number;
}

function pathOf(game: GameState | null): number[] {
  if (!game) return [];
  const { r1, r2, r3, r4 } = game.routes;
  const out = [LAYER_KEYS[0].indexOf(r1)];
  if (r2) out.push(LAYER_KEYS[1].indexOf(r2));
  if (r3) out.push(LAYER_KEYS[2].indexOf(r3));
  if (r4) out.push(LAYER_KEYS[3].indexOf(r4 === "bulk" ? "wholesale" : r4));
  return out;
}

export function mapView(st: NextUi): MapView {
  const game = st.game;
  const path = pathOf(game);
  const due = game ? routeLayerDue(game) : null;
  const layer = game === null ? 0 : st.screen === "map" && due !== null ? due - 1 : null;
  const atEnd = game !== null && game.phase !== "running";
  const roads: MapView["roads"] = [];
  const nodes: MapNode[] = [];
  let cur = { a: 90, w: 360 };
  let walker = pos(0, 90);
  walker = [walker[0], walker[1] - 74];
  for (let d = 0; d < path.length; d++) {
    const ks = kids(d, cur.a, cur.w);
    ks.forEach((k, i) => {
      const chosen = i === path[d];
      const p = pos(R[d + 1], k.a);
      roads.push({ d: road(R[d], cur.a, R[d + 1], k.a), chosen, open: false });
      const key = LAYER_KEYS[d][i];
      nodes.push({
        x: p[0],
        y: p[1],
        size: SIZE[d + 1],
        state: chosen ? (d === 2 ? (key === "good" ? "good" : "bad") : "chosen") : "other",
        label: chosen ? String(d + 1) : "",
        tag: chosen ? nt.routes[key].title : "",
        key,
        picked: false,
      });
    });
    cur = ks[path[d]];
    const at = pos(R[d + 1], cur.a);
    walker = [at[0] + SIZE[d + 1] / 2 + 22, at[1] - 14];
  }
  if (layer !== null && path.length === layer) {
    kids(layer, cur.a, cur.w).forEach((k, i) => {
      const p = pos(R[layer + 1], k.a);
      roads.push({ d: road(R[layer], cur.a, R[layer + 1], k.a), chosen: false, open: true });
      const key = LAYER_KEYS[layer][i];
      nodes.push({
        x: p[0],
        y: p[1],
        size: SIZE[layer + 1],
        state: layer === 2 ? "mystery" : "option",
        label: layer === 2 ? "?" : String.fromCharCode(65 + i),
        tag: "",
        key,
        picked: st.mapPick === key,
      });
    });
  }
  let ending: MapView["ending"] = null;
  if (atEnd && game) {
    const id = endingOf(game, world);
    const ep = pos(R[5], cur.a);
    roads.push({ d: road(R[4], cur.a, R[5], cur.a), chosen: true, open: false });
    ending = { x: ep[0], y: ep[1], name: nt.endings[id].name, good: !["banned", "bankrupt", "defaulter", "overstock", "pricewar"].includes(id) };
    walker = pos(R[5], cur.a + 10);
  }
  const nw = game ? netWorthFen(game, world) : P.startCashFen.value;
  const showLayer = layer ?? Math.max(0, path.length - 1);
  const keys = layer !== null ? LAYER_KEYS[layer] : [];
  const r3 = game?.routes.r3;
  return {
    ghostRoads: ghost.roads,
    ghostCircles: ghost.circles,
    roads,
    nodes,
    walker,
    ending,
    layer,
    panel: {
      step: nt.map.layerTitles[showLayer],
      when: nt.map.layerWhen[showLayer],
      title: layer === null ? nt.map.title : layer === 2 ? nt.map.layerTitles[2] : nt.map.layerTitles[layer],
      news: r3 && game && (layer === 3 || game.day === 360) ? (r3 === "good" ? nt.map.good : nt.map.bad) : null,
      newsGood: r3 === "good",
      options:
        layer === 2
          ? []
          : keys.map((key, i) => ({ key, letter: String.fromCharCode(65 + i), title: nt.routes[key].title, desc: nt.routes[key].desc, picked: st.mapPick === key })),
      reveal: layer === 2,
    },
    netWorthFen: nw,
    goalPct: Math.max(0, Math.min(100, (nw / P.goalNetWorthFen.value) * 100)),
  };
}

// ---------------- 市场情报 ----------------
export function intelLines(game: GameState): string[] {
  const q = quarterOf(game.day);
  const trend = game.schedule.trendBp[q] ?? {};
  const name = (id: string): string => nt.products[id].name;
  const hot = Object.keys(trend).find((k) => trend[k] > 10000);
  const cold = Object.keys(trend).find((k) => trend[k] < 10000);
  const lines: string[] = [];
  if (q === 0) lines.push(nt.intel.first);
  if (game.fulfillment === "local" && game.riskPts >= P.riskMidPts.value) lines.push(nt.intel.risk(game.riskPts));
  lines.push(nt.intel.season[q % 4]);
  if (hot) lines.push(nt.intel.hot(name(hot)));
  if (cold) lines.push(nt.intel.cold(name(cold)));
  if (hot) lines.push(nt.intel.rivalHoard(nt.rivals[0], name(hot)));
  lines.push(q % 2 === 0 ? nt.intel.rivalCut(nt.rivals[1]) : nt.intel.rivalBulk(nt.rivals[2]));
  lines.push(nt.intel.bulk(inquiriesOf(game, q, P).length));
  return lines;
}

// ---------------- 进货和运营 ----------------
export interface CardView {
  id: string;
  name: string;
  kind: string;
  tag: string;
  fires: number;
  hot: boolean;
  cold: boolean;
  costFen: number;
  priceSen: number;
  rivalSen: number;
  unitFen: number;
  returnPct: number;
  moq: number;
  lead: number;
  first: boolean;
  stock: number;
  transit: number;
  reserved: number;
  qty: number;
  step: number;
  cap: number;
  batchFen: number;
  discountBp: number;
  sold: number;
  left: number;
  active: boolean;
}

export interface ShopView {
  est: QuarterEstimate;
  cards: CardView[];
  cashFen: number;
  usedFen: number;
  safeFen: number;
  segs: { id: string; fen: number }[];
  over: boolean;
  inquiries: InquiryView[];
  composite: number;
  riskPts: number;
  local: boolean;
}

export interface InquiryView {
  id: string;
  client: string;
  productId: string;
  qty: number;
  dueDays: number;
  refSen: number;
  bidSen: number | null;
  rank: number;
  myQty: number;
}

function stepOf(qty: number, moq: number): number {
  if (qty >= 5000) return 500;
  if (qty >= 1000) return 200;
  return Math.max(10, Math.ceil(moq / 10) * 10 >= 100 ? 100 : 50);
}

export function shopView(game: GameState, draft: QuarterDecision): ShopView {
  const q = quarterOf(game.day);
  const est = estimateQuarter(game, draft, world);
  const cards = products.map((p) => {
    const e = est.products.find((x) => x.productId === p.id);
    const trend = game.schedule.trendBp[q]?.[p.id] ?? 10000;
    const qty = draft.buy[p.id] ?? 0;
    return {
      id: p.id,
      name: nt.products[p.id].name,
      kind: nt.products[p.id].kind,
      tag: nt.products[p.id].tag,
      fires: heatFires(heatBp(game, q, p, P)),
      hot: trend > 10000,
      cold: trend < 10000,
      costFen: p.costFen,
      priceSen: draft.priceSen[p.id],
      rivalSen: rivalPriceOf(game, q, p),
      unitFen: e ? e.unitProfitFen : 0,
      returnPct: Math.round(p.returnBp / 100),
      moq: p.moq,
      lead: leadDays(game.fulfillment, P),
      first: q === 0,
      stock: availableQty(game, p.id),
      transit: inTransitQty(game, p.id),
      reserved: reservedQty(game, p.id) + bidReserve(game, draft, p.id),
      qty,
      step: stepOf(qty, p.moq),
      cap: quarterCap(p, P),
      batchFen: e ? e.buyFen : 0,
      discountBp: e ? e.discountBp : 0,
      sold: e ? e.sold : 0,
      left: e ? e.left : 0,
      active: qty > 0 || availableQty(game, p.id) + inTransitQty(game, p.id) > 0,
    };
  });
  const segs = cards.filter((c) => c.batchFen > 0).map((c) => ({ id: c.id, fen: c.batchFen }));
  const comp = game.fulfillment === "local" ? P.complianceTierCostFen.value[draft.compTier] ?? 0 : 0;
  const adFen = draft.adBudgetFen;
  const usedFen = segs.reduce((a, s) => a + s.fen, 0) + adFen + comp;
  return {
    est,
    cards,
    cashFen: game.cashFen,
    usedFen,
    safeFen: est.billsFen,
    segs: [...segs, ...(adFen > 0 ? [{ id: "ads", fen: adFen }] : []), ...(comp > 0 ? [{ id: "comp", fen: comp }] : [])],
    over: usedFen > game.cashFen,
    inquiries: inquiriesOf(game, q, P).map((inq) => inquiryView(game, draft, inq)),
    composite: composite(game, P).total,
    riskPts: game.riskPts,
    local: game.fulfillment === "local",
  };
}

/** 报了价、按估计能分到的件数（要从货里留出来） */
function bidReserve(game: GameState, draft: QuarterDecision, productId: string): number {
  let n = 0;
  for (const b of draft.bids) {
    const inq = game.schedule.inquiries.find((i) => i.id === b.inquiryId);
    if (!inq || inq.productId !== productId) continue;
    n += rankBid(game, inq, b.unitPriceSen, P, true).find((r) => r.who === -1)?.qty ?? 0;
  }
  return n;
}

function inquiryView(game: GameState, draft: QuarterDecision, inq: Inquiry): InquiryView {
  const bid = draft.bids.find((b) => b.inquiryId === inq.id);
  const me = bid ? rankBid(game, inq, bid.unitPriceSen, P, true).find((r) => r.who === -1) : undefined;
  return {
    id: inq.id,
    client: nt.clients[inq.clientNo],
    productId: inq.productId,
    qty: inquiryQty(inq, game.routes, P),
    dueDays: inq.dueDay - game.day,
    refSen: inq.refPriceSen,
    bidSen: bid ? bid.unitPriceSen : null,
    rank: me ? me.rank : 0,
    myQty: me ? me.qty : 0,
  };
}

export function rivalActs(game: GameState): string[] {
  const q = quarterOf(game.day);
  const trend = game.schedule.trendBp[q] ?? {};
  const hot = Object.keys(trend).find((k) => trend[k] > 10000) ?? products[0].id;
  return [`${nt.products[hot].name}`, q % 2 === 0 ? nt.ops.lower : nt.ops.goBid, nt.ops.inquiry];
}

// ---------------- 抢单 ----------------
export interface BidView {
  inq: InquiryView;
  productName: string;
  floorSen: number;
  bidSen: number;
  priceScore: number;
  unitFen: number;
  profitFen: number;
  rows: { who: number; name: string; comp: number; bidSen: number; totalE1: number; rank: number; qty: number }[];
  me: { rank: number; qty: number };
  comp: ReturnType<typeof composite>;
  record: number;
  onTime: number;
  defaults: number;
  have: number;
  retailLeft: number;
  penaltyFen: number;
}

export function bidView(game: GameState, draft: QuarterDecision, id: string): BidView | null {
  const inq = game.schedule.inquiries.find((i) => i.id === id);
  if (!inq) return null;
  const bid = draft.bids.find((b) => b.inquiryId === id);
  const bidSen = bid ? bid.unitPriceSen : inq.refPriceSen;
  const rows = rankBid(game, inq, bidSen, P, true);
  const me = rows.find((r) => r.who === -1) ?? rows[0];
  const product = products.find((p) => p.id === inq.productId) ?? products[0];
  const freight = game.fulfillment === "cross" ? Math.ceil((product.weightG * P.headHaulFenPerKg.value) / 1000) : 0;
  const unitFen = senToFen(bidSen, P.cnyPerRmE4.value) - product.costFen - freight;
  const have = availableQty(game, product.id) + inTransitQty(game, product.id) + (draft.buy[product.id] ?? 0);
  const otherBids = bidReserve(game, { ...draft, bids: draft.bids.filter((b) => b.inquiryId !== id) }, product.id);
  return {
    inq: inquiryView(game, draft, inq),
    productName: nt.products[product.id].name,
    floorSen: applyBp(inq.refPriceSen, P.bidFloorBp.value),
    bidSen,
    priceScore: priceScore(bidSen, inq.refPriceSen, P),
    unitFen,
    profitFen: me.qty * unitFen,
    rows: rows.map((r) => ({ who: r.who, name: r.who === -1 ? nt.you : nt.rivals[r.who], comp: r.comp, bidSen: r.bidSen, totalE1: r.totalE1, rank: r.rank, qty: r.qty })),
    me: { rank: me.rank, qty: me.qty },
    comp: composite(game, P),
    record: recordPts(game, P),
    onTime: game.onTime,
    defaults: game.defaults,
    have,
    retailLeft: have - otherBids - me.qty,
    penaltyFen: applyBp(senToFen(me.qty * bidSen, P.cnyPerRmE4.value), P.bulkPenaltyBp.value),
  };
}

// ---------------- 播放 ----------------
export interface FeedItem {
  key: string;
  text: string;
  tone: "good" | "bad" | "info" | "money";
}

const clientOf = (game: GameState, inquiryId: string): string => {
  const inq = game.schedule.inquiries.find((i) => i.id === inquiryId);
  return inq ? nt.clients[inq.clientNo] : "";
};

export function feedOf(game: GameState, log: NextEvent[]): FeedItem[] {
  const out: FeedItem[] = [];
  log.forEach((e, i) => {
    const key = `${i}`;
    const name = (id: string): string => nt.products[id]?.name ?? "";
    switch (e.type) {
      case "bid_result":
        out.push({ key, text: e.qty > 0 ? nt.play.bidWin(clientOf(game, e.inquiryId), e.rank, e.qty) : nt.play.bidLose(clientOf(game, e.inquiryId)), tone: e.qty > 0 ? "good" : "bad" });
        break;
      case "restock_arrived":
        out.push({ key, text: nt.play.arrived(name(e.productId), e.qty), tone: "info" });
        break;
      case "bulk_shipped":
        out.push({ key, text: nt.play.bulkShipped(name(e.productId), e.qty), tone: "info" });
        break;
      case "bulk_paid":
        out.push({ key, text: nt.play.bulkPaid(e.amountFen), tone: "money" });
        break;
      case "bulk_defaulted":
        out.push({ key, text: nt.play.bulkDefaulted, tone: "bad" });
        break;
      case "event_bad_review":
        out.push({ key, text: nt.play.badReview, tone: "bad" });
        break;
      case "event_delay":
        out.push({ key, text: nt.play.delay, tone: "bad" });
        break;
      case "creator_live":
        out.push({ key, text: nt.play.creator(name(e.productId), e.orders), tone: "good" });
        break;
      case "event_started": {
        const ev = nt.events[e.kind] as { title: string };
        out.push({ key, text: ev.title, tone: ["viral", "streamer", "homepage", "bigclient"].includes(e.kind) ? "good" : "bad" });
        break;
      }
      case "loan_taken":
        out.push({ key, text: nt.play.loan(e.amountFen), tone: "money" });
        break;
      default:
        break;
    }
  });
  return out.slice(-6);
}

export interface PlayView {
  month: number;
  dayOfMonth: number;
  progress: number;
  soldBy: Record<string, number>;
  soldTotal: number;
  todaySales: { productId: string; n: number }[];
  feed: FeedItem[];
  frozen: boolean;
}

export function playView(game: GameState, log: NextEvent[]): PlayView {
  const d = Math.max(0, game.day - 1);
  const inQ = d % 90;
  const today = log.filter((e) => e.type === "sales" && e.day === d);
  const soldBy = game.quarterStats.soldBy;
  return {
    month: (Math.floor(d / 30) % 12) + 1,
    dayOfMonth: (d % 30) + 1,
    progress: Math.min(1, (inQ + 1) / 90),
    soldBy,
    soldTotal: Object.values(soldBy).reduce((a, b) => a + b, 0),
    todaySales: today.map((e) => (e.type === "sales" ? { productId: e.productId, n: e.shipped + e.extra } : { productId: "", n: 0 })),
    feed: feedOf(game, log),
    frozen: game.day < game.payoutFrozenUntilDay,
  };
}

/** 货不够时加急补货要多少钱 */
export function rushCostFen(game: GameState, productId: string, shortQty: number): number {
  const p = products.find((x) => x.id === productId) ?? products[0];
  return rushOrder(shortQty, game.fulfillment, p, P).totalFen;
}

// ---------------- 成绩卡 ----------------
export interface ReportView {
  quarterLabel: string;
  gainFen: number;
  lastGainFen: number | null;
  nwFrom: number;
  nwTo: number;
  goalPct: number;
  fromPct: number;
  quartersLeft: number;
  levelFrom: number;
  levelTo: number;
  best: { id: string; profitFen: number; sold: number } | null;
  worst: { id: string; left: number; valueFen: number } | null;
  bulk: { rank: number; qty: number } | null;
  bulkTried: boolean;
  lines: { id: string; profitFen: number; sold: number }[];
  bulkProfitFen: number;
  happened: { when: string; text: string; tone: "good" | "bad" | "info" }[];
  compFrom: number;
  compTo: number;
  shops: { name: string; fen: number; me: boolean }[];
  money: { key: string; fen: number }[];
  cashFrom: number;
  cashTo: number;
  ended: boolean;
  nextIsMap: boolean;
}

export function reportView(st: NextUi): ReportView | null {
  const { game, snap, log } = st;
  if (!game || !snap) return null;
  const q = snap.quarter;
  const ended = game.phase !== "running";
  const nwTo = ended ? finalNetWorthFen(game, world) : netWorthFen(game, world);
  const lines = productLines(game, world).map((l) => ({ id: l.productId, profitFen: l.profitFen, sold: l.sold }));
  const best = lines.filter((l) => l.sold > 0).sort((a, b) => b.profitFen - a.profitFen)[0];
  const worstCand = products
    .map((p) => ({ id: p.id, left: game.stock[p.id] ?? 0, valueFen: (game.stock[p.id] ?? 0) * p.costFen, sold: game.quarterStats.soldBy[p.id] ?? 0 }))
    .filter((w) => w.left > 0 && w.left > w.sold)
    .sort((a, b) => b.valueFen - a.valueFen)[0];
  const bids = log.filter((e) => e.type === "bid_result");
  const won = bids.filter((e) => e.type === "bid_result" && e.qty > 0);
  const bulkWin = won[0]?.type === "bid_result" ? { rank: won[0].rank, qty: won[0].qty } : null;
  const t0 = snap.totals;
  const t1 = game.totals;
  const delta = (k: keyof typeof t1): number => t1[k] - t0[k];
  const money = [
    { key: "payout", fen: delta("payoutFen") },
    { key: "bulkIn", fen: delta("bulkInFen") },
    { key: "restock", fen: -delta("restockFen") },
    { key: "perOrder", fen: -delta("perOrderFeeFen") },
    { key: "ads", fen: -delta("adSpendFen") },
    { key: "fixed", fen: -delta("fixedCostFen") },
    { key: "storage", fen: -delta("storageFen") },
    { key: "compliance", fen: -delta("complianceFen") },
    { key: "bulkOut", fen: -delta("bulkOutFen") },
    { key: "events", fen: -delta("eventCostFen") },
    { key: "promo", fen: -delta("promoFeeFen") },
    { key: "interest", fen: -delta("interestFen") },
    { key: "loan", fen: delta("loanFen") },
  ].filter((m) => m.fen !== 0);
  const bulkProfitFen = money.filter((m) => m.key === "bulkIn").reduce((a, m) => a + m.fen, 0);
  const happened: ReportView["happened"] = [];
  for (const e of log) {
    const m = nt.report.month((Math.floor(e.day / 30) % 12) + 1);
    if (e.type === "event_started") {
      const ev = nt.events[e.kind] as { title: string };
      happened.push({ when: m, text: ev.title, tone: ["viral", "streamer", "homepage", "bigclient"].includes(e.kind) ? "good" : "bad" });
    } else if (e.type === "bulk_delivered") happened.push({ when: m, text: nt.report.bulk, tone: "good" });
    else if (e.type === "bulk_defaulted") happened.push({ when: m, text: nt.play.bulkDefaulted, tone: "bad" });
    else if (e.type === "double11") happened.push({ when: m, text: nt.double11.result(Math.round(e.packBp / 100)), tone: "good" });
    else if (e.type === "event_bad_review") happened.push({ when: m, text: nt.play.badReview, tone: "bad" });
  }
  const myGain = nwTo - snap.netWorthFen;
  const shops = [
    { name: nt.you, fen: myGain, me: true },
    ...nt.rivals.map((name, i) => ({ name, fen: game.schedule.rivalProfitFen[i][q] ?? 0, me: false })),
  ].sort((a, b) => b.fen - a.fen);
  return {
    quarterLabel: nt.top.quarter(Math.floor(q / 4) + 1, nt.top.months[q % 4]),
    gainFen: myGain,
    lastGainFen: snap.lastGainFen,
    nwFrom: snap.netWorthFen,
    nwTo,
    goalPct: Math.max(0, Math.min(100, (nwTo / P.goalNetWorthFen.value) * 100)),
    fromPct: Math.max(0, Math.min(100, (snap.netWorthFen / P.goalNetWorthFen.value) * 100)),
    quartersLeft: 7 - q,
    levelFrom: snap.level,
    levelTo: shopLevel(nwTo, P),
    best: best ? { id: best.id, profitFen: best.profitFen, sold: best.sold } : null,
    worst: worstCand ? { id: worstCand.id, left: worstCand.left, valueFen: worstCand.valueFen } : null,
    bulk: bulkWin,
    bulkTried: bids.length > 0,
    lines,
    bulkProfitFen,
    happened: happened.slice(0, 3),
    compFrom: snap.composite,
    compTo: composite(game, P).total,
    shops,
    money,
    cashFrom: snap.cashFen,
    cashTo: game.cashFen,
    ended,
    nextIsMap: !ended && routeLayerDue(game) !== null,
  };
}

// ---------------- 结局 ----------------
export interface EndingView {
  id: EndingId;
  name: string;
  line: string;
  how: string;
  nwFen: number;
  path: { layer: number; title: string; key: string }[];
  good: boolean;
  hidden: boolean;
  highlight: string;
  collection: { id: EndingId; got: boolean; name: string }[];
}

export function endingView(st: NextUi): EndingView | null {
  const game = st.game;
  if (!game) return null;
  const id = endingOf(game, world);
  const keys = [game.routes.r1, game.routes.r2, game.routes.r3, game.routes.r4 === "bulk" ? "wholesale" : game.routes.r4];
  const path = keys
    .map((k, i) => (k ? { layer: i, title: nt.routes[k].title, key: k } : null))
    .filter((x): x is { layer: number; title: string; key: string } => x !== null);
  const nws = game.netWorthAtQuarterEnd;
  let bestQ = 0;
  let bestGain = -Infinity;
  nws.forEach((v, i) => {
    const g = v - (i === 0 ? P.startCashFen.value : nws[i - 1]);
    if (g > bestGain) {
      bestGain = g;
      bestQ = i;
    }
  });
  return {
    id,
    name: nt.endings[id].name,
    line: nt.endings[id].line,
    how: nt.endings[id].how,
    nwFen: finalNetWorthFen(game, world),
    path,
    good: !["banned", "bankrupt", "defaulter", "overstock", "pricewar"].includes(id),
    hidden: id === "king",
    highlight: nws.length > 0 ? `${nt.top.quarter(Math.floor(bestQ / 4) + 1, nt.top.months[bestQ % 4])} ${nt.signedMoney(bestGain)}` : "",
    collection: ENDING_ORDER.map((e) => ({ id: e, got: st.collection.includes(e), name: nt.endings[e].name })),
  };
}
