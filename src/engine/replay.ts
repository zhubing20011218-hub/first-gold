// 从开局算到结束（docs/04 第十三节 replay）
import { stepDay } from "./day";
import type { GameEvent } from "./events";
import { createGame } from "./game";
import { answerPending } from "./pending";
import type { Product } from "./product";
import { startQuarter } from "./quarter";
import type { GameConfig, GameState, QuarterDecision } from "./types";
import type { Params } from "./util";

export interface ReplayResult {
  state: GameState;
  /** 每一天的事件列表。开局和季度第一天的决定产生的事件放在那一天的最前面 */
  eventsByDay: GameEvent[][];
}

export function replay(config: GameConfig, decisions: QuarterDecision[], product: Product, params: Params): ReplayResult {
  const quarters = params.quartersPerGame.value;
  if (decisions.length !== quarters) throw new Error(`replay needs ${quarters} decisions, got ${decisions.length}`);
  const opening = createGame(config, product, params);
  let state = opening.state;
  const eventsByDay: GameEvent[][] = [];
  const add = (evs: GameEvent[]): void => {
    for (const e of evs) (eventsByDay[e.day] ??= []).push(e);
  };
  add(opening.events);
  let startedQuarter = -1;

  while (state.phase === "running" || state.phase === "closing") {
    const q = Math.floor(state.day / 90);
    if (state.phase === "running" && state.day % 90 === 0 && startedQuarter < q) {
      const r = startQuarter(state, decisions[q], product, params);
      state = r.state;
      add(r.events);
      startedQuarter = q;
    }
    if (state.pending !== null) {
      const id = state.pending.inquiryId;
      const decided = decisions[q]?.bulkShortChoices?.find((c) => c.inquiryId === id)?.choice ?? "ignore";
      const r = answerPending(state, decided, product, params);
      state = r.state;
      add(r.events);
      continue;
    }
    const r = stepDay(state, product, params);
    state = r.state;
    add(r.events);
  }
  for (let d = 0; d < eventsByDay.length; d++) eventsByDay[d] ??= [];
  return { state, eventsByDay };
}
