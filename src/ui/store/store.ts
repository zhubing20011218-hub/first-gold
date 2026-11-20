// 整个界面唯一的 store（docs/12 第一节）。动作的逻辑在 actions.ts，这里只把它们接进 Zustand。
import { create } from "zustand";
import * as A from "./actions";
import { initialUi, type Area, type PopupName, type UiState } from "./state";
import type { Fulfillment, MidChoice, QuarterDecision } from "../../engine/types";

/** 种子在点"开始经营"时生成。这是整个项目里唯一允许的非确定性来源，只能出现在 src/ui（docs/09 第二节） */
function newSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

export interface Store extends UiState {
  startNewGame: () => void;
  pickProduct: (id: string) => void;
  pickFulfillment: (f: Fulfillment) => void;
  setFirstStock: (qty: number) => void;
  backHome: () => void;
  openShop: () => void;
  setDecision: (area: Area, value: Partial<QuarterDecision>) => void;
  openPopup: (name: PopupName) => void;
  closePopup: () => void;
  openDesk: (area: Area) => void;
  startQuarterPlay: () => void;
  tickPlay: (n?: number) => void;
  skipPlay: () => void;
  answerBulkShort: (choice: MidChoice) => void;
  confirmBill: () => void;
  declareBankruptcy: () => void;
  seeResult: () => void;
  nextQuarter: () => void;
  nextCoach: () => void;
  /** 只给 ?demo= 用：直接放进一个用模型算好的界面状态 */
  load: (ui: UiState) => void;
}

export const useStore = create<Store>((set, get) => {
  const run = (f: (ui: UiState) => UiState): void => set(f(get()));
  return {
    ...initialUi(),
    startNewGame: () => run((ui) => A.startNewGame(ui, newSeed())),
    pickProduct: (id) => run((ui) => A.pickProduct(ui, id)),
    pickFulfillment: (f) => run((ui) => A.pickFulfillment(ui, f)),
    setFirstStock: (qty) => run((ui) => A.setFirstStock(ui, qty)),
    backHome: () => run(A.backHome),
    openShop: () => run(A.openShop),
    setDecision: (area, value) => run((ui) => A.setDecision(ui, area, value)),
    openPopup: (name) => run((ui) => A.openPopup(ui, name)),
    closePopup: () => run(A.closePopup),
    openDesk: (area) => run((ui) => A.openDesk(ui, area)),
    startQuarterPlay: () => run(A.startQuarterPlay),
    tickPlay: (n) => run((ui) => A.tickPlay(ui, n)),
    skipPlay: () => run(A.skipPlay),
    answerBulkShort: (choice) => run((ui) => A.answerBulkShort(ui, choice)),
    confirmBill: () => run(A.confirmBill),
    declareBankruptcy: () => run(A.declareBankruptcy),
    seeResult: () => run(A.seeResult),
    nextQuarter: () => run(A.nextQuarter),
    nextCoach: () => run(A.nextCoach),
    load: (ui) => set(ui),
  };
});
