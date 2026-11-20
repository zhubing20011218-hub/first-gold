// 入口：?gallery=1 打开展示页（docs/09 第九节）；?demo=season-0 到 season-3 只放世界（任务 06 第二步）；其他时候是首页。
// 任务 06 第三步换成 Stage（docs/12 第三节），?demo= 换成 docs/09 第九节的固定状态。
import type { Season } from "../../scene/world/World";
import { Gallery } from "../dev/Gallery";
import { WorldDemo } from "../dev/WorldDemo";
import { Home } from "../Home";

function seasonDemo(): Season | null {
  if (typeof location === "undefined") return null;
  const m = /^season-([0-3])$/.exec(new URLSearchParams(location.search).get("demo") ?? "");
  return m ? (Number(m[1]) as Season) : null;
}

export function App() {
  const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
  if (params?.has("gallery")) return <Gallery />;
  const season = seasonDemo();
  if (season !== null) return <WorldDemo season={season} />;
  return <Home />;
}
