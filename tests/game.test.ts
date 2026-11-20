import { describe, expect, it } from "vitest";
import { createGame, nextDay, type GameConfig } from "../src/engine/game";

describe("game（占位版本）", () => {
  it("createGame 之后 nextDay 720 次：day 是 720，cashFen 不变，最初的对象没有被修改", () => {
    const config: GameConfig = { seed: 1, fulfillment: "cross", startCashFen: 500000 };
    const first = createGame(config);
    const snapshot = JSON.stringify(first);

    let s = first;
    for (let i = 0; i < 720; i++) s = nextDay(s);

    expect(s.day).toBe(720);
    expect(s.cashFen).toBe(500000);
    expect(JSON.stringify(first)).toBe(snapshot);
    expect(first.day).toBe(0);
  });

  it("nextDay 返回新对象", () => {
    const s0 = createGame({ seed: 1, fulfillment: "local", startCashFen: 100 });
    const s1 = nextDay(s0);
    expect(s1).not.toBe(s0);
    expect(s0.day).toBe(0);
    expect(s1.day).toBe(1);
  });
});
