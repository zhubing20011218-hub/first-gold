// 新版界面的 store：一局怎么往前走。只有这里和 selectors.ts 引用 engine、plan。
import { create } from "zustand";
import { nextParams } from "../../../params/next";
import { products } from "../../../products/catalog";
import { composite, netWorthFen, quarterOf, shopLevel } from "../../../engine/next/core";
import {
  chooseRoute2,
  chooseRoute4,
  createGame,
  revealRoute3,
  routeLayerDue,
  startQuarter,
} from "../../../engine/next/game";
import { answer as engineAnswer, stepDay } from "../../../engine/next/day";
import type { NextEvent } from "../../../engine/next/events";
import { endingOf, type EndingId } from "../../../engine/next/summary";
import type { Answer, GameState, QuarterDecision, Route1, Route2, Route4, Totals, World } from "../../../engine/next/types";

export const world: World = { params: nextParams, products };

export type Screen = "home" | "map" | "shop" | "play" | "report" | "ending";

/** 季度开始时记下的数，成绩卡用 */
export interface QuarterSnap {
  quarter: number;
  cashFen: number;
  netWorthFen: number;
  composite: number;
  level: number;
  totals: Totals;
  /** 上一季赚了多少（净资产的变化） */
  lastGainFen: number | null;
}

export interface NextUi {
  screen: Screen;
  seed: number;
  game: GameState | null;
  draft: QuarterDecision | null;
  tab: number;
  bidOpen: string | null;
  intelOpen: boolean;
  /** 只看路线图（不选） */
  mapView: boolean;
  /** 路线图上点中的选项（还没确认） */
  mapPick: string | null;
  snap: QuarterSnap | null;
  /** 这一季发生的事件 */
  log: NextEvent[];
  playing: boolean;
  /** 一秒走几天 */
  speed: number;
  /** 双 11 打包小游戏 */
  pack: { running: boolean; taps: number; endsAt: number; done: boolean; resultBp: number } | null;
  showDetail: boolean;
  /** 播放时遇到的好事：弹一张卡，点了才继续 */
  notice: { kind: string; productId: string | null; card: boolean } | null;
  collection: EndingId[];
  /** 这一局刚解锁的结局 */
  newEnding: boolean;
}

export interface NextStore extends NextUi {
  newGame: () => void;
  toHome: () => void;
  pickOnMap: (key: string) => void;
  confirmMap: () => void;
  openMap: () => void;
  closeMap: () => void;
  closeIntel: () => void;
  openIntel: () => void;
  setTab: (i: number) => void;
  setBuy: (id: string, qty: number) => void;
  setPrice: (id: string, sen: number) => void;
  setAd: (budgetFen: number, bidBp: number) => void;
  setComp: (tier: number) => void;
  openBid: (id: string) => void;
  closeBid: () => void;
  setBid: (id: string, sen: number | null) => void;
  start: () => void;
  tick: (days?: number) => void;
  setSpeed: (n: number) => void;
  answer: (a: Answer) => void;
  packStart: (now: number) => void;
  packTap: () => void;
  packFinish: () => void;
  afterReport: () => void;
  toggleDetail: () => void;
  dismissNotice: () => void;
}

function newSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

const COLLECTION_KEY = "first-gold-next-endings";
function loadCollection(): EndingId[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY);
    return raw ? (JSON.parse(raw) as EndingId[]) : [];
  } catch {
    return [];
  }
}
function saveCollection(list: EndingId[]): void {
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(list));
  } catch {
    // 存不了也没关系
  }
}

/** 新一季的草稿：沿用上一季的数（第 1 季度全是 0，让玩家自己填） */
function draftFor(game: GameState, prev: QuarterDecision | null): QuarterDecision {
  const buy: Record<string, number> = {};
  const priceSen: Record<string, number> = {};
  for (const p of products) {
    buy[p.id] = prev ? prev.buy[p.id] ?? 0 : 0;
    priceSen[p.id] = game.priceSen[p.id];
  }
  return {
    buy,
    priceSen,
    adBudgetFen: prev ? prev.adBudgetFen : 0,
    adBidBp: prev ? prev.adBidBp : 10000,
    bids: [],
    compTier: 0,
  };
}

function snapOf(game: GameState, last: QuarterSnap | null): QuarterSnap {
  const nw = netWorthFen(game, world);
  return {
    quarter: quarterOf(game.day),
    cashFen: game.cashFen,
    netWorthFen: nw,
    composite: composite(game, nextParams).total,
    level: shopLevel(nw, nextParams),
    totals: { ...game.totals },
    lastGainFen: last ? nw - last.netWorthFen : null,
  };
}

const initial: NextUi = {
  screen: "home",
  seed: 0,
  game: null,
  draft: null,
  tab: 0,
  bidOpen: null,
  intelOpen: false,
  mapView: false,
  mapPick: null,
  snap: null,
  log: [],
  playing: false,
  speed: 15,
  pack: null,
  showDetail: false,
  notice: null,
  collection: [],
  newEnding: false,
};

export const useNext = create<NextStore>((set, get) => {
  /** 进入下一季的计划：路线到了就去路线图，不然去进货 */
  const toPlanning = (game: GameState, prev: QuarterDecision | null): void => {
    if (game.phase !== "running") {
      const id = endingOf(game, world);
      const had = get().collection;
      const isNew = !had.includes(id);
      const collection = isNew ? [...had, id] : had;
      saveCollection(collection);
      set({ game, screen: "ending", collection, newEnding: isNew, playing: false });
      return;
    }
    if (routeLayerDue(game) !== null) {
      set({ game, screen: "map", mapView: false, mapPick: null, draft: prev, playing: false });
      return;
    }
    set({ game, screen: "shop", draft: draftFor(game, prev), tab: 0, bidOpen: null, intelOpen: true, playing: false });
  };

  return {
    ...initial,
    collection: loadCollection(),

    newGame: () => set({ ...initial, collection: get().collection, seed: newSeed(), screen: "map" }),
    toHome: () => set({ ...initial, collection: get().collection }),

    pickOnMap: (key) => set({ mapPick: key }),
    confirmMap: () => {
      const { game, mapPick, seed, draft } = get();
      if (!mapPick) return;
      if (game === null) {
        const g = createGame(seed, mapPick as Route1, world).state;
        set({ snap: null });
        toPlanning(g, null);
        return;
      }
      const layer = routeLayerDue(game);
      let g = game;
      if (layer === 2) g = chooseRoute2(game, mapPick as Route2).state;
      else if (layer === 3) {
        // 第 3 层不是玩家选的：先在路线图上亮出结果，再去进货
        set({ game: revealRoute3(game, nextParams).state, mapPick: null, screen: "map" });
        return;
      }
      else if (layer === 4) g = chooseRoute4(game, (mapPick === "wholesale" ? "bulk" : mapPick) as Route4, nextParams).state;
      set({ mapPick: null });
      toPlanning(g, draft);
    },
    openMap: () => set({ mapView: true }),
    closeMap: () => {
      const { screen, game, draft } = get();
      if (screen === "map" && game) toPlanning(game, draft);
      else set({ mapView: false });
    },
    closeIntel: () => set({ intelOpen: false }),
    openIntel: () => set({ intelOpen: true }),

    setTab: (tab) => set({ tab }),
    setBuy: (id, qty) => {
      const d = get().draft;
      if (d) set({ draft: { ...d, buy: { ...d.buy, [id]: Math.max(0, qty) } } });
    },
    setPrice: (id, sen) => {
      const d = get().draft;
      if (d) set({ draft: { ...d, priceSen: { ...d.priceSen, [id]: sen } } });
    },
    setAd: (adBudgetFen, adBidBp) => {
      const d = get().draft;
      if (d) set({ draft: { ...d, adBudgetFen: Math.max(0, adBudgetFen), adBidBp } });
    },
    setComp: (compTier) => {
      const d = get().draft;
      if (d) set({ draft: { ...d, compTier } });
    },
    openBid: (id) => {
      const { draft, game } = get();
      if (!draft || !game) return;
      if (!draft.bids.some((b) => b.inquiryId === id)) {
        const inq = game.schedule.inquiries.find((i) => i.id === id);
        if (inq) set({ draft: { ...draft, bids: [...draft.bids, { inquiryId: id, unitPriceSen: inq.refPriceSen - 80 }] } });
      }
      set({ bidOpen: id });
    },
    closeBid: () => set({ bidOpen: null }),
    setBid: (id, sen) => {
      const d = get().draft;
      if (!d) return;
      const rest = d.bids.filter((b) => b.inquiryId !== id);
      set({ draft: { ...d, bids: sen === null ? rest : [...rest, { inquiryId: id, unitPriceSen: sen }] } });
    },

    start: () => {
      const { game, draft, snap } = get();
      if (!game || !draft) return;
      const r = startQuarter(game, draft, world);
      set({
        game: r.state,
        snap: snapOf(game, snap),
        log: r.events,
        screen: "play",
        playing: true,
        bidOpen: null,
        intelOpen: false,
        pack: null,
        showDetail: false,
      });
    },
    tick: (days = 1) => {
      let { game } = get();
      const { log } = get();
      if (!game || game.pending) return;
      const q = quarterOf(game.day);
      const add: NextEvent[] = [];
      for (let i = 0; i < days; i++) {
        if (game.phase !== "running" || game.pending) break;
        const r = stepDay(game, world);
        game = r.state;
        add.push(...r.events);
        if (quarterOf(game.day) !== q) break;
      }
      const ended = game.phase !== "running" || quarterOf(game.day) !== q;
      const good = add.find((e) => e.type === "event_started" && ["viral", "streamer", "homepage", "bigclient"].includes(e.kind));
      if (good && good.type === "event_started") set({ notice: { kind: good.kind, productId: good.productId, card: good.card } });
      const pack = game.pending?.kind === "pack" && !get().pack ? { running: false, taps: 0, endsAt: 0, done: false, resultBp: 0 } : get().pack;
      set({ game, log: add.length ? [...log, ...add] : log, screen: ended && !game.pending ? "report" : "play", playing: !ended, pack });
    },
    setSpeed: (speed) => set({ speed }),
    answer: (a) => {
      const { game, log } = get();
      if (!game) return;
      const r = engineAnswer(game, a, world);
      set({ game: r.state, log: [...log, ...r.events], pack: a.kind === "pack" ? null : get().pack });
    },
    packStart: (now) => set({ pack: { running: true, taps: 0, endsAt: now + 12000, done: false, resultBp: 0 } }),
    packTap: () => {
      const p = get().pack;
      if (p && p.running) set({ pack: { ...p, taps: p.taps + 1 } });
    },
    packFinish: () => {
      const p = get().pack;
      if (!p) return;
      // 12 秒点 60 下就能全部发出去
      const min = nextParams.packMinBp.value;
      const resultBp = Math.min(10000, min + Math.floor(((10000 - min) * p.taps) / 60));
      set({ pack: { ...p, running: false, done: true, resultBp } });
    },
    afterReport: () => {
      const { game, draft } = get();
      if (!game) return;
      toPlanning(game, draft);
    },
    toggleDetail: () => set({ showDetail: !get().showDetail }),
    dismissNotice: () => set({ notice: null }),
  };
});

export const LEVELS = nextParams.levelNetWorthFen.value;
