// 入口：?gallery=1 打开展示页；?demo=名字 直接进入某个固定的状态（docs/09 第九节）
import { useState } from "react";
import { Stage } from "./Stage";
import { Gallery } from "../dev/Gallery";
import { demoState } from "../dev/demoStates";
import { useStore } from "../store/store";

function useDemo(): void {
  const load = useStore((s) => s.load);
  useState(() => {
    if (typeof location === "undefined") return null;
    const name = new URLSearchParams(location.search).get("demo");
    const ui = name ? demoState(name) : null;
    if (ui) load(ui);
    return null;
  });
}

export function App() {
  useDemo();
  const gallery = typeof location !== "undefined" && new URLSearchParams(location.search).has("gallery");
  return gallery ? <Gallery /> : <Stage />;
}
